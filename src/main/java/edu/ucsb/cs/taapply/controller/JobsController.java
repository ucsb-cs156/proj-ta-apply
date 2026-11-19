package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.jobs.PopulateCoursesJobFactory;
import edu.ucsb.cs.taapply.jobs.PopulateRecruitmentCoursesJobFactory;
import edu.ucsb.cs.taapply.jobs.RefreshRecruitmentCoursesJobFactory;
import edu.ucsb.cs.taapply.jobs.TestJob;
import edu.ucsb.cs.taapply.models.Quarter;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs156.jobs.entities.Job;
import edu.ucsb.cs156.jobs.services.JobService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
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
 * <p>Besides the test job, these launch the jobs that pull course data from the UCSB API.
 */
@Tag(name = "Jobs")
@RequestMapping("/api/jobs")
@RestController
@Slf4j
public class JobsController extends ApiController {

  static final List<String> VALID_LEVELS = List.of("U", "G", "A");

  @Autowired private JobService jobService;

  @Autowired private PopulateCoursesJobFactory populateCoursesJobFactory;

  @Autowired private PopulateRecruitmentCoursesJobFactory populateRecruitmentCoursesJobFactory;

  @Autowired private RefreshRecruitmentCoursesJobFactory refreshRecruitmentCoursesJobFactory;

  @Autowired private RecruitmentRepository recruitmentRepository;

  @Operation(summary = "Launch the test job")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping("/launch/testjob")
  public Job launchTestJob(
      @Parameter(name = "fail") @RequestParam(defaultValue = "false") boolean fail,
      @Parameter(name = "sleepMs") @RequestParam(defaultValue = "0") int sleepMs) {
    return jobService.runAsJob(TestJob.builder().fail(fail).sleepMs(sleepMs).build());
  }

  @Operation(
      summary = "Populate the course table from the UCSB API over a range of quarters",
      description =
          "Walks every quarter from startQuarter to endQuarter inclusive, adding any courses in the"
              + " configured subject area that are not already present. Existing courses keep their"
              + " TA/ULA flags, and nothing is ever deleted.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping("/launch/populateCourses")
  public Job launchPopulateCourses(
      @Parameter(name = "startQuarter", description = "YYYYQ, e.g. 20241") @RequestParam
          String startQuarter,
      @Parameter(name = "endQuarter", description = "YYYYQ, e.g. 20244") @RequestParam
          String endQuarter,
      @Parameter(name = "level", description = "U (undergrad), G (grad) or A (all)") @RequestParam
          String level) {

    // Validate before launching so a bad range is a 400 rather than a job that fails immediately.
    // ApiController maps IllegalArgumentException to 400.
    Quarter.quarterList(startQuarter, endQuarter);
    if (!VALID_LEVELS.contains(level)) {
      throw new IllegalArgumentException(
          String.format("Level must be one of %s, was: %s", VALID_LEVELS, level));
    }

    return jobService.runAsJob(populateCoursesJobFactory.create(startQuarter, endQuarter, level));
  }

  @Operation(
      summary = "Re-fill a recruitment's course list from the UCSB API",
      description =
          "Picks up courses newly flagged in Admin/Courses and refreshes offering details. Courses"
              + " the admin removed stay removed.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping("/launch/populateRecruitmentCourses")
  public Job launchPopulateRecruitmentCourses(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId) {

    Recruitment recruitment =
        recruitmentRepository
            .findById(recruitmentId)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, recruitmentId));

    return jobService.runAsJob(populateRecruitmentCoursesJobFactory.create(recruitment));
  }

  @Operation(
      summary = "Refresh every current recruitment's course list from the UCSB API",
      description =
          "The job that runs nightly (issue #464), on demand: re-fills the course list of every"
              + " recruitment open for applications, not yet opened, or closed within the last six"
              + " months, refreshing each course's instructor, days, time, room and status and the"
              + " quarter's enrollment figures. Courses the admin removed stay removed.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping("/launch/refreshRecruitmentCourses")
  public Job launchRefreshRecruitmentCourses() {
    return jobService.runAsJob(refreshRecruitmentCoursesJobFactory.create());
  }
}
