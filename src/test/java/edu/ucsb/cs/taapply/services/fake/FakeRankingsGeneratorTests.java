package edu.ucsb.cs.taapply.services.fake;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.CandidateRanking;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.CourseInterest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

public class FakeRankingsGeneratorTests {

  private static final FakeRankingsGenerator generator = new FakeRankingsGenerator();

  private static RecruitmentCourse course(long id, String courseId, Integer allocation) {
    return RecruitmentCourse.builder().id(id).courseId(courseId).allocation(allocation).build();
  }

  /** An application whose first choice is the given course (or none) and with extra interests. */
  private static Application app(long id, String first, Map<String, CourseInterest> interests) {
    return Application.builder()
        .id(id)
        .firstChoiceCourse(first)
        .courseInterests(new HashMap<>(interests))
        .build();
  }

  private static List<CandidateRanking> forCourse(List<CandidateRanking> all, long courseId) {
    return all.stream().filter(r -> r.getRecruitmentCourseId() == courseId).toList();
  }

  private static Set<Long> applicationIds(List<CandidateRanking> rankings) {
    return rankings.stream().map(CandidateRanking::getApplicationId).collect(Collectors.toSet());
  }

  private static Set<Long> courseIds(List<CandidateRanking> rankings) {
    return rankings.stream()
        .map(CandidateRanking::getRecruitmentCourseId)
        .collect(Collectors.toSet());
  }

  /** Apps 1..5 first-choose C1; apps 1..3 are also Enthusiastic for C2; apps 6..8 want neither. */
  private static List<Application> applications() {
    List<Application> apps = new ArrayList<>();
    for (long id = 1; id <= 5; id++) {
      apps.add(app(id, "C1", id <= 3 ? Map.of("C2", CourseInterest.ENTHUSIASTIC) : Map.of()));
    }
    for (long id = 6; id <= 8; id++) {
      apps.add(app(id, null, Map.of()));
    }
    return apps;
  }

  /**
   * One applicant per tier of interest in C1, listed in reverse tier order so that tier order and
   * input order differ (issue #414): apps 1 and 2 first-choose C1, app 3 second-chooses it, apps 4
   * and 5 are Enthusiastic, apps 6 and 7 Would Consider, and apps 8 and 9 expressed no interest.
   */
  private static List<Application> tiered() {
    List<Application> apps = new ArrayList<>();
    apps.add(app(9, null, Map.of()));
    apps.add(app(8, null, Map.of()));
    apps.add(app(7, "C9", Map.of("C1", CourseInterest.WOULD_CONSIDER)));
    apps.add(app(6, null, Map.of("C1", CourseInterest.WOULD_CONSIDER)));
    apps.add(app(5, null, Map.of("C1", CourseInterest.ENTHUSIASTIC)));
    apps.add(app(4, "C9", Map.of("C1", CourseInterest.ENTHUSIASTIC)));
    apps.add(
        Application.builder()
            .id(3L)
            .firstChoiceCourse("C9")
            .secondChoiceCourse("C1")
            .courseInterests(new HashMap<>())
            .build());
    apps.add(app(2, "C1", Map.of()));
    apps.add(app(1, "C1", Map.of("C9", CourseInterest.ENTHUSIASTIC)));
    return apps;
  }

  private static List<Long> rankedIds(List<CandidateRanking> rankings) {
    return rankings.stream()
        .sorted(Comparator.comparing(CandidateRanking::getRank))
        .map(CandidateRanking::getApplicationId)
        .toList();
  }

  private static List<CandidateRanking> rankTiered(
      Integer allocation, boolean includeNotInterested, long seed) {
    return generator.generate(
        List.of(course(1, "C1", allocation)),
        tiered(),
        Set.of(),
        FakeRankingScope.ALL,
        includeNotInterested,
        new Random(seed));
  }

  // ---- all courses ----

  @Test
  public void all_ranks_twice_the_allocation_of_interested_candidates_in_each_course() {
    List<RecruitmentCourse> courses = List.of(course(1, "C1", 2), course(2, "C2", 1));

    List<CandidateRanking> rankings =
        generator.generate(
            courses, applications(), Set.of(), FakeRankingScope.ALL, false, new Random(3));

    List<CandidateRanking> c1 = forCourse(rankings, 1);
    List<CandidateRanking> c2 = forCourse(rankings, 2);
    // C1: min(2 * 2, 5 interested) = 4.  C2: min(2 * 1, 3 interested) = 2.
    assertEquals(4, c1.size());
    assertEquals(2, c2.size());
    assertEquals(6, rankings.size());
    // Only interested applicants, each once, ranked 1..n.
    assertTrue(Set.of(1L, 2L, 3L, 4L, 5L).containsAll(applicationIds(c1)));
    assertEquals(4, applicationIds(c1).size());
    assertTrue(Set.of(1L, 2L, 3L).containsAll(applicationIds(c2)));
    assertEquals(
        Set.of(1, 2, 3, 4), c1.stream().map(CandidateRanking::getRank).collect(Collectors.toSet()));
    assertEquals(
        Set.of(1, 2), c2.stream().map(CandidateRanking::getRank).collect(Collectors.toSet()));
  }

  @Test
  public void the_target_is_capped_at_the_interested_candidates() {
    // Allocation 5 would ask for 10, but only 3 applicants are interested in C2.
    List<CandidateRanking> rankings =
        generator.generate(
            List.of(course(2, "C2", 5)),
            applications(),
            Set.of(),
            FakeRankingScope.ALL,
            false,
            new Random(3));

    assertEquals(Set.of(1L, 2L, 3L), applicationIds(rankings));
  }

  @Test
  public void a_course_with_no_interested_candidates_gets_no_rankings() {
    List<CandidateRanking> rankings =
        generator.generate(
            List.of(course(3, "C3", 2)),
            applications(),
            Set.of(),
            FakeRankingScope.ALL,
            false,
            new Random(3));

    assertTrue(rankings.isEmpty());
  }

  @Test
  public void sections_off_offer_and_already_ranked_are_left_alone() {
    RecruitmentCourse removed = course(3, "C1", 2);
    removed.setRemoved(true);
    RecruitmentCourse stale = course(4, "C1", 2);
    stale.setStale(true);
    RecruitmentCourse cancelled = course(5, "C1", 2);
    cancelled.setStatus(RecruitmentCourse.CANCELLED);
    List<RecruitmentCourse> courses =
        List.of(course(1, "C1", 2), course(2, "C2", 1), removed, stale, cancelled);

    List<CandidateRanking> rankings =
        generator.generate(
            courses, applications(), Set.of(2L), FakeRankingScope.ALL, false, new Random(3));

    assertEquals(Set.of(1L), courseIds(rankings));
  }

  @Test
  public void rankings_are_new_rows_for_the_course() {
    List<CandidateRanking> rankings =
        generator.generate(
            List.of(course(1, "C1", 1)),
            applications(),
            Set.of(),
            FakeRankingScope.ALL,
            false,
            new Random(3));

    assertEquals(2, rankings.size());
    for (CandidateRanking ranking : rankings) {
      assertNull(ranking.getId());
      assertEquals(1L, ranking.getRecruitmentCourseId());
    }
  }

  // ---- not interested ----

  @Test
  public void without_the_flag_nobody_uninterested_is_ranked() {
    for (long seed = 0; seed < 30; seed++) {
      List<CandidateRanking> rankings =
          generator.generate(
              List.of(course(1, "C1", 3)),
              applications(),
              Set.of(),
              FakeRankingScope.ALL,
              false,
              new Random(seed));
      assertTrue(Set.of(1L, 2L, 3L, 4L, 5L).containsAll(applicationIds(rankings)));
    }
  }

  @Test
  public void with_the_flag_one_or_two_uninterested_applicants_are_added() {
    Set<Long> extras = new HashSet<>();
    for (long seed = 0; seed < 60; seed++) {
      // Allocation 1 ranks 2 of the 5 interested; apps 6..8 are not interested in C1.
      List<CandidateRanking> rankings =
          generator.generate(
              List.of(course(1, "C1", 1)),
              applications(),
              Set.of(),
              FakeRankingScope.ALL,
              true,
              new Random(seed));
      long uninterested = rankings.stream().filter(r -> r.getApplicationId() >= 6).count();
      extras.add(uninterested);
      assertEquals(2 + uninterested, rankings.size());
    }
    assertEquals(Set.of(1L, 2L), extras);
  }

  @Test
  public void with_one_uninterested_applicant_only_one_is_added() {
    List<Application> apps = new ArrayList<>(applications().subList(0, 6));
    for (long seed = 0; seed < 30; seed++) {
      List<CandidateRanking> rankings =
          generator.generate(
              List.of(course(1, "C1", 1)),
              apps,
              Set.of(),
              FakeRankingScope.ALL,
              true,
              new Random(seed));
      assertEquals(3, rankings.size());
      assertTrue(applicationIds(rankings).contains(6L));
    }
  }

  @Test
  public void with_the_flag_and_nobody_uninterested_nothing_extra_is_added() {
    List<Application> everyoneInterested = applications().subList(0, 5);
    List<CandidateRanking> rankings =
        generator.generate(
            List.of(course(1, "C1", 1)),
            everyoneInterested,
            Set.of(),
            FakeRankingScope.ALL,
            true,
            new Random(1));

    assertEquals(2, rankings.size());
  }

  // ---- interest tiers (issue #414) ----

  @Test
  public void tier_is_the_index_of_the_preference_strongest_first_or_minus_one() {
    List<Application> apps = tiered();
    Map<Long, Integer> tiers = new HashMap<>();
    for (Application app : apps) {
      tiers.put(app.getId(), FakeRankingsGenerator.tier(app, "C1"));
    }

    assertEquals(0, tiers.get(1L));
    assertEquals(0, tiers.get(2L));
    assertEquals(1, tiers.get(3L));
    assertEquals(2, tiers.get(4L));
    assertEquals(2, tiers.get(5L));
    assertEquals(3, tiers.get(6L));
    assertEquals(3, tiers.get(7L));
    assertEquals(-1, tiers.get(8L));
    assertEquals(-1, tiers.get(9L));
    assertEquals(FakeRankingsGenerator.NOT_INTERESTED, tiers.get(8L));
    assertEquals(
        List.of("1st Choice", "2nd Choice", "Enthusiastic", "Would Consider"),
        FakeRankingsGenerator.TIERS);
  }

  @Test
  public void candidates_are_ranked_by_tier_first_choice_at_the_top() {
    for (long seed = 0; seed < 30; seed++) {
      // Allocation 4 asks for 8; all 7 interested candidates are ranked, in tier order.
      List<Long> ids = rankedIds(rankTiered(4, false, seed));

      assertEquals(7, ids.size());
      assertEquals(Set.of(1L, 2L), Set.copyOf(ids.subList(0, 2)), ids.toString());
      assertEquals(List.of(3L), ids.subList(2, 3), ids.toString());
      assertEquals(Set.of(4L, 5L), Set.copyOf(ids.subList(3, 5)), ids.toString());
      assertEquals(Set.of(6L, 7L), Set.copyOf(ids.subList(5, 7)), ids.toString());
    }
  }

  @Test
  public void within_a_tier_the_order_is_random() {
    Set<List<Long>> firstChoiceOrders = new HashSet<>();
    Set<List<Long>> enthusiasticOrders = new HashSet<>();
    Set<List<Long>> wouldConsiderOrders = new HashSet<>();
    // Spread the seeds out: the first draw of java.util.Random is alike for neighbouring seeds.
    for (long seed = 0; seed < 60 * 7919; seed += 7919) {
      List<Long> ids = rankedIds(rankTiered(4, false, seed));
      firstChoiceOrders.add(ids.subList(0, 2));
      enthusiasticOrders.add(ids.subList(3, 5));
      wouldConsiderOrders.add(ids.subList(5, 7));
    }

    assertEquals(Set.of(List.of(1L, 2L), List.of(2L, 1L)), firstChoiceOrders);
    assertEquals(Set.of(List.of(4L, 5L), List.of(5L, 4L)), enthusiasticOrders);
    assertEquals(Set.of(List.of(6L, 7L), List.of(7L, 6L)), wouldConsiderOrders);
  }

  @Test
  public void would_consider_is_left_out_when_the_first_three_tiers_fill_the_target() {
    for (long seed = 0; seed < 30; seed++) {
      // Allocation 2 asks for 4; the first three tiers hold 5, so nobody from Would Consider.
      List<Long> ids = rankedIds(rankTiered(2, false, seed));

      assertEquals(4, ids.size());
      assertEquals(Set.of(1L, 2L), Set.copyOf(ids.subList(0, 2)), ids.toString());
      assertEquals(List.of(3L), ids.subList(2, 3), ids.toString());
      assertTrue(Set.of(4L, 5L).contains(ids.get(3)), ids.toString());
    }
  }

  @Test
  public void the_target_is_filled_in_tier_order_so_a_small_one_takes_first_choices_only() {
    for (long seed = 0; seed < 30; seed++) {
      // Allocation 1 asks for 2: both first-choice candidates, nobody from a lower tier.
      assertEquals(Set.of(1L, 2L), applicationIds(rankTiered(1, false, seed)));
      // No allocation asks for 1: one first-choice candidate.
      List<Long> one = rankedIds(rankTiered(null, false, seed));
      assertEquals(1, one.size());
      assertTrue(Set.of(1L, 2L).contains(one.get(0)), one.toString());
    }
  }

  @Test
  public void would_consider_makes_up_the_shortfall_only() {
    Set<Long> fillers = new HashSet<>();
    for (long seed = 0; seed < 30; seed++) {
      // Allocation 3 asks for 6; the first three tiers hold 5, so exactly one Would Consider.
      List<Long> ids = rankedIds(rankTiered(3, false, seed));

      assertEquals(6, ids.size());
      assertEquals(Set.of(1L, 2L, 3L, 4L, 5L), Set.copyOf(ids.subList(0, 5)), ids.toString());
      assertTrue(Set.of(6L, 7L).contains(ids.get(5)), ids.toString());
      fillers.add(ids.get(5));
    }
    assertEquals(Set.of(6L, 7L), fillers);
  }

  @Test
  public void not_interested_applicants_come_last_after_every_interested_candidate() {
    Set<Integer> extras = new HashSet<>();
    for (long seed = 0; seed < 60; seed++) {
      // Allocation 3 ranks 6 interested; then one or two of apps 8 and 9.
      List<Long> ids = rankedIds(rankTiered(3, true, seed));

      int extra = ids.size() - 6;
      extras.add(extra);
      assertTrue(extra == 1 || extra == 2, ids.toString());
      assertEquals(Set.of(1L, 2L, 3L, 4L, 5L), Set.copyOf(ids.subList(0, 5)), ids.toString());
      assertTrue(Set.of(6L, 7L).contains(ids.get(5)), ids.toString());
      assertTrue(Set.of(8L, 9L).containsAll(ids.subList(6, ids.size())), ids.toString());
    }
    assertEquals(Set.of(1, 2), extras);
  }

  @Test
  public void not_interested_applicants_come_last_even_when_the_target_leaves_tiers_unranked() {
    for (long seed = 0; seed < 30; seed++) {
      // Allocation 1 ranks the two first-choice candidates, then the not-interested.
      List<Long> ids = rankedIds(rankTiered(1, true, seed));

      assertEquals(Set.of(1L, 2L), Set.copyOf(ids.subList(0, 2)), ids.toString());
      assertTrue(ids.size() >= 3 && ids.size() <= 4, ids.toString());
      assertTrue(Set.of(8L, 9L).containsAll(ids.subList(2, ids.size())), ids.toString());
    }
  }

  @Test
  public void ranks_are_one_to_n_in_list_order() {
    List<CandidateRanking> rankings = rankTiered(4, true, 5);

    assertEquals(
        IntStream.rangeClosed(1, rankings.size()).boxed().toList(),
        rankings.stream().map(CandidateRanking::getRank).toList());
  }

  // ---- randomness ----

  @Test
  public void the_draws_are_made_in_the_documented_order() {
    long seed = 11;
    List<CandidateRanking> rankings = rankTiered(3, true, seed);

    // Replay by hand: shuffle each tier strongest first, shuffle the uninterested, how many extra.
    // No shuffle of the whole list: it stays in tier order (issue #414).
    Random replay = new Random(seed);
    List<Long> firstChoice = new ArrayList<>(List.of(2L, 1L));
    List<Long> secondChoice = new ArrayList<>(List.of(3L));
    List<Long> enthusiastic = new ArrayList<>(List.of(5L, 4L));
    List<Long> wouldConsider = new ArrayList<>(List.of(7L, 6L));
    List<Long> uninterested = new ArrayList<>(List.of(9L, 8L));
    Collections.shuffle(firstChoice, replay);
    Collections.shuffle(secondChoice, replay);
    Collections.shuffle(enthusiastic, replay);
    Collections.shuffle(wouldConsider, replay);
    Collections.shuffle(uninterested, replay);
    int extra = Math.min(2, 1 + replay.nextInt(2));
    List<Long> ranked = new ArrayList<>(firstChoice);
    ranked.addAll(secondChoice);
    ranked.addAll(enthusiastic);
    ranked.addAll(wouldConsider.subList(0, 1));
    ranked.addAll(uninterested.subList(0, extra));

    assertEquals(ranked, rankings.stream().map(CandidateRanking::getApplicationId).toList());
    assertEquals(
        IntStream.rangeClosed(1, ranked.size()).boxed().toList(),
        rankings.stream().map(CandidateRanking::getRank).toList());
  }

  // ---- some courses ----

  @Test
  public void some_ranks_a_non_empty_part_of_the_courses_never_all_of_them() {
    List<RecruitmentCourse> courses =
        List.of(course(1, "C1", 1), course(2, "C1", 1), course(3, "C1", 1), course(4, "C1", 1));
    Set<Integer> counts = new HashSet<>();
    for (long seed = 0; seed < 80; seed++) {
      List<CandidateRanking> rankings =
          generator.generate(
              courses, applications(), Set.of(), FakeRankingScope.SOME, false, new Random(seed));
      counts.add(courseIds(rankings).size());
    }
    assertEquals(Set.of(1, 2, 3), counts);
  }

  @Test
  public void some_of_a_single_course_ranks_it() {
    List<CandidateRanking> rankings =
        generator.generate(
            List.of(course(1, "C1", 1)),
            applications(),
            Set.of(),
            FakeRankingScope.SOME,
            false,
            new Random(1));

    assertFalse(rankings.isEmpty());
  }

  @Test
  public void some_of_no_courses_is_nothing() {
    assertTrue(
        generator
            .generate(
                List.of(), applications(), Set.of(), FakeRankingScope.SOME, false, new Random(1))
            .isEmpty());
  }

  @Test
  public void choose_returns_the_same_list_for_all() {
    List<RecruitmentCourse> courses =
        new ArrayList<>(List.of(course(1, "C1", 1), course(2, "C2", 1)));

    assertSame(courses, FakeRankingsGenerator.choose(courses, FakeRankingScope.ALL, new Random(1)));
  }

  @Test
  public void choose_some_shuffles_the_courses_then_takes_the_first_few() {
    List<RecruitmentCourse> courses =
        new ArrayList<>(
            List.of(
                course(1, "C1", 1), course(2, "C1", 1), course(3, "C1", 1), course(4, "C1", 1)));
    List<RecruitmentCourse> expected = new ArrayList<>(courses);
    Random replay = new Random(9);
    Collections.shuffle(expected, replay);
    expected = expected.subList(0, FakeRankingsGenerator.someCount(4, replay));

    assertEquals(
        expected, FakeRankingsGenerator.choose(courses, FakeRankingScope.SOME, new Random(9)));
  }

  @Test
  public void someCount_is_between_one_and_size_minus_one() {
    Random random = mock(Random.class);
    when(random.nextInt(4)).thenReturn(0, 2, 3);

    assertEquals(1, FakeRankingsGenerator.someCount(5, random));
    assertEquals(3, FakeRankingsGenerator.someCount(5, random));
    assertEquals(4, FakeRankingsGenerator.someCount(5, random));
  }

  @Test
  public void someCount_of_two_is_one_and_of_one_is_one_and_of_none_is_none() {
    Random random = mock(Random.class);
    when(random.nextInt(1)).thenReturn(0);

    assertEquals(1, FakeRankingsGenerator.someCount(2, random));
    assertEquals(1, FakeRankingsGenerator.someCount(1, random));
    assertEquals(0, FakeRankingsGenerator.someCount(0, random));
  }

  // ---- target ----

  @Test
  public void target_is_twice_the_allocation_at_least_one_and_at_most_the_interested() {
    assertEquals(4, FakeRankingsGenerator.target(2, 9));
    assertEquals(2, FakeRankingsGenerator.target(1, 9));
    assertEquals(1, FakeRankingsGenerator.target(0, 9));
    assertEquals(1, FakeRankingsGenerator.target(null, 9));
    assertEquals(3, FakeRankingsGenerator.target(2, 3));
    assertEquals(4, FakeRankingsGenerator.target(2, 4));
    assertEquals(0, FakeRankingsGenerator.target(2, 0));
    assertEquals(0, FakeRankingsGenerator.target(null, 0));
  }
}
