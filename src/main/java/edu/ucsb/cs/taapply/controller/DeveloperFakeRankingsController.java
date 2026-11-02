package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.jobs.CreateFakeRankingsJobFactory;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.DeveloperModeService;
import edu.ucsb.cs.taapply.services.fake.FakeRankingScope;
import edu.ucsb.cs156.jobs.entities.Job;
import edu.ucsb.cs156.jobs.services.JobService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Developer Mode's fake faculty rankings (issue #220). Admin only, 404 unless Developer Mode is on,
 * and 400 unless the recruitment's faculty review is Open, the only time instructors rank.
 */
@Tag(name = "Developer mode")
@RestController
@RequestMapping("/api/admin/developer/fakeRankings")
public class DeveloperFakeRankingsController extends ApiController {

  @Autowired DeveloperModeService developerModeService;
  @Autowired RecruitmentRepository recruitmentRepository;
  @Autowired CreateFakeRankingsJobFactory createFakeRankingsJobFactory;
  @Autowired JobService jobService;

  @Operation(
      summary = "Create fake faculty rankings for a recruitment",
      description =
          "Launches a job that ranks candidates for some or all of the recruitment's courses that"
              + " have no rankings yet. 400 unless the faculty review is Open; 404 unless"
              + " Developer Mode is on.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping("")
  public Job create(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId,
      @Parameter(name = "scope", description = "SOME or ALL") @RequestParam FakeRankingScope scope,
      @Parameter(name = "includeNotInterested") @RequestParam(defaultValue = "false")
          boolean includeNotInterested) {
    if (!developerModeService.isOn()) {
      throw new EntityNotFoundException("Developer mode is not on");
    }
    Recruitment recruitment =
        recruitmentRepository
            .findById(recruitmentId)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, recruitmentId));
    if (!"Open".equals(recruitment.getReviewStatus())) {
      throw new IllegalArgumentException("Faculty ranking is not open for this recruitment");
    }
    return jobService.runAsJob(
        createFakeRankingsJobFactory.create(recruitmentId, scope, includeNotInterested));
  }
}
