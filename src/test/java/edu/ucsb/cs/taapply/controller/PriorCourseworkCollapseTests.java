package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import edu.ucsb.cs.taapply.controller.ApplicationsController.ApplicationFields;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.DraftApplication;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import java.util.Arrays;
import java.util.List;
import java.util.function.Function;
import org.junit.jupiter.api.Test;

/**
 * Issue #334: identical prior courses (same course number, school and term, ignoring case and
 * spacing) are collapsed to one row on every save path, while a retake in another term, or the same
 * number at another school, stays.
 */
public class PriorCourseworkCollapseTests {

  private static PriorCoursework row(
      boolean ucsb, String school, String number, String term, String grade) {
    return PriorCoursework.builder()
        .ucsbCourse(ucsb)
        .otherSchool(school)
        .courseNumber(number)
        .term(term)
        .grade(grade)
        .build();
  }

  private static String json(boolean ucsb, String school, String number, String term, String grade)
      throws JsonProcessingException {
    return new ObjectMapper()
        .writeValueAsString(
            new ApplicationsController.PriorCourseworkFields(
                ucsb, school, number, null, term, grade));
  }

  private static ApplicationFields fields(String... rows) throws JsonProcessingException {
    return new ObjectMapper()
        .readValue(
            "{\"priorCoursework\":[" + String.join(",", rows) + "]}", ApplicationFields.class);
  }

  private static List<String> grades(List<PriorCoursework> rows) {
    return rows.stream().map(PriorCoursework::getGrade).toList();
  }

  // ---- the key ----

  @Test
  void the_key_ignores_case_and_spacing_of_number_school_and_term() {
    assertEquals(
        row(false, "De Anza", "CIS 22A", "F25", null).key(),
        row(false, " de  anza ", "cis22a", "f 25", null).key());
    assertEquals(
        row(true, null, "CMPSC 156", "F25", "A").key(),
        row(true, null, "cmpsc156", "F25", "B").key());
  }

  @Test
  void the_key_differs_by_number_term_school_and_ucsb() {
    String base = row(false, "De Anza", "CIS 22A", "F25", null).key();
    assertNotEquals(base, row(false, "De Anza", "CIS 22B", "F25", null).key());
    assertNotEquals(base, row(false, "De Anza", "CIS 22A", "W26", null).key());
    assertNotEquals(base, row(false, "De Anza", "CIS 22A", null, null).key());
    assertNotEquals(base, row(false, "Foothill", "CIS 22A", "F25", null).key());
    assertNotEquals(base, row(false, null, "CIS 22A", "F25", null).key());
    assertNotEquals(base, row(true, null, "CIS 22A", "F25", null).key());
    // A school named UCSB that is not marked as UCSB is still not the UCSB course.
    assertNotEquals(
        row(true, null, "CIS 22A", "F25", null).key(),
        row(false, "UCSB", "CIS 22A", "F25", null).key());
  }

  @Test
  void a_ucsb_course_ignores_whatever_other_school_was_sent() {
    assertEquals(
        row(true, "Stale", "CMPSC 8", "F25", null).key(),
        row(true, null, "CMPSC 8", "F25", null).key());
  }

  @Test
  void a_row_without_a_course_number_has_no_key() {
    assertNull(row(true, null, null, "F25", null).key());
    assertNull(row(true, null, "  ", "F25", null).key());
  }

  // ---- collapse ----

  @Test
  void collapse_keeps_the_later_row_in_the_earlier_place() {
    List<PriorCoursework> collapsed =
        PriorCoursework.collapse(
            List.of(
                row(true, null, "CMPSC 156", "F25", "A"),
                row(true, null, "CMPSC 8", "F25", "A"),
                row(true, null, "cmpsc156", "F25", "B")));
    assertEquals(List.of("B", "A"), grades(collapsed));
    assertEquals("cmpsc156", collapsed.get(0).getCourseNumber());
  }

  @Test
  void collapse_keeps_rows_that_differ_in_term_or_school() {
    List<PriorCoursework> rows =
        List.of(
            row(true, null, "CMPSC 156", "F25", "A"),
            row(true, null, "CMPSC 156", "W26", "B"),
            row(false, "De Anza", "CMPSC 156", "F25", "C"));
    assertEquals(List.of("A", "B", "C"), grades(PriorCoursework.collapse(rows)));
  }

  @Test
  void collapse_keeps_every_row_without_a_course_number() {
    List<PriorCoursework> rows =
        List.of(row(true, null, null, "F25", "A"), row(true, null, " ", "F25", "A"));
    assertEquals(2, PriorCoursework.collapse(rows).size());
  }

  @Test
  void collapse_of_nothing_is_nothing() {
    assertEquals(List.of(), PriorCoursework.collapse(List.of()));
  }

  @Test
  void collapse_by_a_key_function_collapses_equal_keys() {
    Function<String, String> firstLetter = s -> s.substring(0, 1);
    assertEquals(
        List.of("a2", "b1"), PriorCoursework.collapse(List.of("a1", "b1", "a2"), firstLetter));
  }

  // ---- submit, edit and admin edit all go through apply ----

  @Test
  void apply_saves_identical_courses_once() throws Exception {
    Application application = Application.builder().build();
    ApplicationsController.apply(
        fields(
            json(true, null, "CMPSC 156", "F25", "A"),
            json(true, null, "cmpsc  156", "F25", "B"),
            json(true, null, "CMPSC 156", "W26", "C"),
            json(false, "De Anza", "CMPSC 156", "F25", "D")),
        application,
        RecruitmentType.TA);
    assertEquals(List.of("B", "C", "D"), grades(application.getPriorCoursework()));
  }

  @Test
  void apply_replaces_an_application_that_already_held_duplicates() throws Exception {
    Application application = Application.builder().build();
    application.getPriorCoursework().add(row(true, null, "CMPSC 8", "F25", "A"));
    application.getPriorCoursework().add(row(true, null, "CMPSC 8", "F25", "A"));
    ApplicationsController.apply(
        fields(json(true, null, "CMPSC 8", "F25", "A"), json(true, null, "CMPSC 8", "F25", "A")),
        application,
        RecruitmentType.ULA);
    assertEquals(1, application.getPriorCoursework().size());
  }

  // ---- the minimum counts distinct courses ----

  @Test
  void duplicates_do_not_count_toward_the_minimum() throws Exception {
    ApplicationFields twoDistinct =
        fields(
            json(true, null, "CMPSC 8", "F25", "A"),
            json(true, null, "CMPSC 8", "F25", "A"),
            json(true, null, "CMPSC 16", "F25", "A"));
    assertThrows(
        IllegalArgumentException.class,
        () -> ApplicationsController.requireCoursework(RecruitmentType.TA, twoDistinct));
    ApplicationFields three =
        fields(
            json(true, null, "CMPSC 8", "F25", "A"),
            json(true, null, "CMPSC 8", "W26", "A"),
            json(true, null, "CMPSC 16", "F25", "A"));
    assertDoesNotThrow(() -> ApplicationsController.requireCoursework(RecruitmentType.TA, three));
  }

  @Test
  void a_row_without_a_number_is_still_refused_among_duplicates() throws Exception {
    ApplicationFields blank =
        fields(json(true, null, "CMPSC 8", "F25", "A"), json(true, null, "", "F25", "A"));
    assertThrows(
        IllegalArgumentException.class,
        () -> ApplicationsController.requireCoursework(RecruitmentType.ULA, blank));
  }

  // ---- draft save ----

  @Test
  void a_draft_save_collapses_identical_courses_and_keeps_half_filled_rows() throws Exception {
    DraftApplication draft = DraftApplication.builder().build();
    DraftApplicationsController.apply(
        fields(
            json(true, null, "CMPSC 156", "F25", "A"),
            json(true, null, "cmpsc156", "F25", "B"),
            json(true, null, "", null, null),
            json(true, null, "", null, "A"),
            json(true, null, "CMPSC 156", "W26", "C")),
        draft);
    assertEquals(Arrays.asList("B", null, "A", "C"), grades(draft.getPriorCoursework()));
  }

  @Test
  void a_draft_with_no_courses_saves_none() throws Exception {
    DraftApplication draft = DraftApplication.builder().build();
    DraftApplicationsController.apply(fields(), draft);
    assertEquals(0, draft.getPriorCoursework().size());
    DraftApplicationsController.apply(
        new ObjectMapper().readValue("{}", ApplicationFields.class), draft);
    assertEquals(0, draft.getPriorCoursework().size());
  }
}
