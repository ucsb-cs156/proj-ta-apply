package edu.ucsb.cs.taapply.entity;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

/** Issue #442: matching a prior course's number against a recruitment course's padded id. */
public class PriorCourseworkTests {

  @Test
  void course_numbers_match_ignoring_case_and_whitespace() {
    assertTrue(PriorCoursework.sameCourseNumber("cmpsc 156", "CMPSC   156"));
    assertTrue(PriorCoursework.sameCourseNumber(" CMPSC156 ", "CMPSC   156"));
    assertTrue(PriorCoursework.sameCourseNumber("CMPSC\t156", "CMPSC 156"));
  }

  @Test
  void different_course_numbers_do_not_match() {
    assertFalse(PriorCoursework.sameCourseNumber("CMPSC 156", "CMPSC 156L"));
    assertFalse(PriorCoursework.sameCourseNumber("CMPSC 15", "CMPSC 156"));
  }

  @Test
  void a_missing_or_blank_number_matches_nothing() {
    assertFalse(PriorCoursework.sameCourseNumber(null, "CMPSC 156"));
    assertFalse(PriorCoursework.sameCourseNumber("CMPSC 156", null));
    assertFalse(PriorCoursework.sameCourseNumber(null, null));
    assertFalse(PriorCoursework.sameCourseNumber("", ""));
    assertFalse(PriorCoursework.sameCourseNumber("   ", " "));
  }
}
