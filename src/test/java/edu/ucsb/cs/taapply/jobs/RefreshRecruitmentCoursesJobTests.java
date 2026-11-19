package edu.ucsb.cs.taapply.jobs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.ApplicationAccessService;
import edu.ucsb.cs156.jobs.errors.JobCancelledException;
import edu.ucsb.cs156.jobs.services.JobContext;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
public class RefreshRecruitmentCoursesJobTests {

  @Mock private RecruitmentRepository recruitmentRepository;
  @Mock private PopulateRecruitmentCoursesJobFactory factory;
  @Mock private JobContext ctx;

  private static final LocalDate TODAY = LocalDate.of(2026, 3, 1);

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

  private PopulateRecruitmentCoursesJob openJob;
  private PopulateRecruitmentCoursesJob upcomingJob;
  private PopulateRecruitmentCoursesJob recentJob;

  @BeforeEach
  void setUp() {
    openJob = mock(PopulateRecruitmentCoursesJob.class);
    upcomingJob = mock(PopulateRecruitmentCoursesJob.class);
    recentJob = mock(PopulateRecruitmentCoursesJob.class);
    when(factory.create(OPEN)).thenReturn(openJob);
    when(factory.create(UPCOMING)).thenReturn(upcomingJob);
    when(factory.create(RECENTLY_CLOSED)).thenReturn(recentJob);
  }

  private RefreshRecruitmentCoursesJob job(LocalDate today) {
    return RefreshRecruitmentCoursesJob.builder()
        .today(today)
        .recruitmentRepository(recruitmentRepository)
        .applicationAccessService(new ApplicationAccessService())
        .populateRecruitmentCoursesJobFactory(factory)
        .build();
  }

  // ---- eligibility ----

  @Test
  public void open_upcoming_and_recently_closed_recruitments_are_eligible() {
    assertTrue(job(TODAY).isEligible(OPEN));
    assertTrue(job(TODAY).isEligible(UPCOMING));
    assertTrue(job(TODAY).isEligible(RECENTLY_CLOSED));
  }

  @Test
  public void recruitments_closed_more_than_six_months_ago_are_not() {
    assertFalse(job(TODAY).isEligible(LONG_CLOSED));
    assertFalse(job(TODAY).isEligible(OLD_REOPENED));
    // Six months to the day is still recent; the day after is not.
    assertTrue(job(LocalDate.of(2026, 5, 1)).isEligible(RECENTLY_CLOSED));
    assertFalse(job(LocalDate.of(2026, 5, 2)).isEligible(RECENTLY_CLOSED));
  }

  // ---- the run ----

  @Test
  public void each_eligible_recruitment_is_populated_in_turn_within_this_job() throws Exception {
    when(recruitmentRepository.findAllByOrderByQuarterDescTypeAsc())
        .thenReturn(List.of(OPEN, LONG_CLOSED, UPCOMING, OLD_REOPENED, RECENTLY_CLOSED));

    job(TODAY).accept(ctx);

    InOrder order = inOrder(ctx, openJob, upcomingJob, recentJob);
    order
        .verify(ctx)
        .log(
            "Refreshing 3 recruitment(s) from the UCSB API: those open, not yet opened, or closed"
                + " within six months of 2026-03-01");
    order.verify(ctx).checkCancellation();
    order.verify(ctx).log("Refreshing TA 20262 (id 1)");
    order.verify(openJob).accept(ctx);
    order.verify(ctx).checkCancellation();
    order.verify(ctx).log("Refreshing TA 20262 (id 2)");
    order.verify(upcomingJob).accept(ctx);
    order.verify(ctx).checkCancellation();
    order.verify(ctx).log("Refreshing TA 20262 (id 3)");
    order.verify(recentJob).accept(ctx);
    order.verify(ctx).log("Finished: 3 refreshed, 0 failed");
    verify(factory, never()).create(LONG_CLOSED);
    verify(factory, never()).create(OLD_REOPENED);
  }

  @Test
  public void with_nothing_eligible_it_finishes_without_populating_anything() throws Exception {
    when(recruitmentRepository.findAllByOrderByQuarterDescTypeAsc())
        .thenReturn(List.of(LONG_CLOSED));

    job(TODAY).accept(ctx);

    verify(factory, never()).create(any());
    verify(ctx).log("Finished: 0 refreshed, 0 failed");
  }

  @Test
  public void a_failed_recruitment_is_logged_the_rest_go_on_and_the_job_fails_at_the_end()
      throws Exception {
    when(recruitmentRepository.findAllByOrderByQuarterDescTypeAsc())
        .thenReturn(List.of(OPEN, UPCOMING, RECENTLY_CLOSED));
    doThrow(new RuntimeException("API down")).when(openJob).accept(ctx);
    doThrow(new IllegalStateException("bad data")).when(recentJob).accept(ctx);

    IllegalStateException thrown =
        assertThrows(IllegalStateException.class, () -> job(TODAY).accept(ctx));

    assertEquals("2 of 3 recruitment(s) failed to refresh", thrown.getMessage());
    verify(ctx).log("Refreshing TA 20262 (id 1) failed: API down");
    verify(upcomingJob).accept(ctx);
    verify(ctx).log("Refreshing TA 20262 (id 3) failed: bad data");
    verify(ctx).log("Finished: 1 refreshed, 2 failed");
  }

  @Test
  public void cancelling_stops_the_run_before_the_next_recruitment() throws Exception {
    when(recruitmentRepository.findAllByOrderByQuarterDescTypeAsc())
        .thenReturn(List.of(OPEN, UPCOMING));
    JobCancelledException cancelled = new JobCancelledException(9L);
    doThrow(cancelled).when(ctx).checkCancellation();

    assertSame(cancelled, assertThrows(JobCancelledException.class, () -> job(TODAY).accept(ctx)));

    verify(factory, never()).create(any());
  }

  @Test
  public void a_cancellation_inside_a_populate_is_not_counted_as_a_failure() throws Exception {
    when(recruitmentRepository.findAllByOrderByQuarterDescTypeAsc())
        .thenReturn(List.of(OPEN, UPCOMING));
    JobCancelledException cancelled = new JobCancelledException(9L);
    doThrow(cancelled).when(openJob).accept(ctx);

    assertSame(cancelled, assertThrows(JobCancelledException.class, () -> job(TODAY).accept(ctx)));

    verify(upcomingJob, never()).accept(any());
    verify(ctx, never()).log("Finished: 1 refreshed, 1 failed");
  }

  @Test
  public void an_interrupt_inside_a_populate_stops_the_run() throws Exception {
    when(recruitmentRepository.findAllByOrderByQuarterDescTypeAsc())
        .thenReturn(List.of(OPEN, UPCOMING));
    InterruptedException interrupted = new InterruptedException("shutting down");
    doThrow(interrupted).when(openJob).accept(ctx);

    assertSame(interrupted, assertThrows(InterruptedException.class, () -> job(TODAY).accept(ctx)));

    verify(upcomingJob, never()).accept(any());
  }

  /** Inside the job, so the failure is in the job's log rather than nowhere (issue #464). */
  @Test
  public void a_failure_finding_the_recruitments_fails_the_job() {
    RuntimeException down = new RuntimeException("database down");
    when(recruitmentRepository.findAllByOrderByQuarterDescTypeAsc()).thenThrow(down);

    assertSame(down, assertThrows(RuntimeException.class, () -> job(TODAY).accept(ctx)));
  }
}
