package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.UCSBAPIQuarter;
import edu.ucsb.cs.taapply.repository.UCSBAPIQuarterRepository;
import edu.ucsb.cs.taapply.services.UcsbQuarterService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The UCSB quarter calendar on file, for the admin's Quarters page (issue #151). */
@Tag(name = "UCSBAPIQuarter")
@RequestMapping("/api/admin/quarters")
@RestController
@Slf4j
public class UCSBAPIQuarterController extends ApiController {

  @Autowired UCSBAPIQuarterRepository ucsbApiQuarterRepository;
  @Autowired UcsbQuarterService ucsbQuarterService;

  @Operation(
      summary = "Every quarter on file, by quarter",
      description = "direction=desc (the default) lists the newest first; asc the oldest first.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/all")
  public List<UCSBAPIQuarter> allQuarters(
      @Parameter(name = "direction", description = "asc or desc")
          @RequestParam(defaultValue = "desc")
          String direction) {
    if ("asc".equalsIgnoreCase(direction)) {
      return ucsbApiQuarterRepository.findAllByOrderByQuarterAsc();
    }
    if ("desc".equalsIgnoreCase(direction)) {
      return ucsbApiQuarterRepository.findAllByOrderByQuarterDesc();
    }
    throw new IllegalArgumentException("direction must be asc or desc, not " + direction);
  }

  @Operation(
      summary = "Bring the quarters on file up to date from the UCSB API",
      description =
          "Asks UCSB which quarter it is, then saves every quarter from the latest one on file (or"
              + " the current one, when nothing is on file) through the current quarter plus one,"
              + " or plus two during Spring. Returns the range and the quarters saved.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping("/refresh")
  public UcsbQuarterService.QuarterRefresh refresh() throws Exception {
    return ucsbQuarterService.refreshThroughEnd();
  }
}
