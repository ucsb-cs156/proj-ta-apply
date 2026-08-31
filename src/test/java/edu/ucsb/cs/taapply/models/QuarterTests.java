package edu.ucsb.cs.taapply.models;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;

public class QuarterTests {

  @Test
  public void constructor_from_int_keeps_value() {
    assertEquals(20244, new Quarter(20244).getValue());
    assertEquals("20244", new Quarter(20244).getYYYYQ());
  }

  @Test
  public void constructor_from_string_parses_yyyyq() {
    assertEquals(20251, new Quarter("20251").getValue());
  }

  @Test
  public void toString_is_the_yyyyq_form() {
    assertEquals("20244", new Quarter("20244").toString());
  }

  @Test
  public void constructor_from_int_rejects_quarter_digit_below_one() {
    IllegalArgumentException e =
        assertThrows(IllegalArgumentException.class, () -> new Quarter(20240));
    assertTrue(e.getMessage().contains("1, 2, 3 or 4"));
  }

  @Test
  public void constructor_from_int_rejects_quarter_digit_above_four() {
    assertThrows(IllegalArgumentException.class, () -> new Quarter(20245));
  }

  @Test
  public void yyyyqToInt_rejects_null() {
    assertThrows(IllegalArgumentException.class, () -> Quarter.yyyyqToInt(null));
  }

  @Test
  public void yyyyqToInt_rejects_wrong_length() {
    assertThrows(IllegalArgumentException.class, () -> Quarter.yyyyqToInt("2024"));
    assertThrows(IllegalArgumentException.class, () -> Quarter.yyyyqToInt("202412"));
  }

  @Test
  public void yyyyqToInt_rejects_non_numeric() {
    IllegalArgumentException e =
        assertThrows(IllegalArgumentException.class, () -> Quarter.yyyyqToInt("20x41"));
    assertTrue(e.getMessage().contains("YYYYQ"));
  }

  @Test
  public void yyyyqToInt_rejects_bad_quarter_digit() {
    IllegalArgumentException e =
        assertThrows(IllegalArgumentException.class, () -> Quarter.yyyyqToInt("20245"));
    assertTrue(e.getMessage().contains("1, 2, 3 or 4"));
  }

  @Test
  public void increment_advances_within_a_year() {
    Quarter q = new Quarter("20241");
    assertEquals(20242, q.increment());
    assertEquals(20243, q.increment());
    assertEquals(20244, q.increment());
  }

  @Test
  public void increment_rolls_over_from_fall_to_the_next_winter() {
    Quarter q = new Quarter("20244");
    assertEquals(20251, q.increment());
  }

  @Test
  public void quarterList_is_inclusive_of_both_ends() {
    List<Quarter> quarters = Quarter.quarterList("20241", "20243");
    assertEquals(3, quarters.size());
    assertEquals("20241", quarters.get(0).getYYYYQ());
    assertEquals("20242", quarters.get(1).getYYYYQ());
    assertEquals("20243", quarters.get(2).getYYYYQ());
  }

  @Test
  public void quarterList_crosses_a_year_boundary() {
    List<Quarter> quarters = Quarter.quarterList("20244", "20252");
    assertEquals(3, quarters.size());
    assertEquals("20244", quarters.get(0).getYYYYQ());
    assertEquals("20251", quarters.get(1).getYYYYQ());
    assertEquals("20252", quarters.get(2).getYYYYQ());
  }

  @Test
  public void quarterList_of_a_single_quarter_has_one_element() {
    List<Quarter> quarters = Quarter.quarterList("20242", "20242");
    assertEquals(1, quarters.size());
    assertEquals("20242", quarters.get(0).getYYYYQ());
  }

  /** Unlike proj-courses' version, a backwards range is an error rather than a reversed list. */
  @Test
  public void quarterList_rejects_a_backwards_range() {
    IllegalArgumentException e =
        assertThrows(IllegalArgumentException.class, () -> Quarter.quarterList("20244", "20241"));
    assertTrue(e.getMessage().contains("must not be after"));
  }

  @Test
  public void quarterList_propagates_malformed_input() {
    assertThrows(IllegalArgumentException.class, () -> Quarter.quarterList("bogus", "20241"));
    assertThrows(IllegalArgumentException.class, () -> Quarter.quarterList("20241", "bogus"));
  }
}
