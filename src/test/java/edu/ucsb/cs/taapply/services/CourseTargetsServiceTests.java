package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.CandidateRanking;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.CourseInterest;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.CandidateRankingRepository;
import edu.ucsb.cs.taapply.services.CourseTargetsService.CourseTargets;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(classes = {CourseTargetsService.class})
@ActiveProfiles("test")
public class CourseTargetsServiceTests {

  @Autowired CourseTargetsService service;
  @MockitoBean ApplicationRepository applicationRepository;
  @MockitoBean CandidateRankingRepository candidateRankingRepository;

  private static final String C156 = "CMPSC   156";
  private static final String C8 = "CMPSC     8";

  private static RecruitmentCourse course(long id, String courseId, Integer allocation) {
    return RecruitmentCourse.builder()
        .id(id)
        .recruitmentId(7L)
        .courseId(courseId)
        .section("0100")
        .enrollCode("EC" + id)
        .allocation(allocation)
        .build();
  }

  private static Application applicant(long id, String first, String second) {
    return Application.builder()
        .id(id)
        .recruitmentId(7L)
        .email("a" + id + "@ucsb.edu")
        .firstChoiceCourse(first)
        .secondChoiceCourse(second)
        .build();
  }

  private static CandidateRanking ranking(long courseId, long applicationId, Integer rank) {
    return CandidateRanking.builder()
        .recruitmentCourseId(courseId)
        .applicationId(applicationId)
        .rank(rank)
        .build();
  }

  @Test
  public void counts_interested_candidates_and_rankings_of_real_applicants() {
    // Interested in 156: 1 (first), 2 (second), 3 (enthusiastic), 4 (would consider).
    Application enthusiastic = applicant(3L, C8, null);
    enthusiastic.getCourseInterests().put(C156, CourseInterest.ENTHUSIASTIC);
    Application wouldConsider = applicant(4L, C8, null);
    wouldConsider.getCourseInterests().put(C156, CourseInterest.WOULD_CONSIDER);
    // Not interested in 156: 5 (nothing), 6 (explicit NOT_INTERESTED).
    Application other = applicant(5L, C8, null);
    Application notInterested = applicant(6L, C8, null);
    notInterested.getCourseInterests().put(C156, CourseInterest.NOT_INTERESTED);
    // Excluded altogether: a test application and a cancelled one, both "interested".
    Application test = applicant(7L, C156, null);
    test.setTestApplication(true);
    Application cancelled = applicant(8L, C156, null);
    cancelled.setStatus(ApplicationReviewStatus.CANCELLED);
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(7L))
        .thenReturn(
            List.of(
                applicant(1L, C156, null),
                applicant(2L, C8, C156),
                enthusiastic,
                wouldConsider,
                other,
                notInterested,
                test,
                cancelled));
    // Ranked: 1, 3 and the not-interested 6 count; a blank rank, the test and the cancelled do not.
    when(candidateRankingRepository.findByRecruitmentCourseId(10L))
        .thenReturn(
            List.of(
                ranking(10L, 1L, 1),
                ranking(10L, 3L, 2),
                ranking(10L, 6L, 3),
                ranking(10L, 4L, null),
                ranking(10L, 7L, 4),
                ranking(10L, 8L, 5)));

    CourseTargets targets = service.targetsFor(7L, course(10L, C156, 3));

    // 2 × 3 = 6 asked for, but only 4 are interested; 3 ranked; 1 still needed.
    assertEquals(new CourseTargets(10L, 3, 4, 4, 3, 1), targets);
  }

  @Test
  public void twice_the_allocation_when_enough_candidates_are_interested() {
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(7L))
        .thenReturn(
            List.of(
                applicant(1L, C156, null),
                applicant(2L, C156, null),
                applicant(3L, C156, null),
                applicant(4L, C156, null),
                applicant(5L, C156, null)));
    when(candidateRankingRepository.findByRecruitmentCourseId(10L)).thenReturn(List.of());

    assertEquals(
        new CourseTargets(10L, 2, 5, 4, 0, 4), service.targetsFor(7L, course(10L, C156, 2)));
  }

  @Test
  public void no_allocation_means_no_target_and_nothing_needed_even_with_rankings() {
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(7L))
        .thenReturn(List.of(applicant(1L, C156, null), applicant(2L, C156, null)));
    when(candidateRankingRepository.findByRecruitmentCourseId(10L))
        .thenReturn(List.of(ranking(10L, 1L, 1)));

    assertEquals(
        new CourseTargets(10L, 0, 2, 0, 1, 0), service.targetsFor(7L, course(10L, C156, 0)));
    assertEquals(
        new CourseTargets(10L, 0, 2, 0, 1, 0), service.targetsFor(7L, course(10L, C156, null)));
  }

  @Test
  public void more_ranked_than_asked_leaves_nothing_still_needed() {
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(7L))
        .thenReturn(
            List.of(
                applicant(1L, C156, null), applicant(2L, C156, null), applicant(3L, C156, null)));
    when(candidateRankingRepository.findByRecruitmentCourseId(10L))
        .thenReturn(List.of(ranking(10L, 1L, 1), ranking(10L, 2L, 2), ranking(10L, 3L, 3)));

    assertEquals(
        new CourseTargets(10L, 1, 3, 2, 3, 0), service.targetsFor(7L, course(10L, C156, 1)));
  }

  @Test
  public void targets_for_several_courses_load_the_applications_once_and_keep_course_order() {
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(7L))
        .thenReturn(List.of(applicant(1L, C156, C8), applicant(2L, C8, null)));
    when(candidateRankingRepository.findByRecruitmentCourseId(10L))
        .thenReturn(List.of(ranking(10L, 1L, 1)));
    when(candidateRankingRepository.findByRecruitmentCourseId(11L)).thenReturn(List.of());

    Map<Long, CourseTargets> targets =
        service.targetsFor(7L, List.of(course(11L, C8, 2), course(10L, C156, 1)));

    assertEquals(List.of(11L, 10L), List.copyOf(targets.keySet()));
    assertEquals(new CourseTargets(11L, 2, 2, 2, 0, 2), targets.get(11L));
    assertEquals(new CourseTargets(10L, 1, 1, 1, 1, 0), targets.get(10L));
    verify(applicationRepository, times(1)).findByRecruitmentIdOrderByIdAsc(7L);
  }

  @Test
  public void no_courses_gives_an_empty_map() {
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(7L)).thenReturn(List.of());
    assertEquals(Map.of(), service.targetsFor(7L, List.of()));
  }

  @Test
  public void the_arithmetic_at_its_edges() {
    assertEquals(0, CourseTargetsService.rankingTarget(0, 9));
    assertEquals(0, CourseTargetsService.rankingTarget(-1, 9));
    assertEquals(0, CourseTargetsService.rankingTarget(2, 0));
    assertEquals(4, CourseTargetsService.rankingTarget(2, 4));
    assertEquals(4, CourseTargetsService.rankingTarget(2, 5));
    assertEquals(3, CourseTargetsService.rankingTarget(2, 3));
    assertEquals(0, CourseTargetsService.stillNeeded(0, 0));
    assertEquals(2, CourseTargetsService.stillNeeded(2, 0));
    assertEquals(0, CourseTargetsService.stillNeeded(2, 2));
    assertEquals(0, CourseTargetsService.stillNeeded(2, 5));
    assertEquals(1, CourseTargetsService.stillNeeded(3, 2));
  }
}
