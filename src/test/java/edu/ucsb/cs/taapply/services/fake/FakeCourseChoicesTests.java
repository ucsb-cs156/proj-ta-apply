package edu.ucsb.cs.taapply.services.fake;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.enums.CourseInterest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import org.junit.jupiter.api.Test;

/** The ALL and SPARSE rules of the Developer Mode design, asserted with seeded random sources. */
public class FakeCourseChoicesTests {

  private static List<String> courses(int count) {
    List<String> courses = new ArrayList<>();
    for (int i = 0; i < count; i++) {
      courses.add("C" + i);
    }
    return courses;
  }

  private static List<Application> applications(int count) {
    List<Application> applications = new ArrayList<>();
    for (int i = 0; i < count; i++) {
      applications.add(Application.builder().build());
    }
    return applications;
  }

  private static List<Application> assigned(
      int applicationCount, int courseCount, FakeCoverage coverage, long seed) {
    List<Application> applications = applications(applicationCount);
    FakeCourseChoices.assign(applications, courses(courseCount), coverage, new Random(seed));
    return applications;
  }

  /** The applicants who mention a course at all: as a first or second choice, or an interest. */
  private static Map<String, List<Application>> mentions(
      List<Application> applications, List<String> courses) {
    Map<String, List<Application>> byCourse = new HashMap<>();
    courses.forEach(c -> byCourse.put(c, new ArrayList<>()));
    for (Application a : applications) {
      Set<String> mentioned = new HashSet<>(a.getCourseInterests().keySet());
      mentioned.add(a.getFirstChoiceCourse());
      mentioned.add(a.getSecondChoiceCourse());
      mentioned.remove(null);
      mentioned.forEach(c -> byCourse.get(c).add(a));
    }
    return byCourse;
  }

  private static long seed(int i) {
    return i * 1_000_003L + 29;
  }

  // ---- ALL ----

  @Test
  public void with_all_every_course_has_at_least_one_applicant() {
    for (int i = 0; i < 40; i++) {
      List<Application> applications = assigned(12, 6, FakeCoverage.ALL, seed(i));
      Map<String, List<Application>> byCourse = mentions(applications, courses(6));

      byCourse.forEach((course, who) -> assertFalse(who.isEmpty(), course + " has no applicant"));
    }
  }

  @Test
  public void with_all_the_first_applicants_are_dealt_the_courses_as_first_choices_in_turn() {
    List<Application> applications = assigned(14, 6, FakeCoverage.ALL, seed(1));

    for (int i = 0; i < 6; i++) {
      assertEquals("C" + i, applications.get(i).getFirstChoiceCourse());
    }
  }

  @Test
  public void with_all_there_may_be_fewer_applicants_than_courses() {
    // Two applicants, five courses: the extra courses go to second choices, then Enthusiastic.
    for (int i = 0; i < 40; i++) {
      List<Application> applications = assigned(2, 5, FakeCoverage.ALL, seed(i));
      mentions(applications, courses(5))
          .forEach((course, who) -> assertFalse(who.isEmpty(), course + " has no applicant"));
      for (Application a : applications) {
        assertNotEquals(a.getFirstChoiceCourse(), a.getSecondChoiceCourse());
      }
    }
    List<Application> applications = assigned(2, 5, FakeCoverage.ALL, seed(0));
    assertEquals("C0", applications.get(0).getFirstChoiceCourse());
    assertEquals("C1", applications.get(1).getFirstChoiceCourse());
    assertEquals("C2", applications.get(0).getSecondChoiceCourse());
    assertEquals("C3", applications.get(1).getSecondChoiceCourse());
    assertEquals(CourseInterest.ENTHUSIASTIC, applications.get(0).getCourseInterests().get("C4"));
  }

  @Test
  public void with_more_than_three_courses_per_applicant_only_three_are_dealt_out() {
    // One applicant can be dealt a first choice, a second and one Enthusiastic course; the other
    // courses are then left to chance, since no one else can take them.
    List<Application> applications = assigned(1, 6, FakeCoverage.ALL, seed(15));

    Application only = applications.get(0);
    assertEquals("C0", only.getFirstChoiceCourse());
    assertEquals("C1", only.getSecondChoiceCourse());
    assertEquals(CourseInterest.ENTHUSIASTIC, only.getCourseInterests().get("C2"));
    assertFalse(only.getCourseInterests().containsKey("C0"));
    assertFalse(only.getCourseInterests().containsKey("C1"));
  }

  @Test
  public void a_second_choice_is_never_the_first_and_may_be_absent() {
    List<Application> applications = assigned(4000, 4, FakeCoverage.ALL, seed(2));

    int absent = 0;
    for (Application a : applications.subList(4, applications.size())) {
      assertNotEquals(a.getFirstChoiceCourse(), a.getSecondChoiceCourse());
      if (a.getSecondChoiceCourse() == null) {
        absent++;
      }
    }
    // "No second choice" is one of four equally likely outcomes beside the three other courses.
    assertEquals(0.25, absent / 3996.0, 0.03);
  }

  @Test
  public void first_and_second_choices_are_uniform() {
    List<Application> applications = assigned(8000, 4, FakeCoverage.ALL, seed(3));
    Map<String, Integer> firsts = new HashMap<>();
    Map<String, Integer> seconds = new HashMap<>();
    for (Application a : applications.subList(4, applications.size())) {
      firsts.merge(a.getFirstChoiceCourse(), 1, Integer::sum);
      if (a.getSecondChoiceCourse() != null) {
        seconds.merge(a.getSecondChoiceCourse(), 1, Integer::sum);
      }
    }

    for (String course : courses(4)) {
      // A quarter of the first choices; and three quarters of the time a course other than the
      // first is picked from among the three, so each is second with probability 3/4 * 1/3.
      assertEquals(0.25, firsts.get(course) / 7996.0, 0.03);
      assertEquals(0.1875, seconds.get(course) / 7996.0, 0.03);
    }
  }

  @Test
  public void other_courses_are_enthusiastic_twenty_percent_and_would_consider_forty() {
    List<Application> applications = assigned(5000, 6, FakeCoverage.ALL, seed(4));

    long others = 0;
    long enthusiastic = 0;
    long wouldConsider = 0;
    for (Application a : applications) {
      // Every course but the first and second choice gets its own roll.
      others += 6 - 1 - (a.getSecondChoiceCourse() == null ? 0 : 1);
      for (CourseInterest interest : a.getCourseInterests().values()) {
        assertNotEquals(CourseInterest.NOT_INTERESTED, interest);
        if (interest == CourseInterest.ENTHUSIASTIC) {
          enthusiastic++;
        } else {
          wouldConsider++;
        }
      }
    }
    assertEquals(0.2, enthusiastic / (double) others, 0.02);
    assertEquals(0.4, wouldConsider / (double) others, 0.02);
  }

  @Test
  public void a_choice_is_never_also_an_interest() {
    for (Application a : assigned(300, 6, FakeCoverage.ALL, seed(5))) {
      assertFalse(a.getCourseInterests().containsKey(a.getFirstChoiceCourse()));
      assertFalse(a.getCourseInterests().containsKey(a.getSecondChoiceCourse()));
    }
  }

  @Test
  public void a_single_course_is_everyone_s_first_choice_and_there_is_no_second() {
    for (Application a : assigned(10, 1, FakeCoverage.ALL, seed(6))) {
      assertEquals("C0", a.getFirstChoiceCourse());
      assertNull(a.getSecondChoiceCourse());
      assertTrue(a.getCourseInterests().isEmpty());
    }
  }

  // ---- SPARSE ----

  @Test
  public void with_sparse_one_course_has_nobody_and_one_has_exactly_three() {
    for (int i = 0; i < 60; i++) {
      List<Application> applications = assigned(60, 6, FakeCoverage.SPARSE, seed(i));
      Map<String, List<Application>> byCourse = mentions(applications, courses(6));

      List<String> none = new ArrayList<>();
      List<String> three = new ArrayList<>();
      byCourse.forEach(
          (course, who) -> {
            if (who.isEmpty()) {
              none.add(course);
            } else if (who.size() == 3) {
              three.add(course);
            } else {
              assertTrue(who.size() >= 1);
            }
          });
      assertEquals(1, none.size(), "seed " + i);
      assertEquals(1, three.size(), "seed " + i);

      // The three: one Enthusiastic, two Would Consider, none as a first or second choice.
      String thin = three.get(0);
      List<CourseInterest> levels = new ArrayList<>();
      for (Application a : byCourse.get(thin)) {
        assertNotEquals(thin, a.getFirstChoiceCourse());
        assertNotEquals(thin, a.getSecondChoiceCourse());
        levels.add(a.getCourseInterests().get(thin));
      }
      assertEquals(1, levels.stream().filter(CourseInterest.ENTHUSIASTIC::equals).count());
      assertEquals(2, levels.stream().filter(CourseInterest.WOULD_CONSIDER::equals).count());
    }
  }

  @Test
  public void with_sparse_every_other_course_still_has_an_applicant() {
    for (int i = 0; i < 60; i++) {
      List<Application> applications = assigned(60, 6, FakeCoverage.SPARSE, seed(i));
      long covered =
          mentions(applications, courses(6)).values().stream().filter(w -> w.size() > 3).count();
      assertEquals(4, covered, "seed " + i);
    }
  }

  @Test
  public void with_sparse_the_zero_and_three_courses_are_chosen_at_random() {
    Set<String> zeros = new HashSet<>();
    Set<String> threes = new HashSet<>();
    for (int i = 0; i < 100; i++) {
      Map<String, List<Application>> byCourse =
          mentions(assigned(60, 6, FakeCoverage.SPARSE, seed(i)), courses(6));
      byCourse.forEach(
          (course, who) -> {
            if (who.isEmpty()) {
              zeros.add(course);
            } else if (who.size() == 3) {
              threes.add(course);
            }
          });
    }
    assertEquals(new HashSet<>(courses(6)), zeros);
    assertEquals(new HashSet<>(courses(6)), threes);
  }

  @Test
  public void with_sparse_the_rest_follow_the_all_rules() {
    List<Application> applications = assigned(4000, 6, FakeCoverage.SPARSE, seed(7));
    Map<String, Integer> firsts = new HashMap<>();
    for (Application a : applications) {
      firsts.merge(a.getFirstChoiceCourse(), 1, Integer::sum);
      if (a.getSecondChoiceCourse() != null) {
        assertNotEquals(a.getFirstChoiceCourse(), a.getSecondChoiceCourse());
      }
    }
    // Four courses remain, so each is about a quarter of the first choices.
    assertEquals(4, firsts.size());
    firsts.values().forEach(count -> assertEquals(0.25, count / 4000.0, 0.03));
  }

  @Test
  public void with_sparse_and_two_courses_nobody_chooses_any_but_three_are_interested() {
    List<Application> applications = assigned(20, 2, FakeCoverage.SPARSE, seed(8));
    int interested = 0;
    for (Application a : applications) {
      assertNull(a.getFirstChoiceCourse());
      assertNull(a.getSecondChoiceCourse());
      interested += a.getCourseInterests().size();
    }
    assertEquals(3, interested);
  }

  @Test
  public void with_sparse_and_three_courses_the_one_left_is_everyone_s_first_choice() {
    for (Application a : assigned(20, 3, FakeCoverage.SPARSE, seed(9))) {
      assertNotNull(a.getFirstChoiceCourse());
      assertNull(a.getSecondChoiceCourse());
    }
  }

  @Test
  public void with_sparse_and_one_course_nobody_mentions_it() {
    for (Application a : assigned(10, 1, FakeCoverage.SPARSE, seed(10))) {
      assertNull(a.getFirstChoiceCourse());
      assertNull(a.getSecondChoiceCourse());
      assertTrue(a.getCourseInterests().isEmpty());
    }
  }

  @Test
  public void
      with_sparse_and_fewer_than_three_applicants_those_there_are_mention_the_thin_course() {
    for (int i = 0; i < 40; i++) {
      List<Application> applications = assigned(2, 6, FakeCoverage.SPARSE, seed(i));
      Map<String, List<Application>> byCourse = mentions(applications, courses(6));

      // The thin course is the one both mention, one Enthusiastic and one Would Consider, neither
      // as a choice. (Another course may also be mentioned by both, by chance.)
      boolean found = false;
      for (Map.Entry<String, List<Application>> entry : byCourse.entrySet()) {
        List<CourseInterest> levels =
            applications.stream()
                .filter(a -> a.getCourseInterests().containsKey(entry.getKey()))
                .map(a -> a.getCourseInterests().get(entry.getKey()))
                .toList();
        boolean asChoice =
            applications.stream()
                .anyMatch(
                    a ->
                        entry.getKey().equals(a.getFirstChoiceCourse())
                            || entry.getKey().equals(a.getSecondChoiceCourse()));
        found |=
            !asChoice
                && levels.size() == 2
                && levels.contains(CourseInterest.ENTHUSIASTIC)
                && levels.contains(CourseInterest.WOULD_CONSIDER);
      }
      assertTrue(found, "seed " + i);
    }
  }

  // ---- nothing to assign ----

  @Test
  public void with_no_courses_or_no_applicants_nothing_is_assigned() {
    List<Application> applications = assigned(5, 0, FakeCoverage.ALL, seed(12));
    for (Application a : applications) {
      assertNull(a.getFirstChoiceCourse());
      assertNull(a.getSecondChoiceCourse());
      assertTrue(a.getCourseInterests().isEmpty());
    }
    FakeCourseChoices.assign(new ArrayList<>(), courses(3), FakeCoverage.SPARSE, new Random(1));
  }

  @Test
  public void the_same_seed_makes_the_same_choices() {
    assertEquals(
        assigned(50, 6, FakeCoverage.SPARSE, seed(13)).toString(),
        assigned(50, 6, FakeCoverage.SPARSE, seed(13)).toString());
    assertNotEquals(
        assigned(50, 6, FakeCoverage.ALL, seed(13)).toString(),
        assigned(50, 6, FakeCoverage.ALL, seed(14)).toString());
  }
}
