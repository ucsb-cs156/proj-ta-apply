package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.CandidateRankingRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * The per-course hiring figures faculty see once the admin releases hiring targets (issue #224):
 * how many positions the course was allocated, how many candidates the instructor is asked to rank,
 * how many they have ranked, and how many are still needed.
 */
@Service
public class CourseTargetsService {

  @Autowired ApplicationRepository applicationRepository;
  @Autowired CandidateRankingRepository candidateRankingRepository;

  /**
   * One course's figures.
   *
   * @param allocation the TA or ULA positions the admin allocated to the course (0 when unset)
   * @param candidateCount the real, non-cancelled applicants who expressed interest in the course
   *     (first or second choice, Enthusiastic or Would Consider)
   * @param rankingTarget how many candidates the instructor is asked to rank: twice the allocation,
   *     but never more than there are interested candidates; 0 when nothing was allocated
   * @param rankedCount how many real, non-cancelled applicants the instructor has ranked for the
   *     course, interested or not (the same count as the admin's Rankings column)
   * @param stillNeeded rankingTarget minus rankedCount, never below 0
   */
  public record CourseTargets(
      Long recruitmentCourseId,
      int allocation,
      int candidateCount,
      int rankingTarget,
      int rankedCount,
      int stillNeeded) {}

  /** The figures for every course given, keyed by course id, loading the applications once. */
  public Map<Long, CourseTargets> targetsFor(Long recruitmentId, List<RecruitmentCourse> courses) {
    List<Application> real = realApplications(recruitmentId);
    Map<Long, CourseTargets> result = new LinkedHashMap<>();
    for (RecruitmentCourse course : courses) {
      result.put(course.getId(), targetsFor(course, real));
    }
    return result;
  }

  /** The figures for one course. */
  public CourseTargets targetsFor(Long recruitmentId, RecruitmentCourse course) {
    return targetsFor(course, realApplications(recruitmentId));
  }

  private List<Application> realApplications(Long recruitmentId) {
    return AssignmentsService.real(
        applicationRepository.findByRecruitmentIdOrderByIdAsc(recruitmentId));
  }

  private CourseTargets targetsFor(RecruitmentCourse course, List<Application> real) {
    Set<Long> realIds = real.stream().map(Application::getId).collect(Collectors.toSet());
    int candidateCount =
        (int)
            real.stream()
                .filter(a -> AssignmentsService.preference(a, course.getCourseId()) != null)
                .count();
    int rankedCount =
        (int)
            candidateRankingRepository.findByRecruitmentCourseId(course.getId()).stream()
                .filter(ranking -> ranking.getRank() != null)
                .filter(ranking -> realIds.contains(ranking.getApplicationId()))
                .count();
    int allocation = course.getAllocation() == null ? 0 : course.getAllocation();
    int rankingTarget = rankingTarget(allocation, candidateCount);
    return new CourseTargets(
        course.getId(),
        allocation,
        candidateCount,
        rankingTarget,
        rankedCount,
        stillNeeded(rankingTarget, rankedCount));
  }

  /**
   * Twice the allocation, capped at the interested candidates; 0 when nothing was allocated (and
   * never negative, whatever the inputs).
   */
  static int rankingTarget(int allocation, int candidateCount) {
    return Math.max(0, Math.min(2 * allocation, candidateCount));
  }

  /** How many more rankings are asked for; never negative. */
  static int stillNeeded(int rankingTarget, int rankedCount) {
    return Math.max(0, rankingTarget - rankedCount);
  }
}
