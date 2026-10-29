package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * An admin's view of the applications to a recruitment: the whole list, one application in full,
 * and the admin's own comments on it. Nothing here changes what the applicant wrote.
 */
@Tag(name = "AdminApplications")
@RequestMapping("/api/admin/applications")
@RestController
@Slf4j
public class AdminApplicationsController extends ApiController {

  @Autowired ApplicationRepository applicationRepository;
  @Autowired RecruitmentRepository recruitmentRepository;

  @Operation(
      summary = "Every application to a recruitment, oldest first",
      description =
          "Test applications are included, flagged by testApplication, so the page can set them"
              + " apart. 404 for a recruitment that does not exist.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/all")
  public List<Application> allForRecruitment(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId) {
    if (!recruitmentRepository.existsById(recruitmentId)) {
      throw new EntityNotFoundException(Recruitment.class, recruitmentId);
    }
    return applicationRepository.findByRecruitmentIdOrderByIdAsc(recruitmentId);
  }

  @Operation(summary = "One application, whoever it belongs to")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("")
  public Application getApplication(@Parameter(name = "id") @RequestParam Long id) {
    return applicationRepository
        .findById(id)
        .orElseThrow(() -> new EntityNotFoundException(Application.class, id));
  }

  @Operation(
      summary = "Save the admin's comments on an application",
      description =
          "Free text, kept apart from the applicant's own answers; replaces the earlier text.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PutMapping("/adminComments")
  public Application updateAdminComments(
      @Parameter(name = "id") @RequestParam Long id,
      @Parameter(name = "adminComments") @RequestParam String adminComments) {
    Application application =
        applicationRepository
            .findById(id)
            .orElseThrow(() -> new EntityNotFoundException(Application.class, id));
    application.setAdminComments(adminComments);
    applicationRepository.save(application);
    return application;
  }
}
