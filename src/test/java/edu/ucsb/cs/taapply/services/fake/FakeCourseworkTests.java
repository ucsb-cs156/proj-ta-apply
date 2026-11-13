package edu.ucsb.cs.taapply.services.fake;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import java.io.UncheckedIOException;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

public class FakeCourseworkTests {

  private final FakeCoursework coursework = new FakeCoursework();

  /** Quarter W26: the latest term on the transcripts below. */
  private static final int LATEST = 20261;

  private static final JsonNode PREREQS =
      FakeCoursework.read(new ObjectMapper(), "data/cmpsc_prereqs.json").get("courses");

  private static long seed(int i) {
    // Consecutive seeds give correlated first draws, so spread them.
    return i * 1_000_003L + 17;
  }

  @Test
  public void a_missing_data_file_is_reported_by_name() {
    UncheckedIOException e =
        assertThrows(
            UncheckedIOException.class,
            () -> FakeCoursework.read(new ObjectMapper(), "data/no_such_file.json"));

    assertEquals("Cannot read data/no_such_file.json", e.getMessage());
  }

  // ---- the quarter of a date ----

  @Test
  public void the_latest_quarter_follows_the_months_of_the_year() {
    assertEquals(20261, FakeCoursework.latestQuarter(LocalDate.of(2026, 1, 1)));
    assertEquals(20261, FakeCoursework.latestQuarter(LocalDate.of(2026, 3, 31)));
    assertEquals(20262, FakeCoursework.latestQuarter(LocalDate.of(2026, 4, 1)));
    assertEquals(20262, FakeCoursework.latestQuarter(LocalDate.of(2026, 6, 30)));
    // Summer has no CMPSC courses, so July and August count as spring.
    assertEquals(20262, FakeCoursework.latestQuarter(LocalDate.of(2026, 7, 1)));
    assertEquals(20262, FakeCoursework.latestQuarter(LocalDate.of(2026, 8, 31)));
    assertEquals(20264, FakeCoursework.latestQuarter(LocalDate.of(2026, 9, 1)));
    assertEquals(20264, FakeCoursework.latestQuarter(LocalDate.of(2026, 12, 31)));
    assertEquals(19994, FakeCoursework.latestQuarter(LocalDate.of(1999, 10, 31)));
  }

  @Test
  public void quarters_step_over_summer_in_both_directions() {
    assertEquals(20254, FakeCoursework.previous(20261));
    assertEquals(20261, FakeCoursework.previous(20262));
    assertEquals(20242, FakeCoursework.previous(20244));
    assertEquals(20252, FakeCoursework.previous(20254));
    assertEquals(20244, FakeCoursework.next(20242));
    assertEquals(20261, FakeCoursework.next(20254));
    assertEquals(20262, FakeCoursework.next(20261));
    assertEquals(20252, FakeCoursework.next(20251));
  }

  @Test
  public void terms_are_written_the_way_an_applicant_would() {
    assertEquals("F25", FakeCoursework.term(20254));
    assertEquals("W26", FakeCoursework.term(20261));
    assertEquals("S26", FakeCoursework.term(20262));
    assertEquals("M24", FakeCoursework.term(20243));
    assertEquals("W05", FakeCoursework.term(20051));
  }

  @Test
  public void graduate_courses_are_the_two_hundreds_and_up() {
    List<String> graduate = coursework.graduateCourses();

    assertTrue(graduate.contains("209"));
    assertTrue(graduate.contains("211A"));
    assertFalse(graduate.contains("8"));
    assertFalse(graduate.contains("190"));
    assertFalse(graduate.contains("199"));
  }

  // ---- UCSB courses ----

  private static List<String> numbers(List<PriorCoursework> rows) {
    return rows.stream().map(r -> r.getCourseNumber().substring("CMPSC ".length())).toList();
  }

  @Test
  public void ucsb_courses_start_at_8_or_16_and_each_follows_one_already_taken() {
    Set<String> starts = new HashSet<>();
    for (int i = 0; i < 100; i++) {
      List<String> taken = numbers(coursework.ucsb(new Random(seed(i)), 20, LATEST));

      assertEquals(20, taken.size());
      assertEquals(20, new HashSet<>(taken).size());
      starts.add(taken.get(0));
      for (int k = 1; k < taken.size(); k++) {
        List<String> before = taken.subList(0, k);
        boolean follows = false;
        for (JsonNode prereq : PREREQS.get(taken.get(k)).get("prereqs")) {
          follows |= before.contains(prereq.asText());
        }
        assertTrue(follows, taken.get(k) + " taken before any course it follows: " + taken);
      }
    }
    assertEquals(Set.of("8", "16"), starts);
  }

  @Test
  public void the_course_after_each_is_chosen_at_random_from_the_frontier() {
    Set<List<String>> paths = new HashSet<>();
    for (int i = 0; i < 100; i++) {
      paths.add(numbers(coursework.ucsb(new Random(seed(i)), 6, LATEST)));
    }
    assertTrue(paths.size() > 30, "only " + paths.size() + " distinct walks");
  }

  @Test
  public void ucsb_terms_step_forward_one_quarter_each_and_end_at_the_latest() {
    List<PriorCoursework> rows = coursework.ucsb(new Random(seed(1)), 4, LATEST);

    // Summer is skipped: the quarter before W26 is F25, then S25, then W25.
    assertEquals(
        List.of("W25", "S25", "F25", "W26"), rows.stream().map(PriorCoursework::getTerm).toList());
  }

  @Test
  public void a_single_course_takes_the_latest_term() {
    assertEquals(
        List.of("W26"),
        coursework.ucsb(new Random(seed(2)), 1, LATEST).stream()
            .map(PriorCoursework::getTerm)
            .toList());
  }

  @Test
  public void ucsb_rows_are_ucsb_courses_with_a_grade_and_no_other_school() {
    for (PriorCoursework row : coursework.ucsb(new Random(seed(3)), 10, LATEST)) {
      assertTrue(row.isUcsbCourse());
      assertNull(row.getOtherSchool());
      assertTrue(row.getCourseNumber().startsWith("CMPSC "));
      assertTrue(FakeCoursework.GRADES.contains(row.getGrade()));
    }
  }

  @Test
  public void asking_for_more_courses_than_the_graph_has_returns_all_of_them() {
    Set<Integer> sizes = new HashSet<>();
    for (int i = 0; i < 100; i++) {
      List<PriorCoursework> rows = coursework.ucsb(new Random(seed(i)), 1000, LATEST);
      sizes.add(rows.size());
      assertTrue(rows.size() < 1000);
    }
    assertEquals(Set.of(62, 64), sizes);
  }

  @Test
  public void no_courses_wanted_gives_none() {
    assertTrue(coursework.ucsb(new Random(seed(4)), 0, LATEST).isEmpty());
  }

  // ---- graduate courses ----

  @Test
  public void graduate_courses_are_distinct_ucsb_courses_ending_at_the_latest_term() {
    List<PriorCoursework> rows = coursework.ucsbGraduate(new Random(seed(5)), 5, LATEST);

    assertEquals(5, rows.size());
    assertEquals(5, numbers(rows).stream().distinct().count());
    assertTrue(coursework.graduateCourses().containsAll(numbers(rows)));
    for (PriorCoursework row : rows) {
      assertTrue(row.isUcsbCourse());
      assertNull(row.getOtherSchool());
    }
    assertEquals(
        List.of("F24", "W25", "S25", "F25", "W26"),
        rows.stream().map(PriorCoursework::getTerm).toList());
  }

  // ---- other schools ----

  @Test
  public void other_courses_all_come_from_one_school() {
    List<PriorCoursework> rows = coursework.other(new Random(seed(6)), 10, false, LATEST);

    assertEquals(10, rows.size());
    assertEquals(1, rows.stream().map(PriorCoursework::getOtherSchool).distinct().count());
    assertEquals(10, rows.stream().map(PriorCoursework::getCourseNumber).distinct().count());
    for (PriorCoursework row : rows) {
      assertFalse(row.isUcsbCourse());
      assertNotNull(row.getOtherSchool());
      assertNotNull(row.getCourseTitle());
      assertFalse(row.getCourseNumber().isBlank());
      assertTrue(FakeCoursework.GRADES.contains(row.getGrade()));
    }
    assertEquals(
        List.of("W23", "S23", "F23", "W24", "S24", "F24", "W25", "S25", "F25", "W26"),
        rows.stream().map(PriorCoursework::getTerm).toList());
  }

  @Test
  public void each_school_is_chosen_sometimes_and_domestic_never_mixes_with_international() {
    Set<String> domestic = new HashSet<>();
    Set<String> international = new HashSet<>();
    for (int i = 0; i < 100; i++) {
      domestic.add(
          coursework.other(new Random(seed(i)), 10, false, LATEST).get(0).getOtherSchool());
      international.add(
          coursework.other(new Random(seed(i)), 10, true, LATEST).get(0).getOtherSchool());
    }

    assertEquals(5, domestic.size());
    assertEquals(5, international.size());
    Set<String> both = new HashSet<>(domestic);
    both.retainAll(international);
    assertTrue(both.isEmpty());
  }

  @Test
  public void a_school_with_fewer_courses_than_asked_gives_what_it_has() {
    List<PriorCoursework> rows = coursework.other(new Random(seed(7)), 100000, true, LATEST);
    assertTrue(rows.size() < 100000);
    assertEquals(
        1, rows.stream().map(PriorCoursework::getOtherSchool).collect(Collectors.toSet()).size());
  }

  // ---- issue #448: one UCSB course, and keeping a transcript in term order ----

  @Test
  public void ucsb_course_is_the_course_as_an_applicant_writes_it_in_one_of_six_recent_quarters() {
    Set<String> terms = new HashSet<>();
    for (int i = 0; i < 200; i++) {
      PriorCoursework row = coursework.ucsbCourse(new Random(seed(i)), "CMPSC  130A", LATEST);
      assertTrue(row.isUcsbCourse());
      assertNull(row.getOtherSchool());
      assertEquals("CMPSC 130A", row.getCourseNumber());
      assertTrue(FakeCoursework.GRADES.contains(row.getGrade()));
      terms.add(row.getTerm());
    }
    assertEquals(Set.of("W26", "F25", "S25", "W25", "F24", "S24"), terms);
  }

  @Test
  public void quarter_reads_back_what_term_writes() {
    assertEquals(20254, FakeCoursework.quarter("F25"));
    assertEquals(20261, FakeCoursework.quarter("W26"));
    assertEquals(20242, FakeCoursework.quarter("S24"));
    assertEquals(20093, FakeCoursework.quarter("M09"));
    for (int quarter : List.of(20251, 20252, 20253, 20254, 20301)) {
      assertEquals(quarter, FakeCoursework.quarter(FakeCoursework.term(quarter)));
    }
  }

  private static PriorCoursework termed(String number, String term) {
    return PriorCoursework.builder().ucsbCourse(true).courseNumber(number).term(term).build();
  }

  private static List<String> numbersOf(List<PriorCoursework> rows) {
    return rows.stream().map(PriorCoursework::getCourseNumber).toList();
  }

  @Test
  public void insert_in_term_order_goes_after_every_row_of_its_term_or_earlier() {
    List<PriorCoursework> rows =
        new java.util.ArrayList<>(
            List.of(
                termed("A", "F24"), termed("B", "W25"), termed("C", "W25"), termed("D", "S25")));
    FakeCoursework.insertInTermOrder(rows, termed("E", "W25"));
    assertEquals(List.of("A", "B", "C", "E", "D"), numbersOf(rows));
    FakeCoursework.insertInTermOrder(rows, termed("F", "S24"));
    assertEquals("F", rows.get(0).getCourseNumber());
    FakeCoursework.insertInTermOrder(rows, termed("G", "W26"));
    assertEquals("G", rows.get(rows.size() - 1).getCourseNumber());
    List<PriorCoursework> empty = new java.util.ArrayList<>();
    FakeCoursework.insertInTermOrder(empty, termed("H", "F25"));
    assertEquals(List.of("H"), numbersOf(empty));
  }
}
