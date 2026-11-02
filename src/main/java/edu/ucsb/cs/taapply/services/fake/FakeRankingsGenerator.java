package edu.ucsb.cs.taapply.services.fake;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.CandidateRanking;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.services.AssignmentsService;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * Builds the fake faculty rankings of Developer Mode (issue #220). Pure: it reads what it is given
 * and returns unsaved rows, drawing every choice from the supplied {@link Random}, so a seeded
 * source fixes the outcome.
 *
 * <p>For each chosen course it ranks as many interested candidates as the course's Ranking Target
 * asks for: twice the allocation (at least one), but never more than there are interested
 * candidates. With {@code includeNotInterested} it also ranks one or two applicants who did not
 * express interest, as an instructor who ranks beyond the list might. Ranks are 1..n in a random
 * order.
 */
@Service
public class FakeRankingsGenerator {

  /** At most this many not-interested applicants are added to a course when asked for. */
  static final int MAX_NOT_INTERESTED = 2;

  /**
   * @param courses the recruitment's sections
   * @param applications the applications that count as real
   * @param alreadyRanked ids of the sections that already have rankings; they are left alone
   */
  public List<CandidateRanking> generate(
      List<RecruitmentCourse> courses,
      List<Application> applications,
      Set<Long> alreadyRanked,
      FakeRankingScope scope,
      boolean includeNotInterested,
      Random random) {
    List<RecruitmentCourse> candidates =
        new ArrayList<>(
            courses.stream()
                .filter(RecruitmentCourse::isOnOffer)
                .filter(course -> !alreadyRanked.contains(course.getId()))
                .toList());
    List<RecruitmentCourse> chosen = choose(candidates, scope, random);

    List<CandidateRanking> rankings = new ArrayList<>();
    for (RecruitmentCourse course : chosen) {
      rankings.addAll(rankCourse(course, applications, includeNotInterested, random));
    }
    return rankings;
  }

  /** All the courses, or a random non-empty part of them (strictly fewer when there are two+). */
  static List<RecruitmentCourse> choose(
      List<RecruitmentCourse> courses, FakeRankingScope scope, Random random) {
    if (scope == FakeRankingScope.ALL) {
      return courses;
    }
    Collections.shuffle(courses, random);
    return courses.subList(0, someCount(courses.size(), random));
  }

  /** Between 1 and size-1 (or size, when that is below 2), never more than size. */
  static int someCount(int size, Random random) {
    return Math.min(size, 1 + random.nextInt(Math.max(1, size - 1)));
  }

  /** How many interested candidates to rank: twice the allocation (at least 1), capped. */
  static int target(Integer allocation, int interested) {
    int allocated = allocation == null ? 0 : allocation;
    return Math.min(Math.max(1, 2 * allocated), interested);
  }

  private List<CandidateRanking> rankCourse(
      RecruitmentCourse course,
      List<Application> applications,
      boolean includeNotInterested,
      Random random) {
    List<Application> interested = new ArrayList<>();
    List<Application> notInterested = new ArrayList<>();
    for (Application application : applications) {
      if (AssignmentsService.preference(application, course.getCourseId()) == null) {
        notInterested.add(application);
      } else {
        interested.add(application);
      }
    }
    Collections.shuffle(interested, random);
    Collections.shuffle(notInterested, random);

    List<Application> ranked =
        new ArrayList<>(interested.subList(0, target(course.getAllocation(), interested.size())));
    if (includeNotInterested) {
      int extra = Math.min(notInterested.size(), 1 + random.nextInt(MAX_NOT_INTERESTED));
      ranked.addAll(notInterested.subList(0, extra));
    }
    Collections.shuffle(ranked, random);

    List<CandidateRanking> rows = new ArrayList<>();
    for (int i = 0; i < ranked.size(); i++) {
      rows.add(
          CandidateRanking.builder()
              .recruitmentCourseId(course.getId())
              .applicationId(ranked.get(i).getId())
              .rank(i + 1)
              .build());
    }
    return rows;
  }
}
