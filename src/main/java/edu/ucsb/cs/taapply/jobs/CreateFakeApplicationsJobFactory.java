package edu.ucsb.cs.taapply.jobs;

import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.fake.FakeApplicationGenerator;
import edu.ucsb.cs.taapply.services.fake.FakeCoverage;
import edu.ucsb.cs.taapply.time.AppTime;
import java.time.LocalDate;
import java.util.Random;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/** Wires collaborators into {@link CreateFakeApplicationsJob}, as the other job factories do. */
@Service
public class CreateFakeApplicationsJobFactory {

  @Autowired private FakeApplicationGenerator generator;
  @Autowired private RecruitmentRepository recruitmentRepository;
  @Autowired private RecruitmentCourseRepository recruitmentCourseRepository;
  @Autowired private ApplicationRepository applicationRepository;

  /** A job with a fresh, unseeded random source, for today. */
  public CreateFakeApplicationsJob create(Long recruitmentId, int count, FakeCoverage coverage) {
    return create(recruitmentId, count, coverage, new Random(), AppTime.today());
  }

  /** A job drawing from the given random source and date, so a test can fix the outcome. */
  public CreateFakeApplicationsJob create(
      Long recruitmentId, int count, FakeCoverage coverage, Random random, LocalDate today) {
    return CreateFakeApplicationsJob.builder()
        .recruitmentId(recruitmentId)
        .count(count)
        .coverage(coverage)
        .random(random)
        .today(today)
        .generator(generator)
        .recruitmentRepository(recruitmentRepository)
        .recruitmentCourseRepository(recruitmentCourseRepository)
        .applicationRepository(applicationRepository)
        .build();
  }
}
