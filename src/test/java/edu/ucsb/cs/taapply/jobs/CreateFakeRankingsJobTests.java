package edu.ucsb.cs.taapply.jobs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.CandidateRanking;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.ApplicationOrigin;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.CandidateRankingRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.fake.FakeRankingScope;
import edu.ucsb.cs.taapply.services.fake.FakeRankingsGenerator;
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
public class CreateFakeRankingsJobTests {

  @Mock private FakeRankingsGenerator generator;
  @Mock private RecruitmentRepository recruitmentRepository;
  @Mock private RecruitmentCourseRepository recruitmentCourseRepository;
  @Mock private ApplicationRepository applicationRepository;
  @Mock private CandidateRankingRepository candidateRankingRepository;

  private final Random random = new Random(1);
  private Job jobStarted;
  private JobContext ctx;

  @BeforeEach
  void setup() {
    jobStarted = Job.builder().build();
    ctx = new JobContext(null, jobStarted);
  }

  private CreateFakeRankingsJob job(FakeRankingScope scope, boolean includeNotInterested) {
    return CreateFakeRankingsJob.builder()
        .recruitmentId(7L)
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

  @Test
  @SuppressWarnings("unchecked")
  public void saves_what_the_generator_makes_leaving_ranked_courses_alone() throws Exception {
    Recruitment recruitment =
        Recruitment.builder().id(7L).quarter("20261").type(RecruitmentType.TA).build();
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(recruitment));
    RecruitmentCourse ranked = RecruitmentCourse.builder().id(11L).courseId("C1").build();
    RecruitmentCourse unranked = RecruitmentCourse.builder().id(12L).courseId("C2").build();
    List<RecruitmentCourse> courses = List.of(ranked, unranked);
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(courses);
    when(candidateRankingRepository.findByRecruitmentCourseId(11L))
        .thenReturn(List.of(CandidateRanking.builder().build()));
    when(candidateRankingRepository.findByRecruitmentCourseId(12L)).thenReturn(List.of());
    // Developer Mode is on while the job runs, so a fake application counts; a test one does not.
    Application fake =
        Application.builder().id(1L).origin(ApplicationOrigin.DEVELOPER_MODE).build();
    Application adminTest =
        Application.builder().id(2L).origin(ApplicationOrigin.ADMIN_TEST).build();
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(7L))
        .thenReturn(List.of(fake, adminTest));
    List<CandidateRanking> made = List.of(CandidateRanking.builder().rank(1).build());
    when(generator.generate(any(), any(), any(), any(), eq(true), any())).thenReturn(made);

    job(FakeRankingScope.SOME, true).accept(ctx);

    ArgumentCaptor<List<Application>> apps = ArgumentCaptor.forClass(List.class);
    ArgumentCaptor<Set<Long>> alreadyRanked = ArgumentCaptor.forClass(Set.class);
    verify(generator)
        .generate(
            eq(courses),
            apps.capture(),
            alreadyRanked.capture(),
            eq(FakeRankingScope.SOME),
            eq(true),
            eq(random));
    assertEquals(Set.of(11L), alreadyRanked.getValue());
    assertTrue(apps.getValue().contains(fake));
    verify(candidateRankingRepository).saveAll(made);
    assertTrue(
        jobStarted
            .getLog()
            .contains(
                "Creating fake rankings for SOME courses of TA 20261 (with some not-interested)"),
        jobStarted.getLog());
    assertTrue(jobStarted.getLog().contains("Created 1 fake ranking(s)."), jobStarted.getLog());
  }

  @Test
  public void the_log_says_when_only_interested_candidates_are_ranked() throws Exception {
    Recruitment recruitment =
        Recruitment.builder().id(7L).quarter("20262").type(RecruitmentType.ULA).build();
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(recruitment));
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of());
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(7L)).thenReturn(List.of());
    when(generator.generate(any(), any(), any(), any(), eq(false), any())).thenReturn(List.of());

    job(FakeRankingScope.ALL, false).accept(ctx);

    assertTrue(
        jobStarted
            .getLog()
            .contains("Creating fake rankings for ALL courses of ULA 20262 (interested only)"),
        jobStarted.getLog());
    assertTrue(jobStarted.getLog().contains("Created 0 fake ranking(s)."), jobStarted.getLog());
  }

  @Test
  public void a_missing_recruitment_fails_the_job_without_saving() {
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.empty());

    assertThrows(EntityNotFoundException.class, () -> job(FakeRankingScope.ALL, false).accept(ctx));

    verify(candidateRankingRepository, never()).saveAll(any());
  }

  @Test
  public void the_builder_keeps_what_it_is_given() {
    CreateFakeRankingsJob job = job(FakeRankingScope.ALL, true);

    assertEquals(7L, job.getRecruitmentId());
    assertEquals(FakeRankingScope.ALL, job.getScope());
    assertTrue(job.isIncludeNotInterested());
    assertSame(random, job.getRandom());
    assertSame(generator, job.getGenerator());
  }
}
