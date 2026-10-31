package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.PublishedAssignmentsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.nio.charset.StandardCharsets;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The published assignments of a recruitment (issue #180), for admins and instructors: the table in
 * either layout, and the same table as a CSV file for the financial office. Nothing is served until
 * the admin has published.
 */
@Tag(name = "Assignments")
@RequestMapping("/api/assignments")
@RestController
public class AssignmentsController extends ApiController {
  @Autowired RecruitmentRepository recruitmentRepository;
  @Autowired PublishedAssignmentsService publishedAssignmentsService;

  @Operation(
      summary = "A recruitment's published assignments",
      description =
          "layout=course gives one row per course with the people assigned to it; layout=student"
              + " one row per TA or ULA with their course. 400 while the recruitment's assignments"
              + " are not published, or for another layout; 404 for a recruitment that does not"
              + " exist.")
  @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_INSTRUCTOR')")
  @GetMapping("")
  public PublishedAssignmentsService.Table table(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId,
      @Parameter(name = "layout", description = "course or student") @RequestParam String layout) {
    return publishedAssignmentsService.table(recruitmentOf(recruitmentId), layout);
  }

  @Operation(
      summary = "Download a recruitment's published assignments as CSV",
      description = "The same table as the JSON endpoint, in the same layout, every cell quoted.")
  @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_INSTRUCTOR')")
  @GetMapping(value = "/csv", produces = "text/csv")
  public ResponseEntity<String> csv(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId,
      @Parameter(name = "layout", description = "course or student") @RequestParam String layout) {
    String body = publishedAssignmentsService.csv(recruitmentOf(recruitmentId), layout);
    return ResponseEntity.ok()
        .header(
            HttpHeaders.CONTENT_DISPOSITION,
            "attachment; filename=\"assignments-%d-%s.csv\"".formatted(recruitmentId, layout))
        .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
        .body(body);
  }

  private Recruitment recruitmentOf(Long recruitmentId) {
    return recruitmentRepository
        .findById(recruitmentId)
        .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, recruitmentId));
  }
}
