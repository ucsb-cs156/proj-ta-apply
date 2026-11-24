package edu.ucsb.cs.taapply.jobs;

import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.ApplicationAccessService;
import edu.ucsb.cs.taapply.time.AppTime;
import java.time.LocalDate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Wires collaborators into {@link RefreshRecruitmentCoursesJob}, as the other job factories do. It
 * does no work of its own, so nothing can fail between a launch and the job being recorded.
 */
@Service
public class RefreshRecruitmentCoursesJobFactory {

  @Autowired private RecruitmentRepository recruitmentRepository;
  @Autowired private ApplicationAccessService applicationAccessService;
  @Autowired private PopulateRecruitmentCoursesJobFactory populateRecruitmentCoursesJobFactory;

  /** A job judging eligibility as of today. */
  public RefreshRecruitmentCoursesJob create() {
    return create(AppTime.today());
  }

  /** A job judging eligibility as of the given day. */
  public RefreshRecruitmentCoursesJob create(LocalDate today) {
    return RefreshRecruitmentCoursesJob.builder()
        .today(today)
        .recruitmentRepository(recruitmentRepository)
        .applicationAccessService(applicationAccessService)
        .populateRecruitmentCoursesJobFactory(populateRecruitmentCoursesJobFactory)
        .build();
  }
}
