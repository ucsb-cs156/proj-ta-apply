package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.jobs.TestJob;
import edu.ucsb.cs156.jobs.entities.Job;
import edu.ucsb.cs156.jobs.services.JobService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * App-level job endpoints. Coexists with lib-jobs' own {@code JobsController} (admin-only
 * list/logs/delete) under the same {@code /api/jobs} prefix, on non-overlapping sub-paths — the
 * same pattern as proj-scaffold's app-level {@code JobsController}.
 *
 * <p>Iteration 1 has no real background work, so the only launcher here is the test job. Iterations
 * 2 and 3 will add jobs that pull course data from the UCSB API.
 */
@Tag(name = "Jobs")
@RequestMapping("/api/jobs")
@RestController
@Slf4j
public class JobsController extends ApiController {

  @Autowired private JobService jobService;

  @Operation(summary = "Launch the test job")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping("/launch/testjob")
  public Job launchTestJob(
      @Parameter(name = "fail") @RequestParam(defaultValue = "false") boolean fail,
      @Parameter(name = "sleepMs") @RequestParam(defaultValue = "0") int sleepMs) {
    return jobService.runAsJob(TestJob.builder().fail(fail).sleepMs(sleepMs).build());
  }
}
