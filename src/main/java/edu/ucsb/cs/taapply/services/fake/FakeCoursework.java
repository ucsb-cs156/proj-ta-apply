package edu.ucsb.cs.taapply.services.fake;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/**
 * Plausible prior coursework for fake applicants (issue #219), built from two data files: the CMPSC
 * prerequisite graph, which gives a believable order to take UCSB courses in, and a list of
 * computer science courses at other universities.
 */
@Component
public class FakeCoursework {

  /** A course at another school, from {@code other_undergrad_courses.json}. */
  public record OtherCourse(String school, String number, String title) {}

  static final List<String> GRADES = List.of("B-", "B", "B+", "A-", "A", "A+");

  private final JsonNode prereqCourses;
  private final List<OtherCourse> domestic;
  private final List<OtherCourse> international;

  public FakeCoursework() {
    ObjectMapper mapper = new ObjectMapper();
    this.prereqCourses = read(mapper, "data/cmpsc_prereqs.json").get("courses");
    JsonNode other = read(mapper, "data/other_undergrad_courses.json");
    this.domestic = otherCourses(other.get("domestic"));
    this.international = otherCourses(other.get("international"));
  }

  static JsonNode read(ObjectMapper mapper, String path) {
    try (InputStream in = new ClassPathResource(path).getInputStream()) {
      return mapper.readTree(in);
    } catch (IOException e) {
      throw new UncheckedIOException("Cannot read " + path, e);
    }
  }

  private static List<OtherCourse> otherCourses(JsonNode schools) {
    List<OtherCourse> all = new ArrayList<>();
    for (JsonNode school : schools) {
      for (JsonNode course : school.get("courses")) {
        all.add(
            new OtherCourse(
                school.get("school").asText(),
                course.get("number").asText(),
                course.get("title").asText()));
      }
    }
    return all;
  }

  /**
   * The courses that can be taken once {@code start} has been, in breadth-first order: the course
   * itself, then every course that lists it as a prerequisite, then every course that lists one of
   * those, and so on. Taking them in this order never takes a course before one it needs.
   */
  public List<String> reachableFrom(String start) {
    Set<String> seen = new LinkedHashSet<>();
    List<String> queue = new ArrayList<>(List.of(start));
    seen.add(start);
    for (int i = 0; i < queue.size(); i++) {
      String current = queue.get(i);
      for (Map.Entry<String, JsonNode> entry : prereqCourses.properties()) {
        if (!seen.contains(entry.getKey()) && lists(entry.getValue(), current)) {
          seen.add(entry.getKey());
          queue.add(entry.getKey());
        }
      }
    }
    return queue;
  }

  private static boolean lists(JsonNode course, String prerequisite) {
    for (JsonNode prereq : course.get("prereqs")) {
      if (prereq.asText().equals(prerequisite)) {
        return true;
      }
    }
    return false;
  }

  /** The graduate (200-level and up) CMPSC courses, in catalog order. */
  public List<String> graduateCourses() {
    List<String> graduate = new ArrayList<>();
    for (Map.Entry<String, JsonNode> entry : prereqCourses.properties()) {
      if (Integer.parseInt(entry.getKey().replaceAll("\\D", "")) > 199) {
        graduate.add(entry.getKey());
      }
    }
    return graduate;
  }

  /**
   * Up to {@code wanted} UCSB courses, walked from CMPSC 8 or 16 (chosen by the generator) in
   * prerequisite order, with terms stepping forward one quarter per course and ending the quarter
   * before {@code referenceQuarter}. Fewer come back when fewer are reachable.
   */
  public List<PriorCoursework> ucsb(Random random, int wanted, int referenceQuarter) {
    List<String> path = reachableFrom(random.nextBoolean() ? "8" : "16");
    return ucsbRows(random, path.subList(0, Math.min(wanted, path.size())), referenceQuarter);
  }

  /** Up to {@code wanted} graduate UCSB courses, chosen at random, each with a recent term. */
  public List<PriorCoursework> ucsbGraduate(Random random, int wanted, int referenceQuarter) {
    List<String> graduate = graduateCourses();
    Collections.shuffle(graduate, random);
    return ucsbRows(
        random, graduate.subList(0, Math.min(wanted, graduate.size())), referenceQuarter);
  }

  private List<PriorCoursework> ucsbRows(
      Random random, List<String> numbers, int referenceQuarter) {
    List<PriorCoursework> rows = new ArrayList<>();
    int quarter = walkBack(referenceQuarter, numbers.size());
    for (String number : numbers) {
      rows.add(
          PriorCoursework.builder()
              .ucsbCourse(true)
              .courseNumber("CMPSC " + number)
              .term(term(quarter))
              .grade(pickGrade(random))
              .build());
      quarter = next(quarter);
    }
    return rows;
  }

  /**
   * {@code wanted} distinct courses from other universities, each with the school it was taken at.
   * International schools for an international student, domestic otherwise.
   */
  public List<PriorCoursework> other(
      Random random, int wanted, boolean international, int referenceQuarter) {
    List<OtherCourse> pool = new ArrayList<>(international ? this.international : this.domestic);
    Collections.shuffle(pool, random);
    List<OtherCourse> chosen = pool.subList(0, Math.min(wanted, pool.size()));
    List<PriorCoursework> rows = new ArrayList<>();
    int quarter = walkBack(referenceQuarter, chosen.size());
    for (OtherCourse course : chosen) {
      rows.add(
          PriorCoursework.builder()
              .ucsbCourse(false)
              .otherSchool(course.school())
              .courseNumber(course.number())
              .courseTitle(course.title())
              .term(term(quarter))
              .grade(pickGrade(random))
              .build());
      quarter = next(quarter);
    }
    return rows;
  }

  private static String pickGrade(Random random) {
    return GRADES.get(random.nextInt(GRADES.size()));
  }

  private static int walkBack(int yyyyq, int steps) {
    int quarter = yyyyq;
    for (int i = 0; i < steps; i++) {
      quarter = previous(quarter);
    }
    return quarter;
  }

  /** The quarter before, skipping summer (3): 20261 to 20254, 20244 to 20242. */
  static int previous(int yyyyq) {
    int q = yyyyq % 10;
    int result = q == 1 ? (yyyyq / 10 - 1) * 10 + 4 : yyyyq - 1;
    return result % 10 == 3 ? result - 1 : result;
  }

  /** The quarter after, skipping summer (3): 20242 to 20244. */
  static int next(int yyyyq) {
    int q = yyyyq % 10;
    int result = q == 4 ? (yyyyq / 10 + 1) * 10 + 1 : yyyyq + 1;
    return result % 10 == 3 ? result + 1 : result;
  }

  /** A quarter as an applicant writes it: F25 for 20254. */
  static String term(int yyyyq) {
    return "WSMF".charAt(yyyyq % 10 - 1) + String.format("%02d", (yyyyq / 10) % 100);
  }
}
