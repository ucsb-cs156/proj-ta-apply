package edu.ucsb.cs.taapply.jobs;

import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.CandidateRankingRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.fake.FakeRankingScope;
import edu.ucsb.cs.taapply.services.fake.FakeRankingsGenerator;
import java.util.Random;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/** Wires collaborators into {@link CreateFakeRankingsJob}, as the other job factories do. */
@Service
public class CreateFakeRankingsJobFactory {

  @Autowired private FakeRankingsGenerator generator;
  @Autowired private RecruitmentRepository recruitmentRepository;
  @Autowired private RecruitmentCourseRepository recruitmentCourseRepository;
  @Autowired private ApplicationRepository applicationRepository;
  @Autowired private CandidateRankingRepository candidateRankingRepository;

  /** A job with a fresh, unseeded random source. */
  public CreateFakeRankingsJob create(
      Long recruitmentId, FakeRankingScope scope, boolean includeNotInterested) {
    return create(recruitmentId, scope, includeNotInterested, new Random());
  }

  /** A job drawing from the given random source, so a test can fix the outcome. */
  public CreateFakeRankingsJob create(
      Long recruitmentId, FakeRankingScope scope, boolean includeNotInterested, Random random) {
    return CreateFakeRankingsJob.builder()
        .recruitmentId(recruitmentId)
        .scope(scope)
        .includeNotInterested(includeNotInterested)
        .random(random)
        .generator(generator)
        .recruitmentRepository(recruitmentRepository)
        .recruitmentCourseRepository(recruitmentCourseRepository)
        .applicationRepository(applicationRepository)
        .candidateRankingRepository(candidateRankingRepository)
        .build();
  }
}
