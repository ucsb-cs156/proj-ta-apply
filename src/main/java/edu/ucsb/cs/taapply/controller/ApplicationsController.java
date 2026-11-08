package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.concurrency.ClientActivityDetector;
import edu.ucsb.cs.taapply.concurrency.ClientIdentity;
import edu.ucsb.cs.taapply.concurrency.ConcurrencyHeaders;
import edu.ucsb.cs.taapply.concurrency.Presence;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.NoticeVersion;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.enums.ApplicationOrigin;
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
import edu.ucsb.cs.taapply.services.DraftApplicationService;
import edu.ucsb.cs.taapply.services.TaSeedFromUla;
import edu.ucsb.cs.taapply.time.AppTime;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
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
  @Autowired DraftApplicationService draftApplicationService;
  @Autowired RecruitmentRepository recruitmentRepository;
  @Autowired NoticeVersionRepository noticeVersionRepository;
  @Autowired ApplicationAccessService applicationAccessService;
  @Autowired ClientActivityDetector clientActivityDetector;

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
      Long noticeVersionId,
      /**
       * Issue #292: the applicant has no GPAs yet (a first quarter grad student on a TA form, a
       * first quarter at UCSB on a ULA one). The GPAs are then not required and are stored empty.
       */
      Boolean firstQuarter) {

    /** Whether the applicant ticked the first quarter box; no answer is not ticked. */
    public boolean firstQuarterTicked() {
      return Boolean.TRUE.equals(firstQuarter);
    }
  }

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
              + " Empty if they have never applied. With type=TA (issue #307), their most recent"
              + " TA application if they have one, as is; otherwise, if they have a ULA"
              + " application, a TA-shaped seed built from the most recent of those (only the"
              + " answers that carry over, see TaSeedFromUla); otherwise empty. Any other type, or"
              + " none, behaves as without the parameter.")
  @PreAuthorize("hasRole('ROLE_USER')")
  @GetMapping("/prefill")
  public List<Application> prefill(
      @Parameter(name = "type") @RequestParam(required = false) RecruitmentType type) {
    List<Application> mine = applicationRepository.findByEmailOrderByIdDesc(currentEmail());
    // By recruitment quarter rather than by id: an application imported from the legacy app's
    // data gets a newer id than one the student made since, yet is the older of the two.
    Map<Long, Recruitment> recruitments = new HashMap<>();
    recruitmentRepository
        .findAllById(mine.stream().map(Application::getRecruitmentId).toList())
        .forEach(r -> recruitments.put(r.getId(), r));
    List<Application> newestFirst =
        mine.stream()
            .sorted(
                Comparator.comparing(
                        (Application a) ->
                            Optional.ofNullable(recruitments.get(a.getRecruitmentId()))
                                .map(Recruitment::getQuarter)
                                .orElse(""))
                    .reversed())
            .toList();
    if (type == RecruitmentType.TA) {
      Optional<Application> ta = newestOfType(newestFirst, recruitments, RecruitmentType.TA);
      if (ta.isPresent()) {
        return List.of(forApplicant(ta.get()));
      }
      return newestOfType(newestFirst, recruitments, RecruitmentType.ULA)
          .map(TaSeedFromUla::seed)
          .stream()
          .toList();
    }
    return newestFirst.stream().limit(1).map(ApplicationsController::forApplicant).toList();
  }

  private static Optional<Application> newestOfType(
      List<Application> newestFirst, Map<Long, Recruitment> recruitments, RecruitmentType type) {
    return newestFirst.stream()
        .filter(
            a ->
                Optional.ofNullable(recruitments.get(a.getRecruitmentId()))
                    .map(r -> r.getType() == type)
                    .orElse(false))
        .findFirst();
  }

  @Operation(
      summary = "Apply to a recruitment",
      description =
          "Any signed-in user may apply to any open recruitment, TA or ULA. Refused if the"
              + " recruitment is not open or they already have an application for it that is not"
              + " cancelled: one who cancelled may apply again while applications are open, as if"
              + " from scratch, and the cancelled application is kept (issue #318).")
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
    // A cancelled application does not block a new one while applications are open (issue #318).
    draftApplicationService.requireNoApplication(currentEmail(), recruitmentId);

    requireAgreement(recruitment.getType(), fields);
    requireCoursework(recruitment.getType(), fields);
    requireUlaAnswers(recruitment.getType(), fields);
    requireTaAnswers(recruitment.getType(), fields);

    Application application =
        Application.builder()
            .recruitmentId(recruitmentId)
            .email(currentEmail())
            .status(ApplicationReviewStatus.PENDING)
            // The first, or one more than the cancelled ones before it, which are kept (issue
            // #318).
            .attemptNumber(
                (int)
                        applicationRepository.countByEmailAndRecruitmentId(
                            currentEmail(), recruitmentId)
                    + 1)
            .build();
    apply(fields, application, recruitment.getType());
    // The application is complete now, so the draft it grew from has done its job (issue #270);
    // the admin's comments on it move to the application (issue #296). The save and the deletes
    // are one transaction (issue #417).
    draftApplicationService.submit(application);
    return forApplicant(application);
  }

  @Operation(
      summary = "Enter a test application as an admin",
      description =
          "Lets an admin preview the form for a recruitment by submitting it as if they were an"
              + " applicant. The result is saved with origin=ADMIN_TEST. The type and open/closed"
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
    requireTaAnswers(recruitment.getType(), fields);

    // An admin has one live row per recruitment, and an admin testing a form will naturally submit
    // it more than once, so the second submission overwrites the first rather than being refused.
    // Rows the admin cancelled are kept and set aside (issue #318).
    Optional<Application> existing =
        applicationRepository
            .findByEmailAndRecruitmentIdOrderByIdDesc(currentEmail(), recruitmentId)
            .stream()
            .filter(a -> a.getStatus() != ApplicationReviewStatus.CANCELLED)
            .findFirst();

    // An admin who is also a grad student may have a real application here; a test run must
    // never silently turn that into a test application.
    if (existing.isPresent() && existing.get().getOrigin() != ApplicationOrigin.ADMIN_TEST) {
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
                    .origin(ApplicationOrigin.ADMIN_TEST)
                    .attemptNumber(
                        (int)
                                applicationRepository.countByEmailAndRecruitmentId(
                                    currentEmail(), recruitmentId)
                            + 1)
                    .build());
    apply(fields, application, recruitment.getType());
    applicationRepository.save(application);
    return forApplicant(application);
  }

  @Operation(
      summary = "Edit an application",
      description =
          "Allowed for as long as the recruitment is open, whatever the primary consideration"
              + " date; refused once applications are closed. The version is the one the form last"
              + " saw (from the application as fetched); if the application has been saved since, by"
              + " an admin or another tab or window, nothing is changed and the answer is 409"
              + " Conflict with the application as it now stands (issue #302). A save that names its"
              + " client (X-Client-Id) also tells the server this tab or window is working on the"
              + " application, for the multi-tab warning; see the heartbeat.")
  @PreAuthorize("hasRole('ROLE_USER')")
  @PutMapping("")
  public ResponseEntity<Object> updateApplication(
      @Parameter(name = "id") @RequestParam Long id,
      @Parameter(name = "version") @RequestParam Integer version,
      @RequestHeader(value = ConcurrencyHeaders.CLIENT_ID, required = false) String clientId,
      @RequestBody ApplicationFields fields) {

    Application application = mine(id);
    clientActivityDetector.note(resourceKey(id), clientId, identity());
    requireNotCancelled(application);
    Recruitment recruitment = recruitmentFor(application);
    if (!applicationAccessService.editable(recruitment)) {
      throw new ForbiddenException(
          "This application can no longer be edited; applications are closed");
    }
    if (!version.equals(application.getVersion())) {
      return conflict(application, true);
    }
    requireAgreement(recruitment.getType(), fields);
    requireCoursework(recruitment.getType(), fields);
    requireUlaAnswers(recruitment.getType(), fields);
    requireTaAnswers(recruitment.getType(), fields);

    apply(fields, application, recruitment.getType());
    try {
      return ResponseEntity.ok(forApplicant(applicationRepository.save(application)));
    } catch (ObjectOptimisticLockingFailureException e) {
      // Another save got in between reading the application and writing it.
      return conflict(applicationRepository.findById(id).orElseThrow(() -> e), true);
    }
  }

  /**
   * What a refused edit tells the form: why, and the application as it now stands, without the
   * admin's notes if the form is the applicant's (issue #302).
   */
  static ResponseEntity<Object> conflict(Application current, boolean forApplicant) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put(
        "message",
        "This application was changed in another tab or window, or by an admin. Reload to see"
            + " the latest version.");
    body.put("version", current.getVersion());
    body.put("application", forApplicant ? forApplicant(current) : current);
    return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
  }

  /** The detector's name for an application, shared by the applicant's and the admin's pages. */
  static String resourceKey(Long id) {
    return "application:" + id;
  }

  /**
   * Who a user is to the detector (issue #302): the email address is the person, and the label
   * other people see is the email address followed by the full name in parentheses, or the email
   * address alone if there is no name. Whether they are an admin is passed on so that the other
   * side's page can choose its message.
   */
  static ClientIdentity identityOf(User user, boolean admin) {
    String name = user.getFullName();
    String label =
        name == null || name.isBlank()
            ? user.getEmail()
            : user.getEmail() + " (" + name.trim() + ")";
    return new ClientIdentity(user.getEmail(), label, admin);
  }

  /** Whether the signed-in user holds the admin role. */
  private boolean isAdmin() {
    return getCurrentUser().getRoles().stream()
        .map(GrantedAuthority::getAuthority)
        .anyMatch("ROLE_ADMIN"::equals);
  }

  private ClientIdentity identity() {
    return identityOf(getCurrentUser().getUser(), isAdmin());
  }

  /**
   * Refuses anyone but the application's owner or an admin; nothing is recorded or told to anyone
   * until this has returned.
   */
  private void requireOwnerOrAdmin(Long id) {
    Application application =
        applicationRepository
            .findById(id)
            .orElseThrow(() -> new EntityNotFoundException(Application.class, id));
    if (!currentEmail().equals(application.getEmail()) && !isAdmin()) {
      throw new ForbiddenException("That application belongs to someone else");
    }
  }

  @Operation(
      summary =
          "Say that this tab or window still has the application open, and learn who else does",
      description =
          "Used by the applicant's page and by the admin's edit page alike (issue #302). Changes"
              + " nothing about the application, not even its version. Tells the server this client"
              + " (X-Client-Id) is still here, and answers with the other people who have the"
              + " application open (a label for each, whether it is the same person in another tab"
              + " or window, and whether they are an admin) and how often to send this. Only the"
              + " application's owner or an admin may ask; for anyone else the answer is 403 and"
              + " nothing is recorded or told.")
  @PreAuthorize("hasRole('ROLE_USER')")
  @PostMapping("/heartbeat")
  public Presence heartbeat(
      @Parameter(name = "id") @RequestParam Long id,
      @RequestHeader(value = ConcurrencyHeaders.CLIENT_ID, required = false) String clientId) {
    // The check comes first and throws, so that nothing below runs for anyone else: they are
    // neither recorded nor told who is working here.
    requireOwnerOrAdmin(id);
    return clientActivityDetector.heartbeat(resourceKey(id), clientId, identity());
  }

  @Operation(
      summary = "Say that this tab or window has left the application",
      description =
          "Sent when a tab or window is closed or moves away from the application, so that the"
              + " others stop being warned about it at once. Allowed to someone exactly when a"
              + " heartbeat is: the application's owner or an admin, and for anyone else nothing is"
              + " recorded. The answer is 204 whether or not the client was known.")
  @PreAuthorize("hasRole('ROLE_USER')")
  @PostMapping("/leave")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void leave(
      @Parameter(name = "id") @RequestParam Long id,
      @RequestHeader(value = ConcurrencyHeaders.CLIENT_ID, required = false) String clientId) {
    requireOwnerOrAdmin(id);
    clientActivityDetector.leave(resourceKey(id), clientId);
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
    if (!applicationAccessService.commentable(recruitmentFor(application), AppTime.today())) {
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
              + " but, while applications are open, the applicant may start a new application to that"
              + " recruitment (issue #318).")
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
    application.setCancelledAt(AppTime.now());
    applicationRepository.save(application);
    // The applicant leaves the assignments page, so a page that still shows them is out of date.
    recruitmentRepository.bumpAssignmentsVersion(application.getRecruitmentId());
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
    requireCourseworkLengths(fields);
    List<PriorCourseworkFields> rows =
        fields.priorCoursework() == null ? List.of() : fields.priorCoursework();
    int minimum = minimumCourses(type);
    // Identical rows are saved as one (issue #334), so they count as one.
    List<PriorCourseworkFields> distinct =
        PriorCoursework.collapse(
            rows,
            row ->
                PriorCoursework.key(
                    row.ucsbCourse(), row.otherSchool(), row.courseNumber(), row.term()));
    if (distinct.size() < minimum) {
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

  /** The longest grade the {@code prior_coursework.grade} column holds (issue #323). */
  public static final int MAX_GRADE_LENGTH = 16;

  /** The longest term the {@code prior_coursework.term} column holds. */
  public static final int MAX_TERM_LENGTH = 64;

  /** The longest school, course number or course title the columns hold. */
  public static final int MAX_COURSE_TEXT_LENGTH = 255;

  /**
   * The length rule for every save path, drafts included (issue #323): a value longer than its
   * column is refused with a clear message, never truncated. Lengths are those of the value as it
   * would be stored, that is, without surrounding spaces.
   */
  public static void requireCourseworkLengths(ApplicationFields fields) {
    if (fields.priorCoursework() == null) {
      return;
    }
    for (PriorCourseworkFields row : fields.priorCoursework()) {
      requireLength(row.grade(), MAX_GRADE_LENGTH, "Grade");
      requireLength(row.term(), MAX_TERM_LENGTH, "Term");
      requireLength(row.otherSchool(), MAX_COURSE_TEXT_LENGTH, "Other school");
      requireLength(row.courseNumber(), MAX_COURSE_TEXT_LENGTH, "Course number");
      requireLength(row.courseTitle(), MAX_COURSE_TEXT_LENGTH, "Course title");
    }
  }

  private static void requireLength(String value, int max, String what) {
    if (value != null && value.strip().length() > max) {
      throw new IllegalArgumentException(
          "%s must be at most %d characters (%d given)"
              .formatted(what, max, value.strip().length()));
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
    if (!fields.firstQuarterTicked() && fields.gpaMajor() == null) {
      throw new IllegalArgumentException("A ULA application needs your GPA in major");
    }
    if (!fields.firstQuarterTicked() && fields.gpaOverall() == null) {
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

  /**
   * The questions a TA applicant must answer (issue #214): PhD or MS, residency status, both GPAs,
   * the year in program, the expected graduation and the language exam status; and, when the exam
   * was passed, the quarter and year it was passed. A ULA form requires none of these here (its own
   * rule covers the academic answers). An admin editing an application is not held to them.
   */
  static void requireTaAnswers(RecruitmentType type, ApplicationFields fields) {
    if (type != RecruitmentType.TA) {
      return;
    }
    if (fields.classLevel() == null) {
      throw new IllegalArgumentException("Please say whether you are a PhD or MS student");
    }
    if (fields.residencyStatus() == null) {
      throw new IllegalArgumentException("A TA application needs your residency status");
    }
    if (!fields.firstQuarterTicked() && fields.gpaMajor() == null) {
      throw new IllegalArgumentException("A TA application needs your GPA in major");
    }
    if (!fields.firstQuarterTicked() && fields.gpaOverall() == null) {
      throw new IllegalArgumentException("A TA application needs your overall GPA");
    }
    if (blankToNull(fields.yearInProgram()) == null) {
      throw new IllegalArgumentException("A TA application needs your year in program");
    }
    if (blankToNull(fields.graduationDate()) == null) {
      throw new IllegalArgumentException("A TA application needs your expected graduation");
    }
    if (fields.languageExam() == null) {
      throw new IllegalArgumentException("A TA application needs your TA language exam status");
    }
    if (examPassed(fields.languageExam()) && blankToNull(fields.languageExamDatePassed()) == null) {
      throw new IllegalArgumentException(
          "Please give the quarter and year you passed the TA language exam");
    }
  }

  /** The two answers that say the TA language exam was passed; "not passed" is not one of them. */
  static boolean examPassed(edu.ucsb.cs.taapply.enums.LanguageExamStatus languageExam) {
    return languageExam == edu.ucsb.cs.taapply.enums.LanguageExamStatus.PASSED_US_PERMANENT_RESIDENT
        || languageExam == edu.ucsb.cs.taapply.enums.LanguageExamStatus.PASSED_F1_OR_J1_VISA;
  }

  /**
   * Fresh rows from the request, trimmed; replaces whatever the application had. Identical courses
   * are collapsed to one row (issue #334).
   */
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
    return PriorCoursework.collapse(rows);
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
    // Issue #292: a first quarter applicant has no GPAs, so any typed before the box was ticked
    // are dropped rather than kept beside a flag that says there are none.
    application.setFirstQuarter(fields.firstQuarterTicked());
    application.setGpaMajor(fields.firstQuarterTicked() ? null : fields.gpaMajor());
    application.setGpaOverall(fields.firstQuarterTicked() ? null : fields.gpaOverall());
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
