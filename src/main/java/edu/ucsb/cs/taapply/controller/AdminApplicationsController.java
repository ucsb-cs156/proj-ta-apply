package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.controller.ApplicationsController.ApplicationFields;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.AuditTrail;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.ApplicationAuditService;
import edu.ucsb.cs.taapply.services.ApplicationCsvService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
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
  @Autowired ApplicationCsvService applicationCsvService;
  @Autowired ApplicationAuditService applicationAuditService;

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

  @Operation(
      summary = "Every application to a recruitment as a CSV file",
      description =
          "One row per application, test applications included and flagged. The columns differ by"
              + " form type; the one-to-many answers are folded into one column each (courses"
              + " separated by semicolons, their fields by commas; ratings as name:value pairs"
              + " separated by commas). 404 for a recruitment that does not exist.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping(value = "/csv", produces = "text/csv")
  public ResponseEntity<String> downloadCsv(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId) {
    Recruitment recruitment =
        recruitmentRepository
            .findById(recruitmentId)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, recruitmentId));
    String csv =
        applicationCsvService.write(
            recruitment.getType(),
            applicationRepository.findByRecruitmentIdOrderByIdAsc(recruitmentId));
    return ResponseEntity.ok()
        .header(
            HttpHeaders.CONTENT_DISPOSITION,
            "attachment; filename=\"applications-%d.csv\"".formatted(recruitmentId))
        .contentType(new MediaType("text", "csv"))
        .body(csv);
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
      summary = "Edit a student's application as an admin, recording every change",
      description =
          "Takes the same fields as the applicant's own edit, with no deadline or open/closed rule:"
              + " an admin may correct an application at any time. Each field whose value changes"
              + " gets a row in the audit trail. The coursework minimum still applies; the notice"
              + " agreement rule does not, since the applicant agreed, not the admin. 404 for an"
              + " application that does not exist.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PutMapping("")
  public Application editApplication(
      @Parameter(name = "id") @RequestParam Long id, @RequestBody ApplicationFields fields) {
    Application application =
        applicationRepository
            .findById(id)
            .orElseThrow(() -> new EntityNotFoundException(Application.class, id));
    Recruitment recruitment =
        recruitmentRepository
            .findById(application.getRecruitmentId())
            .orElseThrow(
                () ->
                    new EntityNotFoundException(Recruitment.class, application.getRecruitmentId()));
    ApplicationsController.requireCoursework(recruitment.getType(), fields);

    ApplicationAuditService.Snapshot before = applicationAuditService.snapshot(application);
    ApplicationsController.apply(fields, application, recruitment.getType());
    applicationRepository.save(application);
    List<AuditTrail> changes =
        applicationAuditService.record(before, application, recruitment.getType());
    log.info("Admin edited application {}: {} field(s) changed", id, changes.size());
    return application;
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
