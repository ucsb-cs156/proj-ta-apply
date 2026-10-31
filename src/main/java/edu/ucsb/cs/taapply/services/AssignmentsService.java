package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.CandidateRanking;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.CandidateRankingRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * What the admin Assignments page and the rankings CSV have in common (issue #179): which
 * applicants count, how they are identified, which sections appear in which order, and how many
 * applicants are tentatively assigned to each section.
 */
@Service
public class AssignmentsService {
  @Autowired ApplicationRepository applicationRepository;
  @Autowired RecruitmentCourseRepository recruitmentCourseRepository;
  @Autowired CandidateRankingRepository candidateRankingRepository;

  /** One column identifying an applicant: its header and how to read it off an application. */
  public record IdentityColumn(String header, Function<Application, Object> value) {}

  private static final List<IdentityColumn> COMMON_IDENTITY =
      List.of(
          new IdentityColumn("firstName", Application::getFirstName),
          new IdentityColumn("lastName", Application::getLastName),
          new IdentityColumn("email", Application::getEmail),
          new IdentityColumn("major", Application::getMajor));

  /**
   * The identity columns for a recruitment's type: the common four, class level for TAs, year in
   * program and graduation date, then GPAs and previous ULA service for ULAs. No video links,
   * middle names or admin comments.
   */
  public static List<IdentityColumn> identityColumns(RecruitmentType type) {
    List<IdentityColumn> columns = new ArrayList<>(COMMON_IDENTITY);
    if (type == RecruitmentType.TA) {
      columns.add(new IdentityColumn("classLevel", Application::getClassLevel));
    }
    columns.add(new IdentityColumn("yearInProgram", Application::getYearInProgram));
    columns.add(new IdentityColumn("graduationDate", Application::getGraduationDate));
    if (type == RecruitmentType.ULA) {
      columns.add(new IdentityColumn("gpaMajor", Application::getGpaMajor));
      columns.add(new IdentityColumn("gpaOverall", Application::getGpaOverall));
      columns.add(new IdentityColumn("previousServiceAsUla", Application::getPreviousServiceAsUla));
    }
    return columns;
  }

  /** Course id, then section, then enrollment code, a null reading as "" in each. */
  public static final Comparator<RecruitmentCourse> BY_COURSE_SECTION_ENROLL =
      Comparator.comparing((RecruitmentCourse c) -> ApplicationCsvService.text(c.getCourseId()))
          .thenComparing(c -> ApplicationCsvService.text(c.getSection()))
          .thenComparing(c -> ApplicationCsvService.text(c.getEnrollCode()));

  /** "CMPSC 16 (section 0100, enroll 100)": how a section is named in the CSV. */
  public static String label(RecruitmentCourse course) {
    return "%s (section %s, enroll %s)"
        .formatted(
            ApplicationCsvService.text(course.getCourseId()),
            ApplicationCsvService.text(course.getSection()),
            ApplicationCsvService.text(course.getEnrollCode()));
  }

  /**
   * One section as the page shows it: the stored allocation, how many applicants are tentatively
   * assigned to it, and how many places are left (negative when over-assigned). {@code historical}
   * marks a section no longer on offer (removed, stale or cancelled) that is kept for its rankings.
   */
  public record CourseSummary(
      Long id,
      String courseId,
      String section,
      String enrollCode,
      Integer allocation,
      int assigned,
      int left,
      boolean historical) {}

  /**
   * One applicant as the page shows them: the identity columns as text, keyed by header; the
   * tentatively assigned recruitment course id, or null; and each section's rank, keyed by
   * recruitment course id, only for sections that ranked them.
   */
  public record AssignmentRow(
      Long applicationId,
      Map<String, String> identity,
      Long tentativeAssignment,
      Map<Long, Integer> rankings) {}

  /** Everything the admin Assignments page needs for one recruitment. */
  public record Assignments(
      Long recruitmentId,
      RecruitmentType type,
      List<String> identityHeaders,
      List<CourseSummary> courses,
      List<AssignmentRow> rows) {}

  /**
   * The applications that take part in assignments: every application to the recruitment that is
   * neither a test application nor cancelled by the applicant, in the order they were created.
   */
  public List<Application> realApplications(Long recruitmentId) {
    return real(applicationRepository.findByRecruitmentIdOrderByIdAsc(recruitmentId));
  }

  /** The given applications without test applications and without cancelled ones. */
  public static List<Application> real(List<Application> applications) {
    return applications.stream()
        .filter(a -> !a.isTestApplication())
        .filter(a -> a.getStatus() != ApplicationReviewStatus.CANCELLED)
        .toList();
  }

  /** How many of the given applications are tentatively assigned to each recruitment course. */
  public static Map<Long, Integer> assignedCounts(List<Application> applications) {
    Map<Long, Integer> counts = new HashMap<>();
    for (Application application : applications) {
      if (application.getTentativeAssignmentId() != null) {
        counts.merge(application.getTentativeAssignmentId(), 1, Integer::sum);
      }
    }
    return counts;
  }

  /** The ranks one section gave, keyed by application id. */
  public Map<Long, Integer> ranksFor(RecruitmentCourse course) {
    Map<Long, Integer> ranks = new HashMap<>();
    for (CandidateRanking ranking :
        candidateRankingRepository.findByRecruitmentCourseId(course.getId())) {
      ranks.put(ranking.getApplicationId(), ranking.getRank());
    }
    return ranks;
  }

  /**
   * The sections and applicants of the Assignments page. Every section not removed is a column; a
   * removed section is kept only while it still has rankings or a tentative assignee, so nothing
   * faculty entered disappears from view.
   */
  public Assignments assignments(Recruitment recruitment) {
    List<IdentityColumn> identity = identityColumns(recruitment.getType());
    List<Application> applications = realApplications(recruitment.getId());
    Map<Long, Integer> assigned = assignedCounts(applications);

    List<RecruitmentCourse> courses =
        new ArrayList<>(recruitmentCourseRepository.findByRecruitmentId(recruitment.getId()));
    courses.sort(BY_COURSE_SECTION_ENROLL);

    List<CourseSummary> summaries = new ArrayList<>();
    Map<Long, Map<Long, Integer>> ranksByCourse = new LinkedHashMap<>();
    for (RecruitmentCourse course : courses) {
      Map<Long, Integer> ranks = ranksFor(course);
      int count = assigned.getOrDefault(course.getId(), 0);
      if (course.isRemoved() && ranks.isEmpty() && count == 0) {
        continue;
      }
      ranksByCourse.put(course.getId(), ranks);
      summaries.add(
          new CourseSummary(
              course.getId(),
              course.getCourseId(),
              course.getSection(),
              course.getEnrollCode(),
              course.getAllocation(),
              count,
              course.getAllocation() - count,
              !course.isOnOffer()));
    }

    List<AssignmentRow> rows = new ArrayList<>();
    for (Application application : applications) {
      Map<String, String> fields = new LinkedHashMap<>();
      for (IdentityColumn column : identity) {
        fields.put(column.header(), ApplicationCsvService.text(column.value().apply(application)));
      }
      Map<Long, Integer> rankings = new LinkedHashMap<>();
      ranksByCourse.forEach(
          (courseId, ranks) -> {
            if (ranks.containsKey(application.getId())) {
              rankings.put(courseId, ranks.get(application.getId()));
            }
          });
      rows.add(
          new AssignmentRow(
              application.getId(), fields, application.getTentativeAssignmentId(), rankings));
    }

    return new Assignments(
        recruitment.getId(),
        recruitment.getType(),
        identity.stream().map(IdentityColumn::header).toList(),
        summaries,
        rows);
  }
}
