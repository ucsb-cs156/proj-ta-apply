package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.errors.ForbiddenException;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.ApplicationAccessService;
import edu.ucsb.cs.taapply.services.GrantedAuthoritiesService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
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
      String courseworkUcsb,
      String knowledge,
      String prevExperience,
      String desiredCourses,
      String comments,
      String firstChoiceCourse,
      String secondChoiceCourse,
      boolean availableForLecturesFirstChoice,
      boolean availableForLecturesSecondChoice,
      boolean availableForDiscussionFirstChoice,
      boolean availableForDiscussionSecondChoice,
      edu.ucsb.cs.taapply.enums.ResidencyStatus residencyStatus,
      edu.ucsb.cs.taapply.enums.LanguageExamStatus languageExam,
      LocalDate languageExamDatePassed,
      edu.ucsb.cs.taapply.enums.ClassLevel classLevel,
      String courseworkOther,
      String coursework290,
      String videoLink,
      Integer previousServiceAsUla) {}

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
      summary = "Edit an application",
      description =
          "Allowed while the recruitment is open and the primary consideration date has not passed."
              + " After that only post-application comments may change.")
  @PreAuthorize("hasAnyRole('ROLE_GRAD_STUDENT','ROLE_UNDERGRAD')")
  @PutMapping("")
  public Application updateApplication(
      @Parameter(name = "id") @RequestParam Long id, @RequestBody ApplicationFields fields) {

    Application application = mine(id);
    if (!applicationAccessService.editable(recruitmentFor(application), LocalDate.now())) {
      throw new ForbiddenException(
          "This application can no longer be edited; you may still update your post application"
              + " comments");
    }

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
    application.setCourseworkUcsb(fields.courseworkUcsb());
    application.setKnowledge(fields.knowledge());
    application.setPrevExperience(fields.prevExperience());
    application.setDesiredCourses(fields.desiredCourses());
    application.setComments(fields.comments());
    application.setFirstChoiceCourse(fields.firstChoiceCourse());
    application.setSecondChoiceCourse(fields.secondChoiceCourse());
    application.setAvailableForLecturesFirstChoice(fields.availableForLecturesFirstChoice());
    application.setAvailableForLecturesSecondChoice(fields.availableForLecturesSecondChoice());
    application.setAvailableForDiscussionFirstChoice(fields.availableForDiscussionFirstChoice());
    application.setAvailableForDiscussionSecondChoice(fields.availableForDiscussionSecondChoice());
    application.setResidencyStatus(fields.residencyStatus());
    application.setLanguageExam(fields.languageExam());
    application.setLanguageExamDatePassed(fields.languageExamDatePassed());
    application.setClassLevel(fields.classLevel());
    application.setCourseworkOther(fields.courseworkOther());
    application.setCoursework290(fields.coursework290());
    application.setVideoLink(fields.videoLink());
    application.setPreviousServiceAsUla(fields.previousServiceAsUla());
  }
}
