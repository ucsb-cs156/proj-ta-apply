package edu.ucsb.cs.taapply.jobs;

import edu.ucsb.cs156.jobs.entities.Job;
import edu.ucsb.cs156.jobs.services.JobService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Refreshes the course lists of every recruitment that still matters from the UCSB API, nightly
 * (issues #124 and #464), by launching one {@link RefreshRecruitmentCoursesJob}, the same job an
 * admin can launch by hand from the Admin Jobs page. It does nothing else: all the work, finding
 * the recruitments included, is in the job, so every nightly run is on the Jobs page, failed or
 * not, with its log.
 *
 * <p>Only present when {@code app.recruitmentCourses.refreshEnabled} is true; the cron expression
 * is {@code app.recruitmentCourses.refreshCron}, nightly at midnight Pacific by default.
 */
@Component
@ConditionalOnProperty(name = "app.recruitmentCourses.refreshEnabled", havingValue = "true")
@Slf4j
public class RecruitmentCoursesRefreshScheduler {

  /** The default schedule: every day at 00:00 Pacific. */
  public static final String DEFAULT_CRON = "0 0 0 * * *";

  @Autowired private RefreshRecruitmentCoursesJobFactory refreshRecruitmentCoursesJobFactory;
  @Autowired private JobService jobService;

  /** The scheduled entry point: launches the refresh, judged as of today. */
  @Scheduled(
      cron = "${app.recruitmentCourses.refreshCron:" + DEFAULT_CRON + "}",
      zone = "America/Los_Angeles")
  public Job refresh() {
    Job job = jobService.runAsJob(refreshRecruitmentCoursesJobFactory.create());
    log.info("Scheduled refresh: launched job {}", job.getId());
    return job;
  }
}
