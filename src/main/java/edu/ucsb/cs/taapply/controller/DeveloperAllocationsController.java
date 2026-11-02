package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.services.DeveloperModeService;
import edu.ucsb.cs.taapply.services.fake.FakeAllocationsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Developer Mode's fake hiring targets and allocations (issue #225). Every endpoint here refuses
 * (404) unless developer mode is on, so none of it exists on a production instance.
 */
@Tag(name = "Developer mode")
@RequestMapping("/api/admin/developer")
@RestController
public class DeveloperAllocationsController extends ApiController {

  @Autowired DeveloperModeService developerModeService;
  @Autowired FakeAllocationsService fakeAllocationsService;

  @Operation(
      summary = "Fake a recruitment's hiring target and allocations (developer mode only)",
      description =
          "Sets the hiring target (1 to three times the non-removed courses), fills the"
              + " enrollment estimates from the schedule's maximum or current enrollment (or keeps"
              + " the ones entered), auto-allocates the target across the courses, and, when"
              + " setVisibility is true, lets each faculty member see their own courses'"
              + " allocations (audited like the real change). Returns the non-removed courses."
              + " 404 unless developer mode is on, or for an unknown recruitment; 400 for a target"
              + " out of range or a recruitment with no courses.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @Transactional
  @PostMapping("/fakeAllocations")
  public List<RecruitmentCourse> fakeAllocations(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId,
      @Parameter(name = "hiringTarget") @RequestParam int hiringTarget,
      @Parameter(name = "estimates") @RequestParam FakeAllocationsService.Estimates estimates,
      @Parameter(name = "setVisibility") @RequestParam(defaultValue = "false")
          boolean setVisibility) {
    if (!developerModeService.isOn()) {
      throw new EntityNotFoundException("Developer mode is not on");
    }
    return fakeAllocationsService.fake(recruitmentId, hiringTarget, estimates, setVisibility);
  }
}
