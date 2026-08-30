package edu.ucsb.cs.taapply.utilities;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

public class CanonicalFormConverterTests {
  @Test
  public void testConvertToValidEmail() {
    String email = "foo@umail.ucsb.edu";
    String expected = "foo@ucsb.edu";
    String actual = CanonicalFormConverter.convertToValidEmail(email);
    assertEquals(expected, actual);
  }

  @Test
  public void test_coverage_for_constructor() {
    CanonicalFormConverter converter = new CanonicalFormConverter();
    assertInstanceOf(CanonicalFormConverter.class, converter);
  }

  @Test
  public void testAreEquivalentEmails() {
    assertTrue(CanonicalFormConverter.areEquivalentEmails("foo@umail.ucsb.edu", "foo@ucsb.edu"));
    assertFalse(CanonicalFormConverter.areEquivalentEmails("bar@ucsb.edu", "foo@ucsb.edu"));
  }
}
