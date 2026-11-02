package edu.ucsb.cs.taapply.jobs;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.CandidateRanking;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.CandidateRankingRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.AssignmentsService;
import edu.ucsb.cs.taapply.services.RankingVersionService;
import edu.ucsb.cs.taapply.services.fake.FakeRankingScope;
import edu.ucsb.cs.taapply.services.fake.FakeRankingsGenerator;
import edu.ucsb.cs156.jobs.services.JobContext;
import edu.ucsb.cs156.jobs.services.JobContextConsumer;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

/**
 * Developer Mode's "Create Fake Rankings" (issue #220): ranks candidates for some or all of a
 * recruitment's courses, as the faculty would. Courses that already have rankings are left alone,
 * so nothing an instructor entered is overwritten.
 */
@Builder
@Getter
@AllArgsConstructor
public class CreateFakeRankingsJob implements JobContextConsumer {

  private Long recruitmentId;
  private FakeRankingScope scope;
  private boolean includeNotInterested;
  private Random random;
  private FakeRankingsGenerator generator;
  private RecruitmentRepository recruitmentRepository;
  private RecruitmentCourseRepository recruitmentCourseRepository;
  private ApplicationRepository applicationRepository;
  private CandidateRankingRepository candidateRankingRepository;
  private RankingVersionService rankingVersionService;

  @Override
  public void accept(JobContext ctx) throws Exception {
    Recruitment recruitment =
        recruitmentRepository
            .findById(recruitmentId)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, recruitmentId));

    List<RecruitmentCourse> courses =
        recruitmentCourseRepository.findByRecruitmentId(recruitmentId);
    // The job only runs once Developer Mode is on, so fake applications count as real.
    List<Application> applications =
        AssignmentsService.real(
            applicationRepository.findByRecruitmentIdOrderByIdAsc(recruitmentId), true);
    Set<Long> alreadyRanked = new HashSet<>();
    for (RecruitmentCourse course : courses) {
      if (!candidateRankingRepository.findByRecruitmentCourseId(course.getId()).isEmpty()) {
        alreadyRanked.add(course.getId());
      }
    }

    ctx.log(
        "Creating fake rankings for %s courses of %s %s (%s)"
            .formatted(
                scope,
                recruitment.getType(),
                recruitment.getQuarter(),
                includeNotInterested ? "with some not-interested" : "interested only"));
    List<CandidateRanking> rankings =
        generator.generate(
            courses, applications, alreadyRanked, scope, includeNotInterested, random);
    candidateRankingRepository.saveAll(rankings);
    // The rankings of each course changed, so an instructor who has the list open must re-read it
    // before saving (issue #279).
    Set<Long> changed = new LinkedHashSet<>();
    rankings.forEach(ranking -> changed.add(ranking.getRecruitmentCourseId()));
    changed.forEach(rankingVersionService::bump);
    ctx.log("Created %d fake ranking(s).".formatted(rankings.size()));
  }
}
