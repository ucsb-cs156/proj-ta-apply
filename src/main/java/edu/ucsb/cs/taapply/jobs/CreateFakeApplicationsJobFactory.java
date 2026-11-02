package edu.ucsb.cs.taapply.jobs;

import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.fake.FakeApplicationGenerator;
import edu.ucsb.cs.taapply.services.fake.FakeCoverage;
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

  /** A job with a fresh, unseeded random source. */
  public CreateFakeApplicationsJob create(Long recruitmentId, int count, FakeCoverage coverage) {
    return create(recruitmentId, count, coverage, new Random());
  }

  /** A job drawing from the given random source, so a test can fix the outcome. */
  public CreateFakeApplicationsJob create(
      Long recruitmentId, int count, FakeCoverage coverage, Random random) {
    return CreateFakeApplicationsJob.builder()
        .recruitmentId(recruitmentId)
        .count(count)
        .coverage(coverage)
        .random(random)
        .generator(generator)
        .recruitmentRepository(recruitmentRepository)
        .recruitmentCourseRepository(recruitmentCourseRepository)
        .applicationRepository(applicationRepository)
        .build();
  }
}
