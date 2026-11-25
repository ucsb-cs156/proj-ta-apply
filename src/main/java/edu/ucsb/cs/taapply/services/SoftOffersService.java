package edu.ucsb.cs.taapply.services;

import com.opencsv.CSVWriter;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.entity.SoftOfferNoticeVersion;
import edu.ucsb.cs.taapply.entity.SoftOfferResponse;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.enums.SoftOfferDecision;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.errors.ForbiddenException;
import edu.ucsb.cs.taapply.models.SoftOfferDto;
import edu.ucsb.cs.taapply.models.UcsbCourseOffering;
import edu.ucsb.cs.taapply.models.UcsbSection;
import edu.ucsb.cs.taapply.models.UcsbTimeLocation;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.SoftOfferNoticeVersionRepository;
import edu.ucsb.cs.taapply.repository.SoftOfferResponseRepository;
import java.io.StringWriter;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * The applicant's side of soft offers (issue #486, part of #483): which of the signed-in user's
 * applications has an open soft offer, what it says, and recording the answer.
 *
 * <p>An offer is open for an application when its recruitment is a ULA one whose soft offers are
 * released (issue #485), the application is live (not cancelled, not hidden by an admin) and it has
 * a tentative assignment to a lecture of that recruitment. The rules live here so the admin's
 * results page (issue #487) agrees with what applicants see.
 */
@Service
@Slf4j
public class SoftOffersService {
  @Autowired ApplicationRepository applicationRepository;
  @Autowired RecruitmentRepository recruitmentRepository;
  @Autowired RecruitmentCourseRepository recruitmentCourseRepository;
  @Autowired SoftOfferNoticeVersionRepository softOfferNoticeVersionRepository;
  @Autowired SoftOfferResponseRepository softOfferResponseRepository;
  @Autowired PublishedAssignmentsService publishedAssignmentsService;
  @Autowired UCSBCurriculumService ucsbCurriculumService;
  @Autowired AssignmentsService assignmentsService;

  public static final String NO_OFFER = "There is no soft offer open for this application.";
  public static final String ALREADY_ANSWERED = "This soft offer has already been answered.";
  public static final int COMMENTS_MAX = 4000;
  public static final String COMMENTS_TOO_LONG =
      "Comments may be at most " + COMMENTS_MAX + " characters.";
  public static final String NOT_RELEASED =
      "Soft offers have not been released for this recruitment.";

  /** The Offer Status words of the results page (issue #487). */
  public static final String PROCEED = "Proceed";

  public static final String DECLINED = "Declined";

  /** Appended to a response's date and time when it came after the deadline. */
  public static final String LATE = " (late)";

  /** The results table's columns: the one-row-per-ULA layout's seven, then the answer's three. */
  public static final List<String> RESULTS_HEADERS =
      List.of(
          "First name",
          "Last name",
          "Email",
          "Course assignment",
          "Course instructor",
          "Course instructor email",
          "First time ULA",
          "Offer Status",
          "Offer Response Date/Time",
          "Comments");

  /** The second table: answers from applicants who no longer hold an assignment. */
  public static final List<String> UNASSIGNED_HEADERS =
      List.of(
          "First name",
          "Last name",
          "Email",
          "Course answered for",
          "Offer Status",
          "Offer Response Date/Time",
          "Comments");

  /** How many assigned ULAs there are, and how many have answered each way, or not yet. */
  public record Counts(int assigned, int proceed, int declined, int none) {}

  /**
   * The admin's Soft Offer Results (issue #487): one row per assigned ULA with their answer for the
   * lecture they now hold (an answer for another lecture is marked "(for ...)"), and a second table
   * of answers from applicants no longer assigned anywhere, so a decline is never lost.
   */
  public record Results(
      Long recruitmentId,
      String quarter,
      LocalDateTime releasedAt,
      LocalDateTime deadline,
      Counts counts,
      List<String> headers,
      List<List<String>> rows,
      List<String> unassignedHeaders,
      List<List<String>> unassigned) {}

  /** An application with an open soft offer: the recruitment and the lecture it is assigned to. */
  public record Offer(Application application, Recruitment recruitment, RecruitmentCourse course) {}

  /** The signed-in applicant's open soft offers, newest application first. */
  public List<SoftOfferDto> mine(String email) {
    List<SoftOfferDto> offers = new ArrayList<>();
    Map<String, String> emails = null;
    SoftOfferDto.Notice notice = null;
    boolean looked = false;
    for (Application application : applicationRepository.findByEmailOrderByIdDesc(email)) {
      Offer offer = openOffer(application);
      if (offer == null) {
        continue;
      }
      if (!looked) {
        // Asked for once, and only when there is an offer to describe.
        emails = publishedAssignmentsService.emailsByCatalogName();
        notice = currentNotice();
        looked = true;
      }
      offers.add(describe(offer, emails, notice));
    }
    return offers;
  }

  /**
   * The open soft offer of an application, or null: the recruitment must be a ULA one with soft
   * offers released, the application live, and its tentative assignment a lecture of that
   * recruitment.
   */
  public Offer openOffer(Application application) {
    if (application.getStatus() == ApplicationReviewStatus.CANCELLED
        || application.isHidden()
        || application.getTentativeAssignmentId() == null) {
      return null;
    }
    Optional<Recruitment> recruitment =
        recruitmentRepository.findById(application.getRecruitmentId());
    if (recruitment.isEmpty()
        || recruitment.get().getType() != RecruitmentType.ULA
        || !SoftOffers.isReleased(recruitment.get())) {
      return null;
    }
    Optional<RecruitmentCourse> course =
        recruitmentCourseRepository.findById(application.getTentativeAssignmentId());
    if (course.isEmpty()
        || !application.getRecruitmentId().equals(course.get().getRecruitmentId())) {
      return null;
    }
    return new Offer(application, recruitment.get(), course.get());
  }

  /**
   * Records the applicant's answer to their open soft offer.
   *
   * @throws EntityNotFoundException for an unknown application
   * @throws ForbiddenException for someone else's application
   * @throws IllegalArgumentException when no soft offer is open for it, or the comments are too
   *     long
   * @throws IllegalStateException when this (application, lecture) offer has been answered already
   */
  public SoftOfferResponse respond(
      String email, Long applicationId, SoftOfferDecision decision, String comments) {
    Application application =
        applicationRepository
            .findById(applicationId)
            .orElseThrow(() -> new EntityNotFoundException(Application.class, applicationId));
    if (!email.equals(application.getEmail())) {
      throw new ForbiddenException("That application belongs to someone else");
    }
    Offer offer = openOffer(application);
    if (offer == null) {
      throw new IllegalArgumentException(NO_OFFER);
    }
    String text = comments == null ? "" : comments.strip();
    if (text.length() > COMMENTS_MAX) {
      throw new IllegalArgumentException(COMMENTS_TOO_LONG);
    }
    if (softOfferResponseRepository
        .findByApplicationIdAndRecruitmentCourseId(applicationId, offer.course().getId())
        .isPresent()) {
      throw new IllegalStateException(ALREADY_ANSWERED);
    }
    SoftOfferDto.Notice notice = currentNotice();
    return softOfferResponseRepository.save(
        SoftOfferResponse.builder()
            .applicationId(applicationId)
            .recruitmentCourseId(offer.course().getId())
            .decision(decision)
            .comments(text.isEmpty() ? null : text)
            .softOfferNoticeVersionId(notice == null ? null : notice.id())
            .build());
  }

  /**
   * The results of a released ULA recruitment's soft offers (issue #487).
   *
   * @throws IllegalArgumentException unless the recruitment is a ULA one with soft offers released
   */
  public Results results(Recruitment recruitment) {
    String unmet = SoftOffers.unmetPrerequisite(recruitment);
    if (unmet != null) {
      throw new IllegalArgumentException(unmet);
    }
    if (!SoftOffers.isReleased(recruitment)) {
      throw new IllegalArgumentException(NOT_RELEASED);
    }
    Map<Long, RecruitmentCourse> courses = new HashMap<>();
    for (RecruitmentCourse course :
        recruitmentCourseRepository.findByRecruitmentId(recruitment.getId())) {
      courses.put(course.getId(), course);
    }
    List<Application> all = assignmentsService.realApplications(recruitment.getId());
    Map<String, String> emails = publishedAssignmentsService.emailsByCatalogName();
    Map<Long, List<SoftOfferResponse>> answers =
        softOfferResponseRepository
            .findByApplicationIdIn(all.stream().map(Application::getId).toList())
            .stream()
            .collect(Collectors.groupingBy(SoftOfferResponse::getApplicationId));
    LocalDateTime deadline = recruitment.getSoftOfferDeadline();

    List<List<String>> rows = new ArrayList<>();
    int proceed = 0;
    int declined = 0;
    List<Application> assigned =
        all.stream()
            .filter(a -> courses.containsKey(a.getTentativeAssignmentId()))
            .sorted(PublishedAssignmentsService.BY_NAME)
            .toList();
    for (Application person : assigned) {
      RecruitmentCourse course = courses.get(person.getTentativeAssignmentId());
      List<SoftOfferResponse> mine = answers.getOrDefault(person.getId(), List.of());
      SoftOfferResponse current =
          mine.stream()
              .filter(r -> course.getId().equals(r.getRecruitmentCourseId()))
              .findFirst()
              .orElse(null);
      // With no answer for the lecture now held, the newest answer for another lecture is shown,
      // marked with the lecture it was for.
      SoftOfferResponse shown =
          current != null
              ? current
              : mine.stream()
                  .max(Comparator.comparing(SoftOfferResponse::getRespondedAt))
                  .orElse(null);
      if (current != null) {
        if (current.getDecision() == SoftOfferDecision.PROCEED) {
          proceed++;
        } else {
          declined++;
        }
      }
      List<String> row = new ArrayList<>();
      row.add(ApplicationCsvService.text(person.getFirstName()));
      row.add(ApplicationCsvService.text(person.getLastName()));
      row.add(ApplicationCsvService.text(person.getEmail()));
      row.add(PublishedAssignmentsService.courseNumber(course));
      row.add(ApplicationCsvService.text(course.getInstructor()));
      row.add(instructorEmail(course, emails));
      row.add(PublishedAssignmentsService.firstTimeUla(person));
      row.add(
          shown == null
              ? ""
              : current != null
                  ? status(shown)
                  : status(shown) + " (for " + lectureName(shown, courses) + ")");
      row.add(shown == null ? "" : stamp(shown, deadline));
      row.add(shown == null ? "" : ApplicationCsvService.text(shown.getComments()));
      rows.add(row);
    }

    List<List<String>> unassigned = new ArrayList<>();
    for (Application person : all) {
      if (courses.containsKey(person.getTentativeAssignmentId())) {
        continue;
      }
      for (SoftOfferResponse answer : answers.getOrDefault(person.getId(), List.of())) {
        unassigned.add(
            List.of(
                ApplicationCsvService.text(person.getFirstName()),
                ApplicationCsvService.text(person.getLastName()),
                ApplicationCsvService.text(person.getEmail()),
                lectureName(answer, courses),
                status(answer),
                stamp(answer, deadline),
                ApplicationCsvService.text(answer.getComments())));
      }
    }
    unassigned.sort(
        Comparator.comparing((List<String> r) -> r.get(1), String.CASE_INSENSITIVE_ORDER)
            .thenComparing(r -> r.get(0), String.CASE_INSENSITIVE_ORDER));

    return new Results(
        recruitment.getId(),
        recruitment.getQuarter(),
        recruitment.getSoftOffersReleasedAt(),
        deadline,
        new Counts(assigned.size(), proceed, declined, assigned.size() - proceed - declined),
        RESULTS_HEADERS,
        rows,
        UNASSIGNED_HEADERS,
        unassigned);
  }

  /** The main results table as CSV: the header row, then a row per assigned ULA. */
  public String resultsCsv(Recruitment recruitment) {
    Results results = results(recruitment);
    StringWriter out = new StringWriter();
    CSVWriter writer = new CSVWriter(out);
    writer.writeNext(results.headers().toArray(String[]::new));
    for (List<String> row : results.rows()) {
      writer.writeNext(row.toArray(String[]::new));
    }
    return out.toString();
  }

  private static String status(SoftOfferResponse answer) {
    return answer.getDecision() == SoftOfferDecision.PROCEED ? PROCEED : DECLINED;
  }

  /** "2026-11-21T08:05", with " (late)" when after the deadline. */
  private static String stamp(SoftOfferResponse answer, LocalDateTime deadline) {
    String text = ApplicationCsvService.text(answer.getRespondedAt());
    boolean late =
        deadline != null
            && answer.getRespondedAt() != null
            && answer.getRespondedAt().isAfter(deadline);
    return late ? text + LATE : text;
  }

  /** The lecture an answer was for, by number, or "lecture N" when it is no longer on file. */
  private static String lectureName(
      SoftOfferResponse answer, Map<Long, RecruitmentCourse> courses) {
    RecruitmentCourse course = courses.get(answer.getRecruitmentCourseId());
    return course == null
        ? "lecture " + answer.getRecruitmentCourseId()
        : PublishedAssignmentsService.courseNumber(course);
  }

  private static String instructorEmail(RecruitmentCourse course, Map<String, String> emails) {
    String email = course.getInstructor() == null ? null : emails.get(course.getInstructor());
    return email == null ? PublishedAssignmentsService.NOT_MAPPED : email;
  }

  private SoftOfferDto.Notice currentNotice() {
    return softOfferNoticeVersionRepository
        .findFirstByOrderByIdDesc()
        .map(this::notice)
        .orElse(null);
  }

  private SoftOfferDto.Notice notice(SoftOfferNoticeVersion version) {
    return new SoftOfferDto.Notice(version.getId(), version.getContent());
  }

  private SoftOfferDto describe(
      Offer offer, Map<String, String> emails, SoftOfferDto.Notice notice) {
    Recruitment recruitment = offer.recruitment();
    RecruitmentCourse course = offer.course();
    Application application = offer.application();
    // The stored meeting time reads "09:30 - 10:45".
    String time = course.getTime() == null ? "" : course.getTime();
    // split always yields at least one part, so the start is parts[0] and the end, if any,
    // parts[1].
    String[] parts = time.split(" - ", 2);
    String begin = parts[0].isBlank() ? null : parts[0].strip();
    String end = parts.length == 2 && !parts[1].isBlank() ? parts[1].strip() : null;
    SoftOfferDto.Course courseDto =
        new SoftOfferDto.Course(
            course.getId(),
            PublishedAssignmentsService.courseNumber(course),
            course.getSection(),
            course.getTitle(),
            course.getInstructor(),
            course.getInstructor() == null ? null : emails.get(course.getInstructor()),
            course.getDays(),
            begin,
            end);
    SoftOfferDto.Response response =
        softOfferResponseRepository
            .findByApplicationIdAndRecruitmentCourseId(application.getId(), course.getId())
            .map(
                r ->
                    new SoftOfferDto.Response(r.getDecision(), r.getComments(), r.getRespondedAt()))
            .orElse(null);
    return new SoftOfferDto(
        recruitment.getId(),
        recruitment.getQuarter(),
        application.getId(),
        recruitment.getSoftOffersReleasedAt(),
        recruitment.getSoftOfferDeadline(),
        notice,
        courseDto,
        sectionsOf(recruitment.getQuarter(), course),
        response);
  }

  /**
   * The lecture's discussion sections from the UCSB API, in section order, one row per meeting (a
   * section with no scheduled time is one row with no days or times). For a course with two
   * lectures, only the sections whose number shares the lecture's first two digits (0101 to 0199
   * under 0100). Null when the API cannot be reached, so the offer still shows without them.
   */
  List<SoftOfferDto.Meeting> sectionsOf(String quarter, RecruitmentCourse course) {
    UcsbCourseOffering offering;
    try {
      offering = ucsbCurriculumService.getOffering(quarter, course.getEnrollCode());
    } catch (Exception e) {
      log.warn(
          "Soft offer: no sections for {} ({}): {}", course.getCourseId(), quarter, e.toString());
      return null;
    }
    String lecture = course.getSection();
    // A lecture number shorter than two digits cannot say which sections are its own.
    String prefix = lecture != null && lecture.length() >= 2 ? lecture.substring(0, 2) : null;
    List<UcsbSection> sections =
        offering.getClassSections() == null ? List.<UcsbSection>of() : offering.getClassSections();
    List<SoftOfferDto.Meeting> meetings = new ArrayList<>();
    sections.stream()
        .filter(section -> !section.isPrimary())
        .filter(
            section ->
                prefix == null
                    || (section.getSection() != null && section.getSection().startsWith(prefix)))
        .sorted(
            Comparator.comparing(
                UcsbSection::getSection, Comparator.nullsFirst(Comparator.naturalOrder())))
        .forEach(
            section -> {
              List<UcsbTimeLocation> locations = section.getTimeLocations();
              if (locations == null || locations.isEmpty()) {
                meetings.add(new SoftOfferDto.Meeting(section.getSection(), null, null, null));
                return;
              }
              for (UcsbTimeLocation location : locations) {
                meetings.add(
                    new SoftOfferDto.Meeting(
                        section.getSection(),
                        location.getDays(),
                        location.getBeginTime(),
                        location.getEndTime()));
              }
            });
    return meetings;
  }
}
