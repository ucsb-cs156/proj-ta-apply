package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.errors.ForbiddenException;
import edu.ucsb.cs.taapply.models.CourseSections;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.ApplicationAccessService;
import edu.ucsb.cs.taapply.services.GrantedAuthoritiesService;
import edu.ucsb.cs.taapply.services.RoleAssignmentService;
import edu.ucsb.cs.taapply.services.UCSBCurriculumService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * What an applicant needs to know about recruitments: whether they can apply now, when a past one
 * ran, and when an upcoming one is expected to open.
 *
 * <p>Every response is filtered to the type the current user may apply to, so a grad student is
 * never shown a ULA recruitment and vice versa. That filtering happens here rather than in the
 * page, so it cannot be bypassed.
 */
@Tag(name = "ApplicantRecruitments")
@RequestMapping("/api/recruitments")
@RestController
@Slf4j
public class ApplicantRecruitmentsController extends ApiController {

  @Autowired RecruitmentRepository recruitmentRepository;
  @Autowired RecruitmentCourseRepository recruitmentCourseRepository;
  @Autowired ApplicationAccessService applicationAccessService;
  @Autowired GrantedAuthoritiesService grantedAuthoritiesService;
  @Autowired UCSBCurriculumService ucsbCurriculumService;

  private Optional<RecruitmentType> myType() {
    return applicationAccessService.applicableType(
        grantedAuthoritiesService.getGrantedAuthorities());
  }

  private List<Recruitment> ofMyType() {
    return myType()
        .map(
            type ->
                recruitmentRepository.findAllByOrderByQuarterDescTypeAsc().stream()
                    .filter(r -> r.getType() == type)
                    .toList())
        .orElse(List.of());
  }

  @Operation(
      summary = "Open recruitments the current user may apply to",
      description = "Empty for a user who is neither a grad student nor an undergrad.")
  @PreAuthorize("hasAnyRole('ROLE_GRAD_STUDENT','ROLE_UNDERGRAD','ROLE_ADMIN')")
  @GetMapping("/open")
  public List<Recruitment> openRecruitments() {
    return ofMyType().stream().filter(applicationAccessService::acceptingApplications).toList();
  }

  @Operation(
      summary = "Recruitments created but not yet opened",
      description = "So the home page can show when applications are expected to open.")
  @PreAuthorize("hasAnyRole('ROLE_GRAD_STUDENT','ROLE_UNDERGRAD','ROLE_ADMIN')")
  @GetMapping("/upcoming")
  public List<Recruitment> upcomingRecruitments() {
    // Never opened is the whole test: actualOpeningDate is stamped the first time a recruitment
    // opens and never cleared, so a null one has not opened yet and is necessarily still closed.
    return ofMyType().stream().filter(r -> r.getActualOpeningDate() == null).toList();
  }

  @Operation(
      summary = "The most recently closed recruitment of the user's type",
      description = "So the home page can say when the last round opened and closed.")
  @PreAuthorize("hasAnyRole('ROLE_GRAD_STUDENT','ROLE_UNDERGRAD','ROLE_ADMIN')")
  @GetMapping("/recentlyClosed")
  public List<Recruitment> recentlyClosed() {
    // Both conditions matter: a reopened recruitment keeps the closing date of its earlier round,
    // so having closed once is not enough; it has to be closed now.
    // Already sorted most recent quarter first, so the first match is the one to show.
    return ofMyType().stream()
        .filter(r -> r.getApplicationStatus() == ApplicationStatus.CLOSED)
        .filter(r -> r.getActualClosingDate() != null)
        .limit(1)
        .toList();
  }

  @Operation(
      summary = "Every recruitment the current user could apply to, past or present",
      description =
          "So a listing of their own applications can name the quarter and dates behind each one.")
  @PreAuthorize("hasAnyRole('ROLE_GRAD_STUDENT','ROLE_UNDERGRAD','ROLE_ADMIN')")
  @GetMapping("/applicable")
  public List<Recruitment> applicableRecruitments() {
    return ofMyType();
  }

  @Operation(
      summary = "The course numbers an applicant may choose from",
      description =
          "Distinct and sorted, since a course with two lectures appears twice in the recruitment."
              + " Empty for a recruitment the current user may not apply to.")
  @PreAuthorize("hasAnyRole('ROLE_GRAD_STUDENT','ROLE_UNDERGRAD','ROLE_ADMIN')")
  @GetMapping("/courses")
  public List<String> courseChoices(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId) {

    // Answering only for a recruitment of their own type keeps this from becoming a way to read
    // the other side's course list.
    boolean mine = ofMyType().stream().anyMatch(r -> r.getId().equals(recruitmentId));
    if (!mine) {
      return List.of();
    }

    return recruitmentCourseRepository.findByRecruitmentId(recruitmentId).stream()
        .filter(c -> !c.isRemoved())
        .map(c -> c.getCourseId())
        .distinct()
        .sorted()
        .toList();
  }

  @Operation(
      summary = "When a course's lectures and sections meet",
      description =
          "Looked up live from the UCSB API via the enroll code of the course's lecture in the"
              + " recruitment, so an applicant choosing the course can see whether they are free."
              + " 404 for a recruitment that does not exist; 403 for one the current user may not"
              + " apply to, unless they are an admin previewing the form. A course the recruitment"
              + " does not list comes back with no meetings rather than an error.")
  @PreAuthorize("hasAnyRole('ROLE_GRAD_STUDENT','ROLE_UNDERGRAD','ROLE_ADMIN')")
  @GetMapping("/sections")
  public CourseSections courseSections(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId,
      @Parameter(name = "courseId", description = "Padded course id, e.g. \"CMPSC   156\"")
          @RequestParam
          String courseId)
      throws Exception {

    Recruitment recruitment =
        recruitmentRepository
            .findById(recruitmentId)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, recruitmentId));

    // An admin trying the form (TestApplicationPage) has no applicable type but needs the card;
    // everyone else only gets answers about recruitments of their own type.
    boolean admin =
        grantedAuthoritiesService.getGrantedAuthorities().stream()
            .anyMatch(a -> RoleAssignmentService.ROLE_ADMIN.equals(a.getAuthority()));
    if (!admin && myType().orElse(null) != recruitment.getType()) {
      throw new ForbiddenException("That recruitment is not one you can apply to");
    }

    // Any one lecture's enroll code finds the whole offering, every section included, so the
    // lowest is as good as any and keeps the request the same from one call to the next.
    Optional<String> enrollCode =
        recruitmentCourseRepository.findByRecruitmentId(recruitmentId).stream()
            .filter(c -> !c.isRemoved() && courseId.equals(c.getCourseId()))
            .map(RecruitmentCourse::getEnrollCode)
            .sorted()
            .findFirst();
    if (enrollCode.isEmpty()) {
      return CourseSections.none(courseId, recruitment.getQuarter());
    }

    return CourseSections.from(
        courseId,
        recruitment.getQuarter(),
        ucsbCurriculumService.getOffering(recruitment.getQuarter(), enrollCode.get()));
  }
}
