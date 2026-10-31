package edu.ucsb.cs.taapply.controller;

import com.fasterxml.jackson.databind.JsonNode;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.CandidateRanking;
import edu.ucsb.cs.taapply.entity.Instructor;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.CourseInterest;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.errors.ForbiddenException;
import edu.ucsb.cs.taapply.model.CurrentUser;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.CandidateRankingRepository;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * What an instructor sees on the home page (issue #127): the recruitments that include a course
 * they teach, each with its list of their courses.
 *
 * <p>The match goes through the catalog: an instructor's email maps to the name the course catalog
 * uses for them (issue #120, set by an admin), and each recruitment course row records the catalog
 * name of its instructor of record. An instructor with no catalog name yet matches nothing.
 */
@Tag(name = "InstructorRecruitments")
@RequestMapping("/api/instructor/recruitments")
@RestController
@Slf4j
public class InstructorRecruitmentsController extends ApiController {

  @Autowired InstructorRepository instructorRepository;
  @Autowired RecruitmentRepository recruitmentRepository;
  @Autowired RecruitmentCourseRepository recruitmentCourseRepository;
  @Autowired ApplicationRepository applicationRepository;
  @Autowired CandidateRankingRepository candidateRankingRepository;

  /** A recruitment as the admin's and student's cards know it, plus the instructor's courses. */
  public static record InstructorRecruitment(
      Long id,
      String quarter,
      RecruitmentType type,
      ApplicationStatus applicationStatus,
      LocalDate tentativeOpeningDate,
      LocalDate primaryConsiderationDate,
      LocalDate actualOpeningDate,
      LocalDate actualClosingDate,
      String reviewStatus,
      LocalDate facultyReviewOpeningDate,
      LocalDate facultyRankingDeadline,
      List<RecruitmentCourse> courses) {
    public static InstructorRecruitment of(Recruitment r, List<RecruitmentCourse> courses) {
      return new InstructorRecruitment(
          r.getId(),
          r.getQuarter(),
          r.getType(),
          r.getApplicationStatus(),
          r.getTentativeOpeningDate(),
          r.getPrimaryConsiderationDate(),
          r.getActualOpeningDate(),
          r.getActualClosingDate(),
          r.getReviewStatus(),
          r.getFacultyReviewOpeningDate(),
          r.getFacultyRankingDeadline(),
          courses);
    }
  }

  /** Course-scoped metadata shared by rankings and the read-only application page. */
  public static record CandidateRankingPage(
      Long recruitmentId,
      String quarter,
      RecruitmentType type,
      LocalDate tentativeOpeningDate,
      LocalDate primaryConsiderationDate,
      LocalDate actualOpeningDate,
      LocalDate actualClosingDate,
      String reviewStatus,
      LocalDate facultyReviewOpeningDate,
      LocalDate facultyRankingDeadline,
      CourseDetails course,
      List<CourseDetails> otherCourses) {}

  /** Course identity and catalog display fields; section rows remain distinct by id. */
  public static record CourseDetails(
      Long id, String courseId, String section, String title, String instructor) {
    public static CourseDetails of(RecruitmentCourse course) {
      return new CourseDetails(
          course.getId(),
          course.getCourseId(),
          course.getSection(),
          course.getTitle(),
          course.getInstructor());
    }
  }

  /** Newest quarter first, TA before ULA within a quarter: the order the other lists use. */
  private static final Comparator<Recruitment> NEWEST_FIRST =
      Comparator.comparing(Recruitment::getQuarter).reversed().thenComparing(Recruitment::getType);

  /** Course id first, then section, so a course's several lectures sit together in order. */
  private static final Comparator<RecruitmentCourse> BY_COURSE_THEN_SECTION =
      Comparator.comparing(RecruitmentCourse::getCourseId)
          .thenComparing(
              RecruitmentCourse::getSection, Comparator.nullsFirst(Comparator.naturalOrder()));

  @Operation(
      summary = "The recruitments that include a course this instructor teaches",
      description =
          "Each carries the instructor's courses in it, course id then section. The instructor is"
              + " matched by the catalog name an admin assigned to the email; an email that is not"
              + " an instructor, or has no catalog name yet, gets an empty list. Removed courses"
              + " do not count.")
  @PreAuthorize("hasAnyRole('ROLE_INSTRUCTOR', 'ROLE_ADMIN')")
  @GetMapping("")
  public List<InstructorRecruitment> forInstructor(
      @Parameter(name = "email") @RequestParam String email) {

    String catalogName =
        instructorRepository.findByEmail(email).map(Instructor::getCatalogName).orElse(null);
    if (catalogName == null) {
      return List.of();
    }

    Map<Long, List<RecruitmentCourse>> byRecruitment =
        recruitmentCourseRepository.findByInstructor(catalogName).stream()
            .filter(row -> !row.isRemoved())
            .collect(Collectors.groupingBy(RecruitmentCourse::getRecruitmentId));
    if (byRecruitment.isEmpty()) {
      return List.of();
    }

    return StreamSupport.stream(
            recruitmentRepository.findAllById(byRecruitment.keySet()).spliterator(), false)
        .sorted(NEWEST_FIRST)
        .map(
            r ->
                InstructorRecruitment.of(
                    r,
                    byRecruitment.get(r.getId()).stream().sorted(BY_COURSE_THEN_SECTION).toList()))
        .toList();
  }

  /**
   * Read-only candidate-ranking page metadata. Instructor access is derived from the authenticated
   * user's email and admin-managed catalog-name mapping; no caller-supplied identity is trusted.
   */
  @Operation(
      summary = "Get the course-scoped candidate ranking page",
      description =
          "Instructors may read only their own active recruitment courses. Admins may read any course.")
  @PreAuthorize("hasAnyRole('ROLE_INSTRUCTOR', 'ROLE_ADMIN')")
  @GetMapping("/{recruitmentId}/courses/{recruitmentCourseId}/ranking")
  public CandidateRankingPage candidateRankingPage(
      @PathVariable Long recruitmentId, @PathVariable Long recruitmentCourseId) {
    RankingScope scope = rankingScope(recruitmentId, recruitmentCourseId, false);
    Recruitment recruitment = scope.recruitment();
    RecruitmentCourse course = scope.course();
    String catalogName = scope.catalogName();
    List<CourseDetails> otherCourses =
        catalogName == null
            ? List.of()
            : recruitmentCourseRepository.findByRecruitmentId(recruitmentId).stream()
                .filter(row -> !row.getId().equals(recruitmentCourseId))
                .filter(row -> catalogName.equals(row.getInstructor()))
                .filter(RecruitmentCourse::isOnOffer)
                .sorted(BY_COURSE_THEN_SECTION)
                .map(CourseDetails::of)
                .toList();

    return new CandidateRankingPage(
        recruitment.getId(),
        recruitment.getQuarter(),
        recruitment.getType(),
        recruitment.getTentativeOpeningDate(),
        recruitment.getPrimaryConsiderationDate(),
        recruitment.getActualOpeningDate(),
        recruitment.getActualClosingDate(),
        recruitment.getReviewStatus(),
        recruitment.getFacultyReviewOpeningDate(),
        recruitment.getFacultyRankingDeadline(),
        CourseDetails.of(course),
        otherCourses);
  }

  private record RankingScope(
      Recruitment recruitment, RecruitmentCourse course, String catalogName) {}

  private RankingScope rankingScope(Long recruitmentId, Long recruitmentCourseId, boolean editing) {
    Recruitment recruitment =
        recruitmentRepository
            .findById(recruitmentId)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, recruitmentId));
    RecruitmentCourse course =
        recruitmentCourseRepository
            .findById(recruitmentCourseId)
            .orElseThrow(
                () -> new EntityNotFoundException(RecruitmentCourse.class, recruitmentCourseId));

    if (!recruitmentId.equals(course.getRecruitmentId())) {
      throw new IllegalArgumentException(
          "Recruitment course %s does not belong to recruitment %s"
              .formatted(recruitmentCourseId, recruitmentId));
    }
    if (!course.isOnOffer()) {
      throw new ForbiddenException(
          "This recruitment course has been removed or is no longer available.");
    }
    if ("NotStarted".equals(recruitment.getReviewStatus())) {
      throw new ForbiddenException(
          "Candidate rankings are unavailable because faculty reviews have not started.");
    }

    CurrentUser currentUser = getCurrentUser();
    if (currentUser == null || currentUser.getUser() == null) {
      throw new ForbiddenException("The authenticated user could not be identified.");
    }
    String email = currentUser.getUser().getEmail();
    boolean isAdmin =
        currentUser.getRoles() != null
            && currentUser.getRoles().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch("ROLE_ADMIN"::equals);

    String catalogName =
        instructorRepository.findByEmail(email).map(Instructor::getCatalogName).orElse(null);
    if (!isAdmin && (catalogName == null || !catalogName.equals(course.getInstructor()))) {
      throw new ForbiddenException(
          "This recruitment course is not assigned to the authenticated instructor.");
    }
    if (editing && (isAdmin || !"Open".equals(recruitment.getReviewStatus()))) {
      throw new ForbiddenException(
          "Only assigned instructors may rank candidates while reviews are Open.");
    }
    return new RankingScope(recruitment, course, catalogName);
  }

  public static record Candidate(
      Long applicationId,
      Integer rank,
      String preference,
      String firstName,
      String lastName,
      String email,
      String major,
      String classLevel,
      String yearInProgram,
      String graduationDate,
      Double gpaMajor,
      Double gpaOverall,
      Integer previousServiceAsUla,
      String videoLink) {}

  public static record RankEdit(Integer rank) {}

  static String preference(Application application, String courseId) {
    if (courseId.equals(application.getFirstChoiceCourse())) return "1st Choice";
    if (courseId.equals(application.getSecondChoiceCourse())) return "2nd Choice";
    CourseInterest interest = application.getCourseInterests().get(courseId);
    if (interest == CourseInterest.ENTHUSIASTIC) return "Enthusiastic";
    if (interest == CourseInterest.WOULD_CONSIDER) return "Would Consider";
    return null;
  }

  private List<Application> eligible(RankingScope scope) {
    return applicationRepository
        .findByRecruitmentIdOrderByIdAsc(scope.recruitment().getId())
        .stream()
        .filter(application -> !application.isTestApplication())
        .filter(application -> preference(application, scope.course().getCourseId()) != null)
        .toList();
  }

  @PreAuthorize("hasAnyRole('ROLE_INSTRUCTOR', 'ROLE_ADMIN')")
  @GetMapping("/{recruitmentId}/courses/{recruitmentCourseId}/candidates")
  public List<Candidate> candidates(
      @PathVariable Long recruitmentId, @PathVariable Long recruitmentCourseId) {
    RankingScope scope = rankingScope(recruitmentId, recruitmentCourseId, false);
    Map<Long, Integer> ranks = new HashMap<>();
    candidateRankingRepository
        .findByRecruitmentCourseId(recruitmentCourseId)
        .forEach(row -> ranks.put(row.getApplicationId(), row.getRank()));
    return eligible(scope).stream()
        .map(
            application ->
                new Candidate(
                    application.getId(),
                    ranks.get(application.getId()),
                    preference(application, scope.course().getCourseId()),
                    application.getFirstName(),
                    application.getLastName(),
                    application.getEmail(),
                    application.getMajor(),
                    application.getClassLevel() == null ? null : application.getClassLevel().name(),
                    application.getYearInProgram(),
                    application.getGraduationDate(),
                    application.getGpaMajor(),
                    application.getGpaOverall(),
                    application.getPreviousServiceAsUla(),
                    application.getVideoLink()))
        .toList();
  }

  @PreAuthorize("hasAnyRole('ROLE_INSTRUCTOR', 'ROLE_ADMIN')")
  @PutMapping("/{recruitmentId}/courses/{recruitmentCourseId}/candidates/{applicationId}/rank")
  public RankEdit rank(
      @PathVariable Long recruitmentId,
      @PathVariable Long recruitmentCourseId,
      @PathVariable Long applicationId,
      @RequestBody JsonNode body) {
    RankingScope scope = rankingScope(recruitmentId, recruitmentCourseId, true);
    List<Application> applications = eligible(scope);
    requireCandidate(applications, applicationId);
    JsonNode value = body.get("rank");
    if (value == null
        || (!value.isNull() && (!value.isIntegralNumber() || !value.canConvertToInt()))) {
      throw new IllegalArgumentException("Rank must be an integer or null.");
    }
    RankEdit edit = new RankEdit(value.isNull() ? null : value.intValue());
    if (edit.rank() != null && (edit.rank() < 1 || edit.rank() > applications.size())) {
      throw new IllegalArgumentException(
          "Rank must be an integer from 1 through " + applications.size() + ", or null.");
    }
    CandidateRanking ranking =
        candidateRankingRepository
            .findByRecruitmentCourseIdAndApplicationId(recruitmentCourseId, applicationId)
            .orElseGet(
                () ->
                    CandidateRanking.builder()
                        .recruitmentCourseId(recruitmentCourseId)
                        .applicationId(applicationId)
                        .build());
    ranking.setRank(edit.rank());
    candidateRankingRepository.save(ranking);
    return edit;
  }

  private Application requireCandidate(List<Application> applications, Long applicationId) {
    return applications.stream()
        .filter(application -> applicationId.equals(application.getId()))
        .findFirst()
        .orElseThrow(
            () ->
                new ForbiddenException(
                    "This application is not an eligible candidate for this recruitment course."));
  }

  /** Student answers only: never return the administrative review fields. */
  public static record CandidateApplication(
      Long id,
      Long recruitmentId,
      String email,
      LocalDateTime submittedAt,
      String postApplicationComments,
      ApplicationsController.ApplicationFields answers) {}

  @PreAuthorize("hasAnyRole('ROLE_INSTRUCTOR', 'ROLE_ADMIN')")
  @GetMapping("/{recruitmentId}/courses/{recruitmentCourseId}/candidates/{applicationId}")
  public CandidateApplication candidateApplication(
      @PathVariable Long recruitmentId,
      @PathVariable Long recruitmentCourseId,
      @PathVariable Long applicationId) {
    RankingScope scope = rankingScope(recruitmentId, recruitmentCourseId, false);
    Application a = requireCandidate(eligible(scope), applicationId);
    return new CandidateApplication(
        a.getId(),
        a.getRecruitmentId(),
        a.getEmail(),
        a.getSubmittedAt(),
        a.getPostApplicationComments(),
        new ApplicationsController.ApplicationFields(
            a.getFirstName(),
            a.getMiddleName(),
            a.getLastName(),
            a.getMajor(),
            a.getGpaMajor(),
            a.getGpaOverall(),
            a.getYearInProgram(),
            a.getGraduationDate(),
            a.getPriorCoursework().stream()
                .map(
                    p ->
                        new ApplicationsController.PriorCourseworkFields(
                            p.isUcsbCourse(),
                            p.getOtherSchool(),
                            p.getCourseNumber(),
                            p.getCourseTitle(),
                            p.getTerm(),
                            p.getGrade()))
                .toList(),
            a.getTopicProficiencies(),
            a.getInterests(),
            a.getPrevExperience(),
            a.getComments(),
            a.getFirstChoiceCourse(),
            a.getSecondChoiceCourse(),
            a.isAvailableForLecturesFirstChoice(),
            a.isAvailableForLecturesSecondChoice(),
            a.isAvailableForDiscussionFirstChoice(),
            a.isAvailableForDiscussionSecondChoice(),
            a.getAvailabilityCommentsFirstChoice(),
            a.getAvailabilityCommentsSecondChoice(),
            a.getCourseInterests(),
            a.getResidencyStatus(),
            a.getLanguageExam(),
            a.getLanguageExamDatePassed(),
            a.getClassLevel(),
            a.getVideoLink(),
            a.getPreviousServiceAsUla(),
            a.getPermNumber(),
            a.getBsMsStudent(),
            a.getStudentStatusNextQuarter(),
            a.getWantsTaEligibility(),
            a.getOtherCampusJob(),
            a.getPriorUcsbEmployment(),
            a.getEmployeeId(),
            a.getI9Appointment(),
            a.getTrainingCommitment(),
            a.getTrainingCommitmentExplanation(),
            a.getChangingMajor(),
            a.getNoticeVersionId()));
  }
}
