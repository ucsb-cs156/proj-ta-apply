package edu.ucsb.cs.taapply.jobs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import edu.ucsb.cs156.jobs.entities.Job;
import edu.ucsb.cs156.jobs.services.JobService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
public class RecruitmentCoursesRefreshSchedulerTests {

  @Mock private RefreshRecruitmentCoursesJobFactory factory;
  @Mock private JobService jobService;

  @InjectMocks private RecruitmentCoursesRefreshScheduler scheduler;

  /** One job, launched straight away: every run is on the Jobs page (issue #464). */
  @Test
  public void the_scheduled_run_launches_the_refresh_job_and_nothing_else() {
    RefreshRecruitmentCoursesJob refreshJob = RefreshRecruitmentCoursesJob.builder().build();
    Job job = Job.builder().id(5L).build();
    when(factory.create()).thenReturn(refreshJob);
    when(jobService.runAsJob(refreshJob)).thenReturn(job);

    assertSame(job, scheduler.refresh());

    verifyNoMoreInteractions(jobService);
  }

  @Test
  public void it_runs_at_midnight_by_default() {
    assertEquals("0 0 0 * * *", RecruitmentCoursesRefreshScheduler.DEFAULT_CRON);
  }
}
