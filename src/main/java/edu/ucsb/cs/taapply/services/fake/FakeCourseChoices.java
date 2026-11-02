package edu.ucsb.cs.taapply.services.fake;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.enums.CourseInterest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * First choice, second choice and course interests for a batch of fake applications (issue #219),
 * following the rules of the Developer Mode design.
 *
 * <p><b>ALL</b> ("cover all courses with a reasonable number of applicants"): the courses are dealt
 * out so that each has at least one applicant, first as first choices (applicant 0 gets course 0,
 * applicant 1 course 1, and so on), and only if the courses outnumber the applicants, as second
 * choices and then as Enthusiastic interests. Everything else is random. A first choice is uniform
 * over the courses. A second choice is uniform over the other courses and "no second choice", so it
 * is absent one time in the number of courses, and never equals the first. Every other course is
 * Enthusiastic for 20 percent of applicants, Would Consider for 40 percent, and not mentioned for
 * 40 percent.
 *
 * <p><b>SPARSE</b> ("leave some courses with few or no applicants"): one course, chosen at random,
 * is mentioned by nobody. A second course is mentioned by exactly three applicants, one
 * Enthusiastic and two Would Consider, and by none of them as a first or second choice. The rest
 * are filled exactly as for ALL.
 */
public final class FakeCourseChoices {
  private FakeCourseChoices() {}

  /** Percent of the other courses an applicant is Enthusiastic about. */
  static final int ENTHUSIASTIC_PERCENT = 20;

  /** Percent (after the Enthusiastic ones) they would consider. */
  static final int WOULD_CONSIDER_PERCENT = 40;

  /** How many applicants mention SPARSE's one thinly covered course. */
  static final int THIN_COURSE_APPLICANTS = 3;

  public static void assign(
      List<Application> applications,
      List<String> courseIds,
      FakeCoverage coverage,
      Random random) {
    if (courseIds.isEmpty() || applications.isEmpty()) {
      return;
    }
    List<String> allowed = new ArrayList<>(courseIds);
    String thin = null;
    if (coverage == FakeCoverage.SPARSE) {
      allowed.remove(random.nextInt(allowed.size())); // mentioned by no one
      if (!allowed.isEmpty()) {
        thin = allowed.remove(random.nextInt(allowed.size()));
      }
    }

    int n = applications.size();
    // Deal the allowed courses out: slot k goes to applicant k % n, as the first choice, then the
    // second, then an Enthusiastic interest, so that every course has someone.
    String[] firsts = new String[n];
    String[] seconds = new String[n];
    String[] enthusiastic = new String[n];
    for (int k = 0; k < allowed.size() && k < 3 * n; k++) {
      String[] column = k / n == 0 ? firsts : k / n == 1 ? seconds : enthusiastic;
      column[k % n] = allowed.get(k);
    }

    for (int i = 0; i < n; i++) {
      Application application = applications.get(i);
      String first = firsts[i] != null ? firsts[i] : uniform(allowed, seconds[i], random);
      String second = seconds[i] != null ? seconds[i] : secondChoice(allowed, first, random);
      application.setFirstChoiceCourse(first);
      application.setSecondChoiceCourse(second);
      application.setCourseInterests(interests(allowed, first, second, enthusiastic[i], random));
    }

    if (thin != null) {
      List<Integer> indices = new ArrayList<>();
      for (int i = 0; i < n; i++) {
        indices.add(i);
      }
      java.util.Collections.shuffle(indices, random);
      for (int k = 0; k < Math.min(THIN_COURSE_APPLICANTS, n); k++) {
        applications
            .get(indices.get(k))
            .getCourseInterests()
            .put(thin, k == 0 ? CourseInterest.ENTHUSIASTIC : CourseInterest.WOULD_CONSIDER);
      }
    }
  }

  /** A course chosen uniformly, other than {@code except}; null when there is none to choose. */
  private static String uniform(List<String> courses, String except, Random random) {
    List<String> candidates = new ArrayList<>(courses);
    candidates.remove(except);
    return candidates.isEmpty() ? null : candidates.get(random.nextInt(candidates.size()));
  }

  /**
   * Uniform over the courses other than the first choice and "no second choice" together, so the
   * second choice is absent as often as any one course is chosen.
   */
  private static String secondChoice(List<String> courses, String first, Random random) {
    if (first == null) {
      return null;
    }
    List<String> others = new ArrayList<>(courses);
    others.remove(first);
    int pick = random.nextInt(others.size() + 1);
    return pick == others.size() ? null : others.get(pick);
  }

  private static Map<String, CourseInterest> interests(
      List<String> courses,
      String first,
      String second,
      String guaranteedEnthusiastic,
      Random random) {
    Map<String, CourseInterest> interests = new HashMap<>();
    for (String course : courses) {
      if (course.equals(first) || course.equals(second)) {
        continue;
      }
      int roll = random.nextInt(100);
      if (course.equals(guaranteedEnthusiastic) || roll < ENTHUSIASTIC_PERCENT) {
        interests.put(course, CourseInterest.ENTHUSIASTIC);
      } else if (roll < ENTHUSIASTIC_PERCENT + WOULD_CONSIDER_PERCENT) {
        interests.put(course, CourseInterest.WOULD_CONSIDER);
      }
    }
    return interests;
  }
}
