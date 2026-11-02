package edu.ucsb.cs.taapply.jobs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.CandidateRankingRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.fake.FakeRankingScope;
import edu.ucsb.cs.taapply.services.fake.FakeRankingsGenerator;
import java.util.Random;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(classes = CreateFakeRankingsJobFactory.class)
@ActiveProfiles("test")
public class CreateFakeRankingsJobFactoryTests {

  @Autowired private CreateFakeRankingsJobFactory factory;

  @MockitoBean private FakeRankingsGenerator generator;
  @MockitoBean private RecruitmentRepository recruitmentRepository;
  @MockitoBean private RecruitmentCourseRepository recruitmentCourseRepository;
  @MockitoBean private ApplicationRepository applicationRepository;
  @MockitoBean private CandidateRankingRepository candidateRankingRepository;

  @Test
  public void create_wires_in_the_request_and_collaborators() {
    Random random = new Random(5);

    CreateFakeRankingsJob job = factory.create(7L, FakeRankingScope.SOME, true, random);

    assertEquals(7L, job.getRecruitmentId());
    assertEquals(FakeRankingScope.SOME, job.getScope());
    assertTrue(job.isIncludeNotInterested());
    assertSame(random, job.getRandom());
    assertSame(generator, job.getGenerator());
    assertSame(recruitmentRepository, job.getRecruitmentRepository());
    assertSame(recruitmentCourseRepository, job.getRecruitmentCourseRepository());
    assertSame(applicationRepository, job.getApplicationRepository());
    assertSame(candidateRankingRepository, job.getCandidateRankingRepository());
  }

  @Test
  public void without_a_random_source_one_is_made() {
    CreateFakeRankingsJob job = factory.create(7L, FakeRankingScope.ALL, false);

    assertNotNull(job.getRandom());
    assertEquals(FakeRankingScope.ALL, job.getScope());
    assertFalse(job.isIncludeNotInterested());
  }
}
