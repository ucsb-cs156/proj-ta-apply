package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

public class RefreshSettingTests {

  @Test
  public void a_good_base_is_used_and_trimmed() {
    assertEquals(7.0, RefreshSetting.base("7", 5));
    assertEquals(2.5, RefreshSetting.base(" 2.5 ", 5));
  }

  @Test
  public void a_base_of_exactly_one_second_is_allowed() {
    assertEquals(1.0, RefreshSetting.base("1", 5));
  }

  @ParameterizedTest
  @NullSource
  @ValueSource(strings = {"", "  ", "abc", "0", "0.9", "-3", "NaN", "Infinity", "-Infinity"})
  public void a_bad_base_is_the_default(String setting) {
    assertEquals(5.0, RefreshSetting.base(setting, 5));
  }

  @Test
  public void a_good_jitter_is_used() {
    assertEquals(2.0, RefreshSetting.jitter("2", 3, 5));
    assertEquals(0.0, RefreshSetting.jitter("0", 3, 5));
  }

  @Test
  public void a_jitter_equal_to_the_base_is_allowed() {
    assertEquals(5.0, RefreshSetting.jitter("5", 3, 5));
  }

  @ParameterizedTest
  @NullSource
  @ValueSource(strings = {"", "x", "-1", "5.1", "NaN", "Infinity"})
  public void a_bad_jitter_is_the_default(String setting) {
    assertEquals(3.0, RefreshSetting.jitter(setting, 3, 5));
  }

  @Test
  public void the_default_jitter_never_exceeds_the_base() {
    assertEquals(2.0, RefreshSetting.jitter("junk", 3, 2));
  }
}
