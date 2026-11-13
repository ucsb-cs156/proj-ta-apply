package edu.ucsb.cs.taapply.utilities;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.entity.PriorCoursework;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Issue #448: the one rule for whether two course numbers name the same course. */
public class CourseMatchingTests {

  private static PriorCoursework row(boolean ucsb, String number) {
    return PriorCoursework.builder()
        .ucsbCourse(ucsb)
        .otherSchool(ucsb ? null : "SBCC")
        .courseNumber(number)
        .term("F25")
        .build();
  }

  @Test
  void squash_uppercases_and_removes_every_whitespace_character() {
    assertEquals("CMPSC156", CourseMatching.squash("  cmpsc \t 156\n"));
    assertEquals("", CourseMatching.squash(null));
    assertEquals("", CourseMatching.squash("   "));
  }

  @Test
  void course_numbers_match_ignoring_case_and_spacing() {
    assertTrue(CourseMatching.sameCourse("cmpsc 156", "CMPSC   156"));
    assertTrue(CourseMatching.sameCourse(" CMPSC156 ", "CMPSC   156"));
    assertTrue(CourseMatching.sameCourse("CMPSC\t5a", "CMPSC    5A"));
  }

  @Test
  void different_course_numbers_do_not_match() {
    assertFalse(CourseMatching.sameCourse("CMPSC 156", "CMPSC 156L"));
    assertFalse(CourseMatching.sameCourse("CMPSC 15", "CMPSC 156"));
  }

  @Test
  void a_missing_or_blank_number_matches_nothing() {
    assertFalse(CourseMatching.sameCourse(null, "CMPSC 156"));
    assertFalse(CourseMatching.sameCourse("CMPSC 156", null));
    assertFalse(CourseMatching.sameCourse(null, null));
    assertFalse(CourseMatching.sameCourse("", ""));
    assertFalse(CourseMatching.sameCourse("   ", " "));
  }

  @Test
  void display_makes_each_run_of_spaces_one_and_trims_the_ends() {
    assertEquals("CMPSC 156", CourseMatching.display("CMPSC   156"));
    assertEquals("CMPSC 5A", CourseMatching.display(" CMPSC    5A "));
  }

  @Test
  void only_a_ucsb_row_with_the_same_number_is_the_ucsb_course() {
    assertTrue(CourseMatching.isUcsbCourse(row(true, "cmpsc 156"), "CMPSC   156"));
    assertFalse(CourseMatching.isUcsbCourse(row(false, "CMPSC 156"), "CMPSC   156"));
    assertFalse(CourseMatching.isUcsbCourse(row(true, "CMPSC 130A"), "CMPSC   156"));
    assertFalse(CourseMatching.isUcsbCourse(row(true, null), "CMPSC   156"));
  }

  @Test
  void first_ucsb_course_skips_other_schools_and_takes_the_first_match() {
    PriorCoursework elsewhere = row(false, "CMPSC 156");
    PriorCoursework first = row(true, "cmpsc156");
    PriorCoursework second = row(true, "CMPSC 156");
    List<PriorCoursework> rows = List.of(elsewhere, row(true, "CMPSC 16"), first, second);
    assertSame(first, CourseMatching.firstUcsbCourse(rows, "CMPSC   156"));
    assertNull(CourseMatching.firstUcsbCourse(rows, "CMPSC   130A"));
    assertNull(CourseMatching.firstUcsbCourse(List.of(elsewhere), "CMPSC   156"));
  }
}
