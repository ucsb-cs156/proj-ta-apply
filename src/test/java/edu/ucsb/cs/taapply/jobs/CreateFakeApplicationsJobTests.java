package edu.ucsb.cs.taapply.jobs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.fake.FakeApplicationGenerator;
import edu.ucsb.cs.taapply.services.fake.FakeCoverage;
import edu.ucsb.cs156.jobs.entities.Job;
import edu.ucsb.cs156.jobs.services.JobContext;
import java.util.List;
import java.util.Optional;
import java.util.Random;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
public class CreateFakeApplicationsJobTests {

  @Mock private FakeApplicationGenerator generator;
  @Mock private RecruitmentRepository recruitmentRepository;
  @Mock private RecruitmentCourseRepository recruitmentCourseRepository;
  @Mock private ApplicationRepository applicationRepository;

  private final Random random = new Random(1);
  private static final java.time.LocalDate TODAY = java.time.LocalDate.of(2026, 2, 10);
  private Job jobStarted;
  private JobContext ctx;

  @BeforeEach
  void setup() {
    jobStarted = Job.builder().build();
    ctx = new JobContext(null, jobStarted);
  }

  private CreateFakeApplicationsJob job(FakeCoverage coverage) {
    return CreateFakeApplicationsJob.builder()
        .recruitmentId(7L)
        .count(40)
        .coverage(coverage)
        .random(random)
        .today(TODAY)
        .generator(generator)
        .recruitmentRepository(recruitmentRepository)
        .recruitmentCourseRepository(recruitmentCourseRepository)
        .applicationRepository(applicationRepository)
        .build();
  }

  private static RecruitmentCourse course(String courseId, boolean removed) {
    return RecruitmentCourse.builder()
        .recruitmentId(7L)
        .courseId(courseId)
        .removed(removed)
        .build();
  }

  @Test
  @SuppressWarnings("unchecked")
  public void saves_what_the_generator_makes_from_the_courses_on_offer() throws Exception {
    Recruitment recruitment =
        Recruitment.builder().id(7L).quarter("20261").type(RecruitmentType.TA).build();
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(recruitment));
    // Two sections of one course count once; a removed course is not offered; ids come out sorted.
    when(recruitmentCourseRepository.findByRecruitmentId(7L))
        .thenReturn(
            List.of(
                course("CMPSC  156", false),
                course("CMPSC   16", false),
                course("CMPSC  156", false),
                course("CMPSC  170", true)));
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(7L))
        .thenReturn(
            List.of(
                Application.builder().email("a@ucsb.edu").build(),
                Application.builder().email("b@fake.ucsb.edu").build()));
    List<Application> made = List.of(Application.builder().email("new@fake.ucsb.edu").build());
    when(generator.generate(any(), any(), anyInt(), any(), any(), any(), any())).thenReturn(made);

    job(FakeCoverage.SPARSE).accept(ctx);

    ArgumentCaptor<Set<String>> taken = ArgumentCaptor.forClass(Set.class);
    verify(generator)
        .generate(
            eq(recruitment),
            eq(List.of("CMPSC   16", "CMPSC  156")),
            eq(40),
            eq(FakeCoverage.SPARSE),
            eq(random),
            taken.capture(),
            eq(TODAY));
    assertEquals(Set.of("a@ucsb.edu", "b@fake.ucsb.edu"), taken.getValue());
    verify(applicationRepository).saveAll(made);
    assertTrue(
        jobStarted
            .getLog()
            .contains(
                "Creating 40 fake TA applications to 20261 with SPARSE coverage over 2 course(s)"),
        jobStarted.getLog());
    assertTrue(jobStarted.getLog().contains("Created 1 fake application(s)."), jobStarted.getLog());
  }

  @Test
  public void a_missing_recruitment_fails_the_job_without_saving() {
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.empty());

    assertThrows(EntityNotFoundException.class, () -> job(FakeCoverage.ALL).accept(ctx));

    verify(applicationRepository, never()).saveAll(any());
  }

  @Test
  public void the_builder_keeps_what_it_is_given() {
    CreateFakeApplicationsJob job = job(FakeCoverage.ALL);

    assertEquals(7L, job.getRecruitmentId());
    assertEquals(40, job.getCount());
    assertEquals(FakeCoverage.ALL, job.getCoverage());
    assertSame(random, job.getRandom());
    assertEquals(TODAY, job.getToday());
    assertSame(generator, job.getGenerator());
  }
}
