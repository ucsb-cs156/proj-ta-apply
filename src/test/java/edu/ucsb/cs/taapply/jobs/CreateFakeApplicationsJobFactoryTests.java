package edu.ucsb.cs.taapply.jobs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;

import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.fake.FakeApplicationGenerator;
import edu.ucsb.cs.taapply.services.fake.FakeCoverage;
import java.util.Random;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(classes = CreateFakeApplicationsJobFactory.class)
@ActiveProfiles("test")
public class CreateFakeApplicationsJobFactoryTests {

  @Autowired private CreateFakeApplicationsJobFactory factory;

  @MockitoBean private FakeApplicationGenerator generator;
  @MockitoBean private RecruitmentRepository recruitmentRepository;
  @MockitoBean private RecruitmentCourseRepository recruitmentCourseRepository;
  @MockitoBean private ApplicationRepository applicationRepository;

  @Test
  public void create_wires_in_the_request_and_collaborators() {
    Random random = new Random(5);

    CreateFakeApplicationsJob job = factory.create(7L, 30, FakeCoverage.SPARSE, random);

    assertEquals(7L, job.getRecruitmentId());
    assertEquals(30, job.getCount());
    assertEquals(FakeCoverage.SPARSE, job.getCoverage());
    assertSame(random, job.getRandom());
    assertSame(generator, job.getGenerator());
    assertSame(recruitmentRepository, job.getRecruitmentRepository());
    assertSame(recruitmentCourseRepository, job.getRecruitmentCourseRepository());
    assertSame(applicationRepository, job.getApplicationRepository());
  }

  @Test
  public void without_a_random_source_one_is_made() {
    CreateFakeApplicationsJob job = factory.create(7L, 30, FakeCoverage.ALL);

    assertNotNull(job.getRandom());
    assertEquals(FakeCoverage.ALL, job.getCoverage());
  }
}
