package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.RankingsCsvService;
import io.swagger.v3.oas.annotations.Operation;
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

@Tag(name = "AdminRankings")
@RequestMapping("/api/admin/rankings")
@RestController
public class AdminRankingsController extends ApiController {
  @Autowired RecruitmentRepository recruitmentRepository;
  @Autowired RankingsCsvService rankingsCsvService;

  @Operation(
      summary = "Download a recruitment's faculty rankings",
      description =
          "Real applicants only, including unranked applicants. Each primary section has its own"
              + " column, including removed, stale and cancelled sections to preserve history."
              + " 404 for a recruitment that does not exist.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping(value = "/csv", produces = "text/csv")
  public ResponseEntity<String> downloadCsv(@RequestParam Long recruitmentId) {
    Recruitment recruitment =
        recruitmentRepository
            .findById(recruitmentId)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, recruitmentId));
    return ResponseEntity.ok()
        .header(
            HttpHeaders.CONTENT_DISPOSITION,
            "attachment; filename=\"rankings-%d.csv\"".formatted(recruitmentId))
        .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
        .body(rankingsCsvService.write(recruitment));
  }
}
