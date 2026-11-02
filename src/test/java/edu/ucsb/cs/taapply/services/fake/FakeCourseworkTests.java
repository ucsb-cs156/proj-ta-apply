package edu.ucsb.cs.taapply.services.fake;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import java.io.UncheckedIOException;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;
import org.junit.jupiter.api.Test;

public class FakeCourseworkTests {

  private final FakeCoursework coursework = new FakeCoursework();

  @Test
  public void a_missing_data_file_is_reported_by_name() {
    UncheckedIOException e =
        assertThrows(
            UncheckedIOException.class,
            () -> FakeCoursework.read(new ObjectMapper(), "data/no_such_file.json"));

    assertEquals("Cannot read data/no_such_file.json", e.getMessage());
  }

  @Test
  public void the_path_from_cmpsc_8_starts_there_and_lists_each_course_once() {
    List<String> path = coursework.reachableFrom("8");

    assertEquals("8", path.get(0));
    assertTrue(path.indexOf("9") > 0, "CMPSC 9 lists CMPSC 8 as a prerequisite");
    assertEquals(path.size(), new HashSet<>(path).size());
    assertFalse(path.contains("5A"), "CMPSC 5A is not downstream of CMPSC 8");
  }

  @Test
  public void a_course_with_nothing_after_it_is_a_path_of_one() {
    assertEquals(List.of("1"), coursework.reachableFrom("1"));
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
  public void ucsb_courses_run_in_order_and_end_the_quarter_before_the_reference() {
    List<PriorCoursework> rows = coursework.ucsb(new Random(1), 3, 20261);

    assertEquals(3, rows.size());
    // Three quarters back from W26, skipping summer: W25, S25, F25.
    assertEquals(
        List.of("W25", "S25", "F25"), rows.stream().map(PriorCoursework::getTerm).toList());
    for (PriorCoursework row : rows) {
      assertTrue(row.isUcsbCourse());
      assertNull(row.getOtherSchool());
      assertTrue(row.getCourseNumber().startsWith("CMPSC "));
      assertTrue(FakeCoursework.GRADES.contains(row.getGrade()));
    }
  }

  @Test
  public void the_terms_of_ucsb_courses_step_forward_one_quarter_each() {
    List<PriorCoursework> rows = coursework.ucsb(new Random(2), 4, 20261);

    assertEquals(
        List.of("F24", "W25", "S25", "F25"), rows.stream().map(PriorCoursework::getTerm).toList());
  }

  @Test
  public void asking_for_more_courses_than_are_reachable_returns_all_of_them() {
    int fromEight = coursework.reachableFrom("8").size();
    int fromSixteen = coursework.reachableFrom("16").size();

    Set<Integer> sizes = new HashSet<>();
    Set<String> starts = new HashSet<>();
    for (int seed = 0; seed < 200; seed++) {
      List<PriorCoursework> rows = coursework.ucsb(new Random(seed * 1_000_003L), 1000, 20261);
      sizes.add(rows.size());
      starts.add(rows.get(0).getCourseNumber());
    }

    assertEquals(Set.of(fromEight, fromSixteen), sizes);
    assertEquals(Set.of("CMPSC 8", "CMPSC 16"), starts);
  }

  @Test
  public void graduate_courses_are_distinct_ucsb_courses() {
    List<PriorCoursework> rows = coursework.ucsbGraduate(new Random(3), 5, 20261);

    assertEquals(5, rows.size());
    assertEquals(5, rows.stream().map(PriorCoursework::getCourseNumber).distinct().count());
    for (PriorCoursework row : rows) {
      assertTrue(row.isUcsbCourse());
      assertTrue(
          coursework
              .graduateCourses()
              .contains(row.getCourseNumber().substring("CMPSC ".length())));
    }
    assertEquals("F25", rows.get(4).getTerm());
  }

  @Test
  public void other_school_courses_name_their_school_and_never_repeat() {
    List<PriorCoursework> rows = coursework.other(new Random(4), 10, false, 20261);

    assertEquals(10, rows.size());
    assertEquals(
        10, rows.stream().map(r -> r.getOtherSchool() + r.getCourseNumber()).distinct().count());
    for (PriorCoursework row : rows) {
      assertFalse(row.isUcsbCourse());
      assertNotNull(row.getOtherSchool());
      assertNotNull(row.getCourseTitle());
      assertFalse(row.getCourseNumber().isBlank());
      assertTrue(FakeCoursework.GRADES.contains(row.getGrade()));
    }
    assertEquals("F25", rows.get(9).getTerm());
  }

  @Test
  public void international_students_get_international_schools_and_domestic_ones_do_not() {
    Set<String> domestic = new HashSet<>();
    Set<String> international = new HashSet<>();
    for (int seed = 0; seed < 5; seed++) {
      coursework
          .other(new Random(seed), 30, false, 20261)
          .forEach(r -> domestic.add(r.getOtherSchool()));
      coursework
          .other(new Random(seed), 30, true, 20261)
          .forEach(r -> international.add(r.getOtherSchool()));
    }

    assertEquals(5, domestic.size());
    assertEquals(5, international.size());
    domestic.retainAll(international);
    assertTrue(domestic.isEmpty());
  }

  @Test
  public void asking_for_more_other_courses_than_exist_returns_what_there_is() {
    assertTrue(coursework.other(new Random(5), 100000, false, 20261).size() < 100000);
  }
}
