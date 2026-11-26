package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.SoftOffersService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.nio.charset.StandardCharsets;
import lombok.extern.slf4j.Slf4j;
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
 * The admin's Soft Offer Results (issue #487): the assigned ULAs with their answers, and the same
 * table as a CSV. For admins and hiring staff (issue #505), never instructors or students: the
 * answers carry the applicants' comments.
 */
@Tag(name = "Soft Offers (admin)")
@RequestMapping("/api/admin/softOffers")
@RestController
@Slf4j
public class AdminSoftOffersController extends ApiController {

  @Autowired RecruitmentRepository recruitmentRepository;
  @Autowired SoftOffersService softOffersService;

  @Operation(
      summary = "The soft offer results of a ULA recruitment",
      description =
          "One row per assigned ULA (the one-row-per-ULA layout's columns, then Offer Status,"
              + " Offer Response Date/Time and Comments), the counts, and a second table of answers"
              + " from applicants no longer assigned. 404 for an unknown recruitment; 400 unless it"
              + " is a ULA one with soft offers released.")
  @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_HIRING_STAFF')")
  @GetMapping("")
  public SoftOffersService.Results results(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId) {
    return softOffersService.results(recruitmentOf(recruitmentId));
  }

  @Operation(summary = "The main soft offer results table as CSV")
  @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_HIRING_STAFF')")
  @GetMapping(value = "/csv", produces = "text/csv")
  public ResponseEntity<String> csv(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId) {
    String body = softOffersService.resultsCsv(recruitmentOf(recruitmentId));
    return ResponseEntity.ok()
        .header(
            HttpHeaders.CONTENT_DISPOSITION,
            "attachment; filename=\"soft-offers-%d.csv\"".formatted(recruitmentId))
        .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
        .body(body);
  }

  private Recruitment recruitmentOf(Long recruitmentId) {
    return recruitmentRepository
        .findById(recruitmentId)
        .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, recruitmentId));
  }
}
