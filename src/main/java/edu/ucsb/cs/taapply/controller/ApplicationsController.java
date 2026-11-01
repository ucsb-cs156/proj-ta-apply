package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.NoticeVersion;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.CourseInterest;
import edu.ucsb.cs.taapply.enums.OtherCampusJob;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.enums.StudentStatus;
import edu.ucsb.cs.taapply.enums.TrainingCommitment;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.errors.ForbiddenException;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.NoticeVersionRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.ApplicationAccessService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * An applicant's own applications.
 *
 * <p>Every read and write here confirms the row belongs to the current user. An applicant reading
 * or editing someone else's application would be the worst bug this iteration could ship, so
 * ownership is checked explicitly rather than relying on a query happening to filter by email.
 */
@Tag(name = "Applications")
@RequestMapping("/api/applications")
@RestController
@Slf4j
public class ApplicationsController extends ApiController {

  @Autowired ApplicationRepository applicationRepository;
  @Autowired RecruitmentRepository recruitmentRepository;
  @Autowired NoticeVersionRepository noticeVersionRepository;
  @Autowired ApplicationAccessService applicationAccessService;

  /**
   * The fields an applicant may set. Deliberately not the entity: status and email are not theirs.
   */
  public static record ApplicationFields(
      String firstName,
      String middleName,
      String lastName,
      String major,
      Double gpaMajor,
      Double gpaOverall,
      String yearInProgram,
      String graduationDate,
      /** The courses listed as relevant background, in order; at least 3 (TA) or 1 (ULA). */
      List<PriorCourseworkFields> priorCoursework,
      /**
       * Topic name to self-rated proficiency, 1..5 on a TA form, 1..3 on a ULA one; may be null.
       */
      Map<String, Integer> topicProficiencies,
      /** ULA only: interest area to level 1..5; may be null or empty, and ignored on a TA form. */
      Map<String, Integer> interests,
      String prevExperience,
      String comments,
      String firstChoiceCourse,
      String secondChoiceCourse,
      boolean availableForLecturesFirstChoice,
      boolean availableForLecturesSecondChoice,
      boolean availableForDiscussionFirstChoice,
      boolean availableForDiscussionSecondChoice,
      String availabilityCommentsFirstChoice,
      String availabilityCommentsSecondChoice,
      /** Course id to interest, for courses other than the two choices; may be null or empty. */
      Map<String, CourseInterest> courseInterests,
      edu.ucsb.cs.taapply.enums.ResidencyStatus residencyStatus,
      edu.ucsb.cs.taapply.enums.LanguageExamStatus languageExam,
      /** Quarter and year, free text, e.g. F25. */
      String languageExamDatePassed,
      edu.ucsb.cs.taapply.enums.ClassLevel classLevel,
      String videoLink,
      Integer previousServiceAsUla,
      // ---- ULA only, from the Google Form the ULA application used to be (issue #72) ----
      /** 7 letters or digits, any case; stored upper case. Required of a ULA applicant. */
      String permNumber,
      Boolean bsMsStudent,
      StudentStatus studentStatusNextQuarter,
      Boolean wantsTaEligibility,
      OtherCampusJob otherCampusJob,
      Boolean priorUcsbEmployment,
      String employeeId,
      Boolean i9Appointment,
      TrainingCommitment trainingCommitment,
      String trainingCommitmentExplanation,
      Boolean changingMajor,
      /** The notice version the applicant ticked the agreement box for; see requireAgreement. */
      Long noticeVersionId) {}

  /** One row of the prior coursework table. Ids are not accepted: rows are rebuilt on each save. */
  public static record PriorCourseworkFields(
      boolean ucsbCourse,
      String otherSchool,
      String courseNumber,
      String courseTitle,
      String term,
      String grade) {}

  public static final int MIN_TA_COURSES = 3;
  public static final int MIN_ULA_COURSES = 1;

  private String currentEmail() {
    return getCurrentUser().getUser().getEmail();
  }

  /**
   * An application as its applicant may see it: without the admin comments, which are the staff's
   * notes about them. A copy, so the stored row is untouched; every applicant-facing response goes
   * through here (issue #75).
   */
  static Application forApplicant(Application application) {
    return application.toBuilder().adminComments(null).build();
  }

  /** Loads an application, refusing anyone else's rather than merely not finding it. */
  private Application mine(Long id) {
    Application application =
        applicationRepository
            .findById(id)
            .orElseThrow(() -> new EntityNotFoundException(Application.class, id));

    if (!currentEmail().equals(application.getEmail())) {
      // Deliberately not a 404: the row exists, it simply is not theirs.
      throw new ForbiddenException("That application belongs to someone else");
    }
    return application;
  }

  private Recruitment recruitmentFor(Application application) {
    return recruitmentRepository
        .findById(application.getRecruitmentId())
        .orElseThrow(
            () -> new EntityNotFoundException(Recruitment.class, application.getRecruitmentId()));
  }

  @Operation(summary = "The current user's own applications, newest first")
  @PreAuthorize("hasRole('ROLE_USER')")
  @GetMapping("/mine")
  public List<Application> myApplications() {
    return applicationRepository.findByEmailOrderByIdDesc(currentEmail()).stream()
        .map(ApplicationsController::forApplicant)
        .toList();
  }

  @Operation(
      summary = "One of the current user's applications",
      description = "403 for an application belonging to anyone else.")
  @PreAuthorize("hasRole('ROLE_USER')")
  @GetMapping("")
  public Application getApplication(@Parameter(name = "id") @RequestParam Long id) {
    return forApplicant(mine(id));
  }

  @Operation(
      summary = "The applicant's most recent application, for pre-filling a new one",
      description =
          "The one for the most recent recruitment quarter (newest row first within a quarter)."
              + " Empty if they have never applied.")
  @PreAuthorize("hasRole('ROLE_USER')")
  @GetMapping("/prefill")
  public List<Application> prefill() {
    List<Application> mine = applicationRepository.findByEmailOrderByIdDesc(currentEmail());
    // By recruitment quarter rather than by id: an application imported from the legacy app's
    // data gets a newer id than one the student made since, yet is the older of the two.
    Map<Long, String> quarters = new HashMap<>();
    recruitmentRepository
        .findAllById(mine.stream().map(Application::getRecruitmentId).toList())
        .forEach(r -> quarters.put(r.getId(), r.getQuarter()));
    return mine.stream()
        .sorted(
            Comparator.comparing((Application a) -> quarters.getOrDefault(a.getRecruitmentId(), ""))
                .reversed())
        .limit(1)
        .map(ApplicationsController::forApplicant)
        .toList();
  }

  @Operation(
      summary = "Apply to a recruitment",
      description =
          "Any signed-in user may apply to any open recruitment, TA or ULA. Refused if the"
              + " recruitment is not open or they already have an application for it.")
  @PreAuthorize("hasRole('ROLE_USER')")
  @PostMapping("/post")
  public Application postApplication(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId,
      @RequestBody ApplicationFields fields) {

    Recruitment recruitment =
        recruitmentRepository
            .findById(recruitmentId)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, recruitmentId));

    if (!applicationAccessService.acceptingApplications(recruitment)) {
      throw new IllegalArgumentException(
          "Applications are not currently open for this recruitment");
    }
    if (applicationRepository.existsByEmailAndRecruitmentId(currentEmail(), recruitmentId)) {
      throw new IllegalArgumentException("You already have an application for this recruitment");
    }

    requireAgreement(recruitment.getType(), fields);
    requireCoursework(recruitment.getType(), fields);
    requireUlaAnswers(recruitment.getType(), fields);

    Application application =
        Application.builder()
            .recruitmentId(recruitmentId)
            .email(currentEmail())
            .status(ApplicationReviewStatus.PENDING)
            .build();
    apply(fields, application, recruitment.getType());
    applicationRepository.save(application);
    return forApplicant(application);
  }

  @Operation(
      summary = "Enter a test application as an admin",
      description =
          "Lets an admin preview the form for a recruitment by submitting it as if they were an"
              + " applicant. The result is saved with testApplication=true. The type and open/closed"
              + " checks that apply to real applicants are skipped, so a recruitment can be tested"
              + " before it opens. An admin has at most one test application per recruitment:"
              + " submitting again replaces the earlier answers.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping("/test")
  public Application postTestApplication(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId,
      @RequestBody ApplicationFields fields) {

    Recruitment recruitment =
        recruitmentRepository
            .findById(recruitmentId)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, recruitmentId));
    requireAgreement(recruitment.getType(), fields);
    requireCoursework(recruitment.getType(), fields);
    requireUlaAnswers(recruitment.getType(), fields);

    // The unique (email, recruitment) constraint allows one row per admin per recruitment, and an
    // admin testing a form will naturally submit it more than once, so the second submission
    // overwrites the first rather than being refused.
    Optional<Application> existing =
        applicationRepository.findByEmailAndRecruitmentId(currentEmail(), recruitmentId);

    // An admin who is also a grad student may have a real application here; a test run must
    // never silently turn that into a test application.
    if (existing.isPresent() && !existing.get().isTestApplication()) {
      throw new IllegalArgumentException(
          "You already have a real application for this recruitment");
    }

    Application application =
        existing.orElseGet(
            () ->
                Application.builder()
                    .recruitmentId(recruitmentId)
                    .email(currentEmail())
                    .status(ApplicationReviewStatus.PENDING)
                    .testApplication(true)
                    .build());
    apply(fields, application, recruitment.getType());
    applicationRepository.save(application);
    return forApplicant(application);
  }

  @Operation(
      summary = "Edit an application",
      description =
          "Allowed for as long as the recruitment is open, whatever the primary consideration"
              + " date; refused once applications are closed.")
  @PreAuthorize("hasRole('ROLE_USER')")
  @PutMapping("")
  public Application updateApplication(
      @Parameter(name = "id") @RequestParam Long id, @RequestBody ApplicationFields fields) {

    Application application = mine(id);
    requireNotCancelled(application);
    Recruitment recruitment = recruitmentFor(application);
    if (!applicationAccessService.editable(recruitment)) {
      throw new ForbiddenException(
          "This application can no longer be edited; applications are closed");
    }
    requireAgreement(recruitment.getType(), fields);
    requireCoursework(recruitment.getType(), fields);
    requireUlaAnswers(recruitment.getType(), fields);

    apply(fields, application, recruitment.getType());
    applicationRepository.save(application);
    return forApplicant(application);
  }

  @Operation(
      summary = "Update post-application comments",
      description =
          "Kept apart from the rest of the application as the place for what has changed since"
              + " applying. Allowed while the recruitment is open and for six months after it"
              + " closes (issue #107).")
  @PreAuthorize("hasRole('ROLE_USER')")
  @PutMapping("/comments")
  public Application updateComments(
      @Parameter(name = "id") @RequestParam Long id,
      @Parameter(name = "postApplicationComments") @RequestParam String postApplicationComments) {

    Application application = mine(id);
    requireNotCancelled(application);
    if (!applicationAccessService.commentable(recruitmentFor(application), LocalDate.now())) {
      throw new ForbiddenException("This recruitment closed more than six months ago");
    }

    application.setPostApplicationComments(postApplicationComments);
    applicationRepository.save(application);
    return forApplicant(application);
  }

  @Operation(
      summary = "Cancel an application",
      description =
          "Marks the applicant's own application CANCELLED with the reason they gave (issue #107)."
              + " Final: a cancelled application cannot be edited, commented on or un-cancelled,"
              + " and the applicant cannot apply to that recruitment again.")
  @PreAuthorize("hasRole('ROLE_USER')")
  @PutMapping("/cancel")
  public Application cancelApplication(
      @Parameter(name = "id") @RequestParam Long id,
      @Parameter(name = "reason") @RequestParam String reason) {

    Application application = mine(id);
    requireNotCancelled(application);
    String why = blankToNull(reason);
    if (why == null) {
      throw new IllegalArgumentException(
          "Please give a brief reason for cancelling your application");
    }

    application.setStatus(ApplicationReviewStatus.CANCELLED);
    application.setCancellationReason(why);
    application.setCancelledAt(LocalDateTime.now());
    applicationRepository.save(application);
    return forApplicant(application);
  }

  /** A cancelled application is final: nothing about it may change. */
  private static void requireNotCancelled(Application application) {
    if (application.getStatus() == ApplicationReviewStatus.CANCELLED) {
      throw new ForbiddenException("This application was cancelled");
    }
  }

  /**
   * The course interests worth storing. The form sends only the answers that differ from the
   * default, but this does not rely on that: NOT_INTERESTED is dropped because it is the default,
   * and the first and second choice are dropped because they are recorded in their own fields and
   * the form does not even ask about them. A missing map means no answers.
   */
  static Map<String, CourseInterest> courseInterestsFrom(ApplicationFields fields) {
    Map<String, CourseInterest> interests = new HashMap<>();
    if (fields.courseInterests() != null) {
      interests.putAll(fields.courseInterests());
    }
    interests.values().removeIf(interest -> interest == CourseInterest.NOT_INTERESTED);
    interests.remove(fields.firstChoiceCourse());
    interests.remove(fields.secondChoiceCourse());
    return interests;
  }

  public static final int MIN_PROFICIENCY = 1;

  /** A TA applicant rates each topic 1 (lowest) to 5 (highest). */
  public static final int MAX_TA_PROFICIENCY = 5;

  /** A ULA applicant rates each topic 1 (very comfortable), 2 (somewhat) or 3 (not familiar). */
  public static final int MAX_ULA_PROFICIENCY = 3;

  /** A ULA applicant rates each interest area 1 (not interested) to 5 (very interested). */
  public static final int MIN_INTEREST = 1;

  public static final int MAX_INTEREST = 5;

  static int maxProficiency(RecruitmentType type) {
    return type == RecruitmentType.TA ? MAX_TA_PROFICIENCY : MAX_ULA_PROFICIENCY;
  }

  /**
   * The answers worth storing from a name-to-level map: every name answered for, each on the scale.
   * A missing map means no answers. A level outside the scale cannot come from the form's radio
   * buttons, so it is refused rather than clamped.
   */
  private static Map<String, Integer> levelsFrom(
      Map<String, Integer> sent, String what, int min, int max) {
    // Sorted by name so the JSON an application is returned as is stable.
    Map<String, Integer> levels = new TreeMap<>();
    for (Map.Entry<String, Integer> entry :
        (sent == null ? Map.<String, Integer>of() : sent).entrySet()) {
      Integer level = entry.getValue();
      if (level == null) {
        continue;
      }
      if (level < min || level > max) {
        throw new IllegalArgumentException(
            "%s in %s must be between %d and %d".formatted(what, entry.getKey(), min, max));
      }
      levels.put(entry.getKey(), level);
    }
    return levels;
  }

  /** The topic ratings worth storing, on the scale the form type uses. */
  static Map<String, Integer> topicProficienciesFrom(
      ApplicationFields fields, RecruitmentType type) {
    return levelsFrom(
        fields.topicProficiencies(), "Proficiency", MIN_PROFICIENCY, maxProficiency(type));
  }

  /** The interest levels worth storing; a TA form has no interests section, so none are kept. */
  static Map<String, Integer> interestsFrom(ApplicationFields fields, RecruitmentType type) {
    Map<String, Integer> sent = type == RecruitmentType.TA ? null : fields.interests();
    return levelsFrom(sent, "Interest", MIN_INTEREST, MAX_INTEREST);
  }

  /**
   * The agreement rule. Once a notice exists for the form type, every submission must carry the id
   * of a version of that type's notice: the one the applicant saw and ticked the box for. It need
   * not be the latest, since an admin may save a new version while a form is open; what matters is
   * that the applicant agreed to a real version, and that is what gets recorded. With no notice
   * written yet the form shows none, so nothing is required.
   */
  void requireAgreement(RecruitmentType type, ApplicationFields fields) {
    Long versionId = fields.noticeVersionId();
    if (versionId == null) {
      if (noticeVersionRepository.findFirstByTypeOrderByIdDesc(type).isPresent()) {
        throw new IllegalArgumentException(
            "You must agree to the Notices, Terms and Conditions to submit this application");
      }
      return;
    }
    NoticeVersion version =
        noticeVersionRepository
            .findById(versionId)
            .orElseThrow(() -> new EntityNotFoundException(NoticeVersion.class, versionId));
    if (version.getType() != type) {
      throw new IllegalArgumentException(
          "Notice version %d is not a %s notice".formatted(versionId, type));
    }
  }

  /** How many prior courses an application of this type must list. */
  static int minimumCourses(RecruitmentType type) {
    return type == RecruitmentType.TA ? MIN_TA_COURSES : MIN_ULA_COURSES;
  }

  /**
   * The prior coursework rule: enough rows for the form type, each with a course number, and a
   * school for any course not taken at UCSB. A UCSB course carries no other school, whatever the
   * client sent, so the two never disagree.
   */
  static void requireCoursework(RecruitmentType type, ApplicationFields fields) {
    List<PriorCourseworkFields> rows =
        fields.priorCoursework() == null ? List.of() : fields.priorCoursework();
    int minimum = minimumCourses(type);
    if (rows.size() < minimum) {
      throw new IllegalArgumentException(
          "A %s application must list at least %d prior course%s"
              .formatted(type, minimum, minimum == 1 ? "" : "s"));
    }
    for (PriorCourseworkFields row : rows) {
      if (row.courseNumber() == null || row.courseNumber().isBlank()) {
        throw new IllegalArgumentException("Every prior course needs a course number");
      }
      if (!row.ucsbCourse() && (row.otherSchool() == null || row.otherSchool().isBlank())) {
        throw new IllegalArgumentException(
            "Prior course %s needs the school it was taken at".formatted(row.courseNumber()));
      }
    }
  }

  /** A perm number is 7 letters or digits; see requireUlaAnswers. */
  static final Pattern PERM_NUMBER = Pattern.compile("[A-Z0-9]{7}");

  /** The perm number as stored: trimmed and upper case; a blank one is no answer. */
  public static String normalizePermNumber(String permNumber) {
    String text = blankToNull(permNumber);
    return text == null ? null : text.toUpperCase();
  }

  /**
   * The perm number rule, which holds whoever is saving: when one is given it must be exactly 7
   * letters or digits (checked after upper-casing, so case does not matter).
   */
  static void requirePermNumberFormat(ApplicationFields fields) {
    String perm = normalizePermNumber(fields.permNumber());
    if (perm != null && !PERM_NUMBER.matcher(perm).matches()) {
      throw new IllegalArgumentException(
          "Perm number must be exactly 7 characters, letters and digits only");
    }
  }

  /**
   * The questions a ULA applicant must answer, as on the Google Form the ULA application used to
   * be: the perm number, whether they are a BS/MS student, the two employment questions, and, for a
   * first-time applicant (no previous service), the training commitment. Since issue #78 also both
   * GPAs, the year in program, the expected graduation and the count of quarters served; since
   * issue #213 the I-9 confirmation, and a video link from a first-time applicant. A TA form
   * requires none of these. An admin editing an application is held only to the perm number's
   * format.
   */
  static void requireUlaAnswers(RecruitmentType type, ApplicationFields fields) {
    if (type != RecruitmentType.ULA) {
      return;
    }
    if (normalizePermNumber(fields.permNumber()) == null) {
      throw new IllegalArgumentException("A ULA application needs your perm number");
    }
    requirePermNumberFormat(fields);
    if (fields.bsMsStudent() == null) {
      throw new IllegalArgumentException("Please say whether you are a BS/MS student");
    }
    if (fields.otherCampusJob() == null) {
      throw new IllegalArgumentException(
          "Please say whether you will have another campus job this quarter");
    }
    if (fields.priorUcsbEmployment() == null) {
      throw new IllegalArgumentException("Please say whether you have been employed at UCSB");
    }
    if (fields.gpaMajor() == null) {
      throw new IllegalArgumentException("A ULA application needs your GPA in major");
    }
    if (fields.gpaOverall() == null) {
      throw new IllegalArgumentException("A ULA application needs your overall GPA");
    }
    if (blankToNull(fields.yearInProgram()) == null) {
      throw new IllegalArgumentException("A ULA application needs your year in program");
    }
    if (blankToNull(fields.graduationDate()) == null) {
      throw new IllegalArgumentException("A ULA application needs your expected graduation");
    }
    if (fields.previousServiceAsUla() == null) {
      throw new IllegalArgumentException(
          "A ULA application needs the number of quarters you have served as a ULA (0 if none)");
    }
    if (Integer.valueOf(0).equals(fields.previousServiceAsUla())
        && fields.trainingCommitment() == null) {
      throw new IllegalArgumentException(
          "As a first-time ULA applicant, please answer the training commitment question");
    }
    // Issue #213: a first-time applicant must give a video link, and everyone confirms the I-9.
    if (Integer.valueOf(0).equals(fields.previousServiceAsUla())
        && blankToNull(fields.videoLink()) == null) {
      throw new IllegalArgumentException(
          "As a first-time ULA applicant, please include a link to your video");
    }
    if (!Boolean.TRUE.equals(fields.i9Appointment())) {
      throw new IllegalArgumentException(
          "Please confirm that you will make an I-9 verification appointment if hired");
    }
  }

  /** Fresh rows from the request, trimmed; replaces whatever the application had. */
  static List<PriorCoursework> priorCourseworkFrom(ApplicationFields fields) {
    List<PriorCoursework> rows = new ArrayList<>();
    for (PriorCourseworkFields row : fields.priorCoursework()) {
      rows.add(
          PriorCoursework.builder()
              .ucsbCourse(row.ucsbCourse())
              .otherSchool(row.ucsbCourse() ? null : row.otherSchool().strip())
              .courseNumber(row.courseNumber().strip())
              .courseTitle(blankToNull(row.courseTitle()))
              .term(blankToNull(row.term()))
              .grade(blankToNull(row.grade()))
              .build());
    }
    return rows;
  }

  private static String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value.strip();
  }

  /** Copies the applicant-supplied fields; never status, email or recruitment. */
  static void apply(ApplicationFields fields, Application application, RecruitmentType type) {
    application.setFirstName(fields.firstName());
    application.setMiddleName(fields.middleName());
    application.setLastName(fields.lastName());
    application.setMajor(fields.major());
    application.setGpaMajor(fields.gpaMajor());
    application.setGpaOverall(fields.gpaOverall());
    application.setYearInProgram(fields.yearInProgram());
    application.setGraduationDate(fields.graduationDate());
    application.getPriorCoursework().clear();
    application.getPriorCoursework().addAll(priorCourseworkFrom(fields));
    application.setTopicProficiencies(topicProficienciesFrom(fields, type));
    application.setInterests(interestsFrom(fields, type));
    application.setPrevExperience(fields.prevExperience());
    application.setComments(fields.comments());
    application.setFirstChoiceCourse(fields.firstChoiceCourse());
    application.setSecondChoiceCourse(fields.secondChoiceCourse());
    // Only the ULA form asks about availability (issue #76); a TA application keeps none, even
    // when a pre-filled earlier answer comes along with the request.
    boolean asksAvailability = type == RecruitmentType.ULA;
    application.setAvailableForLecturesFirstChoice(
        asksAvailability && fields.availableForLecturesFirstChoice());
    application.setAvailableForLecturesSecondChoice(
        asksAvailability && fields.availableForLecturesSecondChoice());
    application.setAvailableForDiscussionFirstChoice(
        asksAvailability && fields.availableForDiscussionFirstChoice());
    application.setAvailableForDiscussionSecondChoice(
        asksAvailability && fields.availableForDiscussionSecondChoice());
    application.setAvailabilityCommentsFirstChoice(
        asksAvailability ? fields.availabilityCommentsFirstChoice() : null);
    application.setAvailabilityCommentsSecondChoice(
        asksAvailability ? fields.availabilityCommentsSecondChoice() : null);
    application.setCourseInterests(courseInterestsFrom(fields));
    application.setResidencyStatus(fields.residencyStatus());
    application.setLanguageExam(fields.languageExam());
    application.setLanguageExamDatePassed(fields.languageExamDatePassed());
    application.setClassLevel(fields.classLevel());
    application.setVideoLink(fields.videoLink());
    application.setPreviousServiceAsUla(fields.previousServiceAsUla());
    application.setPermNumber(normalizePermNumber(fields.permNumber()));
    application.setBsMsStudent(fields.bsMsStudent());
    application.setStudentStatusNextQuarter(fields.studentStatusNextQuarter());
    application.setWantsTaEligibility(fields.wantsTaEligibility());
    application.setOtherCampusJob(fields.otherCampusJob());
    application.setPriorUcsbEmployment(fields.priorUcsbEmployment());
    application.setEmployeeId(blankToNull(fields.employeeId()));
    application.setI9Appointment(fields.i9Appointment());
    application.setTrainingCommitment(fields.trainingCommitment());
    application.setTrainingCommitmentExplanation(
        blankToNull(fields.trainingCommitmentExplanation()));
    application.setChangingMajor(fields.changingMajor());
    application.setNoticeVersionId(fields.noticeVersionId());
  }
}
