package edu.ucsb.cs.taapply.jobs;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.ApplicationAccessService;
import edu.ucsb.cs156.jobs.services.JobRateLimit;
import edu.ucsb.cs156.jobs.services.JobService;
import java.time.LocalDate;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Re-fills the course list of every recruitment that still matters, on a schedule (issue #124), the
 * way the Populate button does by hand: one {@link PopulateRecruitmentCoursesJob} per recruitment,
 * run through the job service so each shows up on Developer > Jobs with its log.
 *
 * <p>Which recruitments matter: those open for applications, those created but not yet opened (so
 * their lists are ready on opening day), and those that closed within the last six months, since
 * hiring goes on after applications close. Older ones are left alone.
 *
 * <p>Only present when {@code app.recruitmentCourses.refreshEnabled} is true; the cron expression
 * is {@code app.recruitmentCourses.refreshCron}, nightly at 03:00 Pacific by default.
 */
@Component
@ConditionalOnProperty(name = "app.recruitmentCourses.refreshEnabled", havingValue = "true")
@Slf4j
public class RecruitmentCoursesRefreshScheduler {

  @Autowired private RecruitmentRepository recruitmentRepository;
  @Autowired private PopulateRecruitmentCoursesJobFactory populateRecruitmentCoursesJobFactory;
  @Autowired private JobService jobService;
  @Autowired private JobRateLimit jobRateLimit;
  @Autowired private ApplicationAccessService applicationAccessService;

  /** Whether a recruitment's course list is still worth refreshing today. */
  public boolean isEligible(Recruitment recruitment, LocalDate today) {
    return recruitment.getApplicationStatus() == ApplicationStatus.OPEN
        || recruitment.getActualOpeningDate() == null
        || applicationAccessService.recentlyClosed(recruitment, today);
  }

  /** The scheduled entry point: today's eligible recruitments. */
  @Scheduled(
      cron = "${app.recruitmentCourses.refreshCron:0 0 3 * * *}",
      zone = "America/Los_Angeles")
  public void refresh() {
    refresh(LocalDate.now());
  }

  /** Launches one Populate job per recruitment eligible on the given day, pausing between them. */
  public int refresh(LocalDate today) {
    List<Recruitment> eligible =
        recruitmentRepository.findAllByOrderByQuarterDescTypeAsc().stream()
            .filter(r -> isEligible(r, today))
            .toList();
    log.info("Scheduled refresh: {} recruitment(s) to repopulate", eligible.size());

    int launched = 0;
    for (Recruitment recruitment : eligible) {
      if (launched > 0) {
        try {
          jobRateLimit.sleep();
        } catch (InterruptedException e) {
          // Shutting down: stop launching, and leave the flag set for whoever asked. The flag is
          // set last: logging while interrupted can clear it.
          log.warn("Scheduled refresh interrupted after {} launch(es)", launched);
          Thread.currentThread().interrupt();
          break;
        }
      }
      jobService.runAsJob(populateRecruitmentCoursesJobFactory.create(recruitment));
      launched++;
      log.info(
          "Scheduled refresh: launched Populate for {} {} (id {})",
          recruitment.getType(),
          recruitment.getQuarter(),
          recruitment.getId());
    }
    return launched;
  }
}
