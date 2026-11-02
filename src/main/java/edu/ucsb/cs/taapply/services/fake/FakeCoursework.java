package edu.ucsb.cs.taapply.services.fake;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.LocalDate;
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
 * prerequisite graph, which gives a believable order to take UCSB courses in, and the computer
 * science courses of a few other universities.
 */
@Component
public class FakeCoursework {

  /** A course at another school, from {@code other_undergrad_courses.json}. */
  public record OtherCourse(String school, String number, String title) {}

  static final List<String> GRADES = List.of("B-", "B", "B+", "A-", "A", "A+");

  private final JsonNode prereqCourses;
  private final List<List<OtherCourse>> domesticSchools;
  private final List<List<OtherCourse>> internationalSchools;

  public FakeCoursework() {
    ObjectMapper mapper = new ObjectMapper();
    this.prereqCourses = read(mapper, "data/cmpsc_prereqs.json").get("courses");
    JsonNode other = read(mapper, "data/other_undergrad_courses.json");
    this.domesticSchools = schools(other.get("domestic"));
    this.internationalSchools = schools(other.get("international"));
  }

  static JsonNode read(ObjectMapper mapper, String path) {
    try (InputStream in = new ClassPathResource(path).getInputStream()) {
      return mapper.readTree(in);
    } catch (IOException e) {
      throw new UncheckedIOException("Cannot read " + path, e);
    }
  }

  /** One list of courses per school. */
  private static List<List<OtherCourse>> schools(JsonNode schools) {
    List<List<OtherCourse>> all = new ArrayList<>();
    for (JsonNode school : schools) {
      List<OtherCourse> courses = new ArrayList<>();
      for (JsonNode course : school.get("courses")) {
        courses.add(
            new OtherCourse(
                school.get("school").asText(),
                course.get("number").asText(),
                course.get("title").asText()));
      }
      all.add(courses);
    }
    return all;
  }

  /**
   * The quarter of the latest course on a fake transcript: the quarter containing {@code today}, by
   * the same month rule as the front end (January to March is 1, April to June 2, July and August
   * 3, September to December 4). Summer has no CMPSC courses, so a summer date counts as spring,
   * which makes April to August quarter 2.
   */
  public static int latestQuarter(LocalDate today) {
    int month = today.getMonthValue();
    return today.getYear() * 10 + (month <= 3 ? 1 : month <= 8 ? 2 : 4);
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
   * Up to {@code wanted} UCSB courses, taken from CMPSC 8 or 16 (chosen by the generator) onward.
   * The walk is a breadth-first traversal of the prerequisite graph in which the next course is
   * chosen at random from the frontier: the courses that list a course already taken as a
   * prerequisite. A course is therefore never taken before one it follows, and fewer than {@code
   * wanted} come back when the graph runs out. Terms step forward one quarter per course and end at
   * {@code latestQuarter}.
   */
  public List<PriorCoursework> ucsb(Random random, int wanted, int latestQuarter) {
    String start = random.nextBoolean() ? "8" : "16";
    Set<String> seen = new LinkedHashSet<>(List.of(start));
    List<String> frontier = new ArrayList<>(List.of(start));
    List<String> taken = new ArrayList<>();
    while (taken.size() < wanted && !frontier.isEmpty()) {
      String next = frontier.remove(random.nextInt(frontier.size()));
      taken.add(next);
      for (Map.Entry<String, JsonNode> entry : prereqCourses.properties()) {
        if (!seen.contains(entry.getKey()) && lists(entry.getValue(), next)) {
          seen.add(entry.getKey());
          frontier.add(entry.getKey());
        }
      }
    }
    return ucsbRows(random, taken, latestQuarter);
  }

  private static boolean lists(JsonNode course, String prerequisite) {
    for (JsonNode prereq : course.get("prereqs")) {
      if (prereq.asText().equals(prerequisite)) {
        return true;
      }
    }
    return false;
  }

  /** Up to {@code wanted} graduate UCSB courses, chosen at random, each with a recent term. */
  public List<PriorCoursework> ucsbGraduate(Random random, int wanted, int latestQuarter) {
    List<String> graduate = graduateCourses();
    Collections.shuffle(graduate, random);
    return ucsbRows(random, graduate.subList(0, Math.min(wanted, graduate.size())), latestQuarter);
  }

  private List<PriorCoursework> ucsbRows(Random random, List<String> numbers, int latestQuarter) {
    List<PriorCoursework> rows = new ArrayList<>();
    int quarter = walkBack(latestQuarter, numbers.size() - 1);
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
   * Up to {@code wanted} distinct courses from one school chosen at random: an international school
   * for an international student, a domestic one otherwise.
   */
  public List<PriorCoursework> other(
      Random random, int wanted, boolean international, int latestQuarter) {
    List<List<OtherCourse>> schools = international ? internationalSchools : domesticSchools;
    List<OtherCourse> pool = new ArrayList<>(schools.get(random.nextInt(schools.size())));
    Collections.shuffle(pool, random);
    List<OtherCourse> chosen = pool.subList(0, Math.min(wanted, pool.size()));
    List<PriorCoursework> rows = new ArrayList<>();
    int quarter = walkBack(latestQuarter, chosen.size() - 1);
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
