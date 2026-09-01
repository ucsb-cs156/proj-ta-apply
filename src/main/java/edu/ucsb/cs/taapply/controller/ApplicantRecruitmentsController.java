package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.ApplicationAccessService;
import edu.ucsb.cs.taapply.services.GrantedAuthoritiesService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
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
  @Autowired ApplicationAccessService applicationAccessService;
  @Autowired GrantedAuthoritiesService grantedAuthoritiesService;

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
}
