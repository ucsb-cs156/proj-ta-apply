package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.NoticeVersion;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.CourseInterest;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.errors.ForbiddenException;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.NoticeVersionRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.ApplicationAccessService;
import edu.ucsb.cs.taapply.services.GrantedAuthoritiesService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
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
  @Autowired GrantedAuthoritiesService grantedAuthoritiesService;

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
      /** Topic name to self-rated proficiency 1..5; may be null or empty. */
      Map<String, Integer> topicProficiencies,
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
      LocalDate languageExamDatePassed,
      edu.ucsb.cs.taapply.enums.ClassLevel classLevel,
      String videoLink,
      Integer previousServiceAsUla,
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
  @PreAuthorize("hasAnyRole('ROLE_GRAD_STUDENT','ROLE_UNDERGRAD','ROLE_ADMIN')")
  @GetMapping("/mine")
  public List<Application> myApplications() {
    return applicationRepository.findByEmailOrderByIdDesc(currentEmail());
  }

  @Operation(
      summary = "One of the current user's applications",
      description = "403 for an application belonging to anyone else.")
  @PreAuthorize("hasAnyRole('ROLE_GRAD_STUDENT','ROLE_UNDERGRAD','ROLE_ADMIN')")
  @GetMapping("")
  public Application getApplication(@Parameter(name = "id") @RequestParam Long id) {
    return mine(id);
  }

  @Operation(
      summary = "The applicant's most recent application, for pre-filling a new one",
      description = "Empty if they have never applied.")
  @PreAuthorize("hasAnyRole('ROLE_GRAD_STUDENT','ROLE_UNDERGRAD','ROLE_ADMIN')")
  @GetMapping("/prefill")
  public List<Application> prefill() {
    return applicationRepository.findByEmailOrderByIdDesc(currentEmail()).stream()
        .limit(1)
        .toList();
  }

  @Operation(
      summary = "Apply to a recruitment",
      description =
          "Refused if the recruitment is not open, is not the type this user may apply to, or they"
              + " already have an application for it.")
  @PreAuthorize("hasAnyRole('ROLE_GRAD_STUDENT','ROLE_UNDERGRAD')")
  @PostMapping("/post")
  public Application postApplication(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId,
      @RequestBody ApplicationFields fields) {

    Recruitment recruitment =
        recruitmentRepository
            .findById(recruitmentId)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, recruitmentId));

    Optional<RecruitmentType> myType =
        applicationAccessService.applicableType(grantedAuthoritiesService.getGrantedAuthorities());

    // Enforced here, not merely by hiding a link: a grad student must not reach a ULA recruitment.
    // A user with no applicable type at all yields null, which matches no recruitment type.
    if (myType.orElse(null) != recruitment.getType()) {
      throw new ForbiddenException("You are not eligible to apply to this recruitment");
    }
    if (!applicationAccessService.acceptingApplications(recruitment)) {
      throw new IllegalArgumentException(
          "Applications are not currently open for this recruitment");
    }
    if (applicationRepository.existsByEmailAndRecruitmentId(currentEmail(), recruitmentId)) {
      throw new IllegalArgumentException("You already have an application for this recruitment");
    }

    requireAgreement(recruitment.getType(), fields);
    requireCoursework(recruitment.getType(), fields);

    Application application =
        Application.builder()
            .recruitmentId(recruitmentId)
            .email(currentEmail())
            .status(ApplicationReviewStatus.PENDING)
            .build();
    apply(fields, application);
    applicationRepository.save(application);
    return application;
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
    apply(fields, application);
    applicationRepository.save(application);
    return application;
  }

  @Operation(
      summary = "Edit an application",
      description =
          "Allowed while the recruitment is open and the primary consideration date has not passed."
              + " After that only post-application comments may change.")
  @PreAuthorize("hasAnyRole('ROLE_GRAD_STUDENT','ROLE_UNDERGRAD')")
  @PutMapping("")
  public Application updateApplication(
      @Parameter(name = "id") @RequestParam Long id, @RequestBody ApplicationFields fields) {

    Application application = mine(id);
    Recruitment recruitment = recruitmentFor(application);
    if (!applicationAccessService.editable(recruitment, LocalDate.now())) {
      throw new ForbiddenException(
          "This application can no longer be edited; you may still update your post application"
              + " comments");
    }
    requireAgreement(recruitment.getType(), fields);
    requireCoursework(recruitment.getType(), fields);

    apply(fields, application);
    applicationRepository.save(application);
    return application;
  }

  @Operation(
      summary = "Update post-application comments",
      description =
          "Separate from the rest of the application because it outlives the primary consideration"
              + " date. Refused once the recruitment closes.")
  @PreAuthorize("hasAnyRole('ROLE_GRAD_STUDENT','ROLE_UNDERGRAD')")
  @PutMapping("/comments")
  public Application updateComments(
      @Parameter(name = "id") @RequestParam Long id,
      @Parameter(name = "postApplicationComments") @RequestParam String postApplicationComments) {

    Application application = mine(id);
    if (!applicationAccessService.commentable(recruitmentFor(application))) {
      throw new ForbiddenException("This recruitment is closed");
    }

    application.setPostApplicationComments(postApplicationComments);
    applicationRepository.save(application);
    return application;
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
  public static final int MAX_PROFICIENCY = 5;

  /**
   * The topic ratings worth storing: every topic the applicant rated, each between 1 and 5. A
   * missing map means no ratings. A rating outside the scale cannot come from the form's radio
   * buttons, so it is refused rather than clamped.
   */
  static Map<String, Integer> topicProficienciesFrom(ApplicationFields fields) {
    // Sorted by topic so the JSON an application is returned as is stable.
    Map<String, Integer> proficiencies = new TreeMap<>();
    Map<String, Integer> sent =
        fields.topicProficiencies() == null ? Map.of() : fields.topicProficiencies();
    for (Map.Entry<String, Integer> entry : sent.entrySet()) {
      Integer level = entry.getValue();
      if (level == null) {
        continue;
      }
      if (level < MIN_PROFICIENCY || level > MAX_PROFICIENCY) {
        throw new IllegalArgumentException(
            "Proficiency in %s must be between %d and %d"
                .formatted(entry.getKey(), MIN_PROFICIENCY, MAX_PROFICIENCY));
      }
      proficiencies.put(entry.getKey(), level);
    }
    return proficiencies;
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
  private static void apply(ApplicationFields fields, Application application) {
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
    application.setTopicProficiencies(topicProficienciesFrom(fields));
    application.setPrevExperience(fields.prevExperience());
    application.setComments(fields.comments());
    application.setFirstChoiceCourse(fields.firstChoiceCourse());
    application.setSecondChoiceCourse(fields.secondChoiceCourse());
    application.setAvailableForLecturesFirstChoice(fields.availableForLecturesFirstChoice());
    application.setAvailableForLecturesSecondChoice(fields.availableForLecturesSecondChoice());
    application.setAvailableForDiscussionFirstChoice(fields.availableForDiscussionFirstChoice());
    application.setAvailableForDiscussionSecondChoice(fields.availableForDiscussionSecondChoice());
    application.setAvailabilityCommentsFirstChoice(fields.availabilityCommentsFirstChoice());
    application.setAvailabilityCommentsSecondChoice(fields.availabilityCommentsSecondChoice());
    application.setCourseInterests(courseInterestsFrom(fields));
    application.setResidencyStatus(fields.residencyStatus());
    application.setLanguageExam(fields.languageExam());
    application.setLanguageExamDatePassed(fields.languageExamDatePassed());
    application.setClassLevel(fields.classLevel());
    application.setVideoLink(fields.videoLink());
    application.setPreviousServiceAsUla(fields.previousServiceAsUla());
    application.setNoticeVersionId(fields.noticeVersionId());
  }
}
