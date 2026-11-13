package edu.ucsb.cs.taapply.services.fake;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashSet;
import java.util.Random;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

/** Issue #448: why a fake ULA applicant is ready for a course they have not taken at UCSB. */
public class FakeExplanationServiceTests {

  private final FakeExplanationService service = new FakeExplanationService();

  /** A Random whose nextInt always gives {@code value}. */
  private static Random always(int value) {
    return new Random() {
      @Override
      public int nextInt(int bound) {
        return value;
      }
    };
  }

  @ParameterizedTest
  @CsvSource(
      delimiter = '|',
      value = {
        "CMPSC    5A|Did not take CMPSC 5A, but have taken CMPSC 8 and PSTAT 120A so I feel prepared.",
        "cmpsc 5b|Did not take CMPSC 5B, but have taken CMPSC 8 and 9 and PSTAT 120A, so I feel"
            + " prepared.",
        "CMPSC    8|Did not take CMPSC 8 at UCSB, but have extensive Python programming background.",
        "CMPSC9|Did not take CMPSC 9 at UCSB, but have taken CMPSC 24 and have Python programming"
            + " background.",
      })
  void the_named_courses_have_their_own_sentence(String courseId, String expected) {
    assertEquals(expected, service.explanation(courseId, new Random(1)));
  }

  @ParameterizedTest
  @ValueSource(strings = {"16", "24", "32", "41", "42", "64"})
  void the_sbcc_courses_name_themselves(String number) {
    assertEquals(
        "Did not take CMPSC " + number + " at UCSB, but took an equivalent course at SBCC.",
        service.explanation("CMPSC   " + number, new Random(1)));
  }

  @ParameterizedTest
  @ValueSource(strings = {"CMPSC   40", "CMPSC   99", "CMPSC   1A", "ECE   15A", "CMPSC"})
  void any_other_lower_division_course_was_taken_at_a_community_college(String courseId) {
    assertEquals(
        "Took an equivalent at Community College.", service.explanation(courseId, new Random(1)));
  }

  @Test
  void an_upper_division_course_gets_either_sentence_with_its_number() {
    assertEquals(
        "Have not taken CMPSC 156 at UCSB, but took an equivalent course on Study Abroad (EAP).",
        service.explanation("CMPSC  156", always(0)));
    assertEquals(
        "Have not taken CMPSC 130A at UCSB, but have done research with the professor of the"
            + " course that covers the subject matter.",
        service.explanation("CMPSC  130A", always(1)));
    Set<String> seen = new HashSet<>();
    Random random = new Random(7);
    for (int i = 0; i < 100; i++) {
      seen.add(service.explanation("CMPSC  100", random));
    }
    assertEquals(2, seen.size());
  }

  @Test
  void lower_division_means_a_number_below_100() {
    assertTrue(FakeExplanationService.lowerDivision("CMPSC   99"));
    assertTrue(FakeExplanationService.lowerDivision("CMPSC    5A"));
    assertTrue(FakeExplanationService.lowerDivision("CMPSC"));
    assertFalse(FakeExplanationService.lowerDivision("CMPSC  100"));
    assertFalse(FakeExplanationService.lowerDivision("CMPSC  190DD"));
    assertFalse(FakeExplanationService.lowerDivision("CMPSC  130A"));
  }
}
