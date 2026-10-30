package edu.ucsb.cs.taapply.jobs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.ApplicationAccessService;
import edu.ucsb.cs156.jobs.services.JobRateLimit;
import edu.ucsb.cs156.jobs.services.JobService;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
public class RecruitmentCoursesRefreshSchedulerTests {

  @Mock private RecruitmentRepository recruitmentRepository;
  @Mock private PopulateRecruitmentCoursesJobFactory factory;
  @Mock private JobService jobService;
  @Mock private JobRateLimit jobRateLimit;
  @Spy private ApplicationAccessService applicationAccessService = new ApplicationAccessService();

  @InjectMocks private RecruitmentCoursesRefreshScheduler scheduler;

  private static Recruitment recruitment(
      long id, ApplicationStatus status, LocalDate opened, LocalDate closed) {
    return Recruitment.builder()
        .id(id)
        .quarter("20262")
        .type(RecruitmentType.TA)
        .applicationStatus(status)
        .actualOpeningDate(opened)
        .actualClosingDate(closed)
        .build();
  }

  private static final LocalDate TODAY = LocalDate.of(2026, 3, 1);
  private static final Recruitment OPEN =
      recruitment(1L, ApplicationStatus.OPEN, LocalDate.of(2026, 1, 5), null);
  private static final Recruitment UPCOMING = recruitment(2L, ApplicationStatus.CLOSED, null, null);
  private static final Recruitment RECENTLY_CLOSED =
      recruitment(
          3L, ApplicationStatus.CLOSED, LocalDate.of(2025, 10, 1), LocalDate.of(2025, 11, 1));
  private static final Recruitment LONG_CLOSED =
      recruitment(4L, ApplicationStatus.CLOSED, LocalDate.of(2025, 4, 1), LocalDate.of(2025, 5, 1));

  /** Closed and reopened once, now closed again long ago: the opening date alone is not enough. */
  private static final Recruitment OLD_REOPENED =
      recruitment(5L, ApplicationStatus.CLOSED, LocalDate.of(2024, 1, 5), LocalDate.of(2024, 3, 1));

  // ---- eligibility ----

  @Test
  public void open_upcoming_and_recently_closed_recruitments_are_eligible() throws Exception {
    assertTrue(scheduler.isEligible(OPEN, TODAY));
    assertTrue(scheduler.isEligible(UPCOMING, TODAY));
    assertTrue(scheduler.isEligible(RECENTLY_CLOSED, TODAY));
  }

  @Test
  public void recruitments_closed_more_than_six_months_ago_are_not() throws Exception {
    assertFalse(scheduler.isEligible(LONG_CLOSED, TODAY));
    assertFalse(scheduler.isEligible(OLD_REOPENED, TODAY));
    // Six months to the day is still recent; the day after is not.
    assertTrue(scheduler.isEligible(RECENTLY_CLOSED, LocalDate.of(2026, 5, 1)));
    assertFalse(scheduler.isEligible(RECENTLY_CLOSED, LocalDate.of(2026, 5, 2)));
  }

  // ---- the scheduled run ----

  @Test
  public void refresh_launches_one_job_per_eligible_recruitment_and_pauses_between_them()
      throws Exception {
    when(recruitmentRepository.findAllByOrderByQuarterDescTypeAsc())
        .thenReturn(List.of(OPEN, LONG_CLOSED, UPCOMING, OLD_REOPENED, RECENTLY_CLOSED));
    PopulateRecruitmentCoursesJob openJob = PopulateRecruitmentCoursesJob.builder().build();
    PopulateRecruitmentCoursesJob upcomingJob = PopulateRecruitmentCoursesJob.builder().build();
    PopulateRecruitmentCoursesJob recentJob = PopulateRecruitmentCoursesJob.builder().build();
    when(factory.create(OPEN)).thenReturn(openJob);
    when(factory.create(UPCOMING)).thenReturn(upcomingJob);
    when(factory.create(RECENTLY_CLOSED)).thenReturn(recentJob);

    int launched = scheduler.refresh(TODAY);

    assertEquals(3, launched);
    InOrder order = inOrder(jobService, jobRateLimit);
    order.verify(jobService).runAsJob(openJob);
    order.verify(jobRateLimit).sleep();
    order.verify(jobService).runAsJob(upcomingJob);
    order.verify(jobRateLimit).sleep();
    order.verify(jobService).runAsJob(recentJob);
    verify(jobService, times(3)).runAsJob(any());
    verify(jobRateLimit, times(2)).sleep();
    verify(factory, never()).create(LONG_CLOSED);
    verify(factory, never()).create(OLD_REOPENED);
  }

  @Test
  public void an_interrupted_pause_stops_the_run_and_keeps_the_interrupt_flag() throws Exception {
    when(recruitmentRepository.findAllByOrderByQuarterDescTypeAsc())
        .thenReturn(List.of(OPEN, UPCOMING, RECENTLY_CLOSED));
    when(factory.create(any())).thenReturn(PopulateRecruitmentCoursesJob.builder().build());
    org.mockito.Mockito.doThrow(new InterruptedException("shutting down"))
        .when(jobRateLimit)
        .sleep();

    try {
      assertEquals(1, scheduler.refresh(TODAY));
      // interrupted() reports the flag and clears it, so the runner's thread is left clean.
      assertTrue(Thread.interrupted());
    } finally {
      Thread.interrupted();
    }
    verify(jobService, times(1)).runAsJob(any());
  }

  /** The scheduled entry point goes by the real clock. */
  @Test
  public void the_scheduled_entry_point_uses_today() throws Exception {
    // Open and never-opened recruitments are eligible on any day.
    when(recruitmentRepository.findAllByOrderByQuarterDescTypeAsc())
        .thenReturn(List.of(OPEN, UPCOMING, OLD_REOPENED));
    when(factory.create(any())).thenReturn(PopulateRecruitmentCoursesJob.builder().build());

    scheduler.refresh();

    verify(jobService, times(2)).runAsJob(any());
  }

  @Test
  public void refresh_with_nothing_eligible_launches_nothing_and_does_not_pause() throws Exception {
    when(recruitmentRepository.findAllByOrderByQuarterDescTypeAsc())
        .thenReturn(List.of(LONG_CLOSED));

    assertEquals(0, scheduler.refresh(TODAY));

    verify(jobService, never()).runAsJob(any());
    verify(jobRateLimit, never()).sleep();
  }

  @Test
  public void refresh_with_one_eligible_recruitment_does_not_pause() throws Exception {
    when(recruitmentRepository.findAllByOrderByQuarterDescTypeAsc()).thenReturn(List.of(OPEN));
    when(factory.create(OPEN)).thenReturn(PopulateRecruitmentCoursesJob.builder().build());

    assertEquals(1, scheduler.refresh(TODAY));

    verify(jobService, times(1)).runAsJob(any());
    verify(jobRateLimit, never()).sleep();
  }
}
