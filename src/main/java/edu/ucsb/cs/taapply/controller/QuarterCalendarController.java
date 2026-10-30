package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.UCSBAPIQuarter;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.UCSBAPIQuarterRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * One quarter of the UCSB quarter calendar on file, for any signed-in user (issue #153): the
 * application form fills the notices text's quarter fields ({@code ${firstDayOfClasses}} and the
 * like) from it. The admin's Quarters page keeps the file current.
 */
@Tag(name = "QuarterCalendar")
@RequestMapping("/api/quarters")
@RestController
@Slf4j
public class QuarterCalendarController extends ApiController {

  @Autowired UCSBAPIQuarterRepository ucsbApiQuarterRepository;

  @Operation(
      summary = "The quarter calendar's row for one quarter",
      description =
          "404 when that quarter is not on file; the admin's Quarters page fills the file.")
  @PreAuthorize("hasRole('ROLE_USER')")
  @GetMapping("/one")
  public UCSBAPIQuarter one(
      @Parameter(name = "yyyyq", description = "YYYYQ, e.g. 20261") @RequestParam String yyyyq) {
    return ucsbApiQuarterRepository
        .findById(yyyyq)
        .orElseThrow(() -> new EntityNotFoundException(UCSBAPIQuarter.class, yyyyq));
  }
}
