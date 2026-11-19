package edu.ucsb.cs.taapply.jobs;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.ApplicationAccessService;
import edu.ucsb.cs156.jobs.errors.JobCancelledException;
import edu.ucsb.cs156.jobs.services.JobContext;
import edu.ucsb.cs156.jobs.services.JobContextConsumer;
import java.time.LocalDate;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

/**
 * Refreshes, from the UCSB API, the course list of every recruitment that still matters (issue
 * #464): one {@link PopulateRecruitmentCoursesJob} after another, inside this one job, so the run
 * is one entry on the Jobs page with one log. That brings each row's instructor, days, time, room
 * and status up to date, and the quarter's enrollment figures (maxEnroll and enrolled) with them.
 *
 * <p>Which recruitments matter (issue #124): those open for applications, those created but not yet
 * opened (so their lists are ready on opening day), and those that closed within the last six
 * months, since hiring goes on after applications close. Older ones are left alone.
 *
 * <p>Launched nightly by {@link RecruitmentCoursesRefreshScheduler} and on demand from the Admin
 * Jobs page. Everything, even finding the recruitments, happens inside the job, so a run that fails
 * still shows up on the Jobs page with the reason in its log. Each Populate pauses before its API
 * call, so the calls are spaced as before. A recruitment whose refresh fails is logged and passed
 * over, so one bad quarter does not hold up the rest, and the job fails at the end if any did.
 * Cancelling the job stops it.
 */
@Builder
@Getter
@AllArgsConstructor
@Slf4j
public class RefreshRecruitmentCoursesJob implements JobContextConsumer {

  /** The day eligibility is judged on. */
  private LocalDate today;

  private RecruitmentRepository recruitmentRepository;
  private ApplicationAccessService applicationAccessService;
  private PopulateRecruitmentCoursesJobFactory populateRecruitmentCoursesJobFactory;

  /** Whether a recruitment's course list is still worth refreshing on {@link #today}. */
  public boolean isEligible(Recruitment recruitment) {
    return recruitment.getApplicationStatus() == ApplicationStatus.OPEN
        || recruitment.getActualOpeningDate() == null
        || applicationAccessService.recentlyClosed(recruitment, today);
  }

  @Override
  public void accept(JobContext ctx) throws Exception {
    List<Recruitment> recruitments =
        recruitmentRepository.findAllByOrderByQuarterDescTypeAsc().stream()
            .filter(this::isEligible)
            .toList();
    ctx.log(
        String.format(
            "Refreshing %d recruitment(s) from the UCSB API: those open, not yet opened, or"
                + " closed within six months of %s",
            recruitments.size(), today));

    int failed = 0;
    for (Recruitment recruitment : recruitments) {
      ctx.checkCancellation();
      String name =
          String.format(
              "%s %s (id %d)",
              recruitment.getType(), recruitment.getQuarter(), recruitment.getId());
      ctx.log("Refreshing " + name);
      try {
        populateRecruitmentCoursesJobFactory.create(recruitment).accept(ctx);
      } catch (JobCancelledException | InterruptedException e) {
        throw e;
      } catch (Exception e) {
        failed++;
        ctx.log(String.format("Refreshing %s failed: %s", name, e.getMessage()));
        log.error("Refreshing {} failed", name, e);
      }
    }

    int refreshed = recruitments.size() - failed;
    ctx.log(String.format("Finished: %d refreshed, %d failed", refreshed, failed));
    if (failed > 0) {
      throw new IllegalStateException(
          String.format("%d of %d recruitment(s) failed to refresh", failed, recruitments.size()));
    }
  }
}
