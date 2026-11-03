package edu.ucsb.cs.taapply.time;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.TimeZone;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Pacific time, whatever the zone the server (or the clock handed in) is in (issue #293). */
public class AppTimeTests {

  private TimeZone original;

  @BeforeEach
  public void remember_the_default_zone() {
    original = TimeZone.getDefault();
  }

  @AfterEach
  public void restore_the_default_zone() {
    TimeZone.setDefault(original);
  }

  private static Clock at(String instant, ZoneId clockZone) {
    return Clock.fixed(Instant.parse(instant), clockZone);
  }

  @Test
  public void the_zone_is_los_angeles() {
    assertEquals("America/Los_Angeles", AppTime.ZONE.getId());
  }

  @Test
  public void now_is_the_pacific_wall_clock_time_of_the_instant_whatever_the_clocks_own_zone() {
    // 2026-11-02T03:30Z is 7:30 p.m. the day before, in Pacific standard time (UTC-8)
    LocalDateTime expected = LocalDateTime.of(2026, 11, 1, 19, 30);
    assertEquals(expected, AppTime.now(at("2026-11-02T03:30:00Z", ZoneOffset.UTC)));
    assertEquals(expected, AppTime.now(at("2026-11-02T03:30:00Z", ZoneId.of("Asia/Tokyo"))));
    assertEquals(expected, AppTime.now(at("2026-11-02T03:30:00Z", AppTime.ZONE)));
  }

  @Test
  public void in_summer_pacific_is_seven_hours_behind_utc() {
    assertEquals(
        LocalDateTime.of(2026, 7, 1, 5, 15, 30),
        AppTime.now(at("2026-07-01T12:15:30Z", ZoneOffset.UTC)));
  }

  @Test
  public void today_changes_at_pacific_midnight_not_at_utc_midnight() {
    // 6:59:59 a.m. UTC in July is 11:59:59 p.m. the day before; one second later is midnight
    assertEquals(
        LocalDate.of(2026, 6, 30), AppTime.today(at("2026-07-01T06:59:59Z", ZoneOffset.UTC)));
    assertEquals(
        LocalDate.of(2026, 7, 1), AppTime.today(at("2026-07-01T07:00:00Z", ZoneOffset.UTC)));
    // and in winter the change is at 8 a.m. UTC
    assertEquals(
        LocalDate.of(2026, 12, 31), AppTime.today(at("2027-01-01T07:59:59Z", ZoneOffset.UTC)));
    assertEquals(
        LocalDate.of(2027, 1, 1), AppTime.today(at("2027-01-01T08:00:00Z", ZoneOffset.UTC)));
  }

  @Test
  public void spring_forward_skips_two_to_three_a_m() {
    assertEquals(
        LocalDateTime.of(2026, 3, 8, 1, 59, 59),
        AppTime.now(at("2026-03-08T09:59:59Z", ZoneOffset.UTC)));
    assertEquals(
        LocalDateTime.of(2026, 3, 8, 3, 0),
        AppTime.now(at("2026-03-08T10:00:00Z", ZoneOffset.UTC)));
  }

  @Test
  public void fall_back_shows_one_thirty_twice() {
    assertEquals(
        LocalDateTime.of(2026, 11, 1, 1, 30),
        AppTime.now(at("2026-11-01T08:30:00Z", ZoneOffset.UTC)));
    assertEquals(
        LocalDateTime.of(2026, 11, 1, 1, 30),
        AppTime.now(at("2026-11-01T09:30:00Z", ZoneOffset.UTC)));
    assertEquals(
        LocalDateTime.of(2026, 11, 1, 2, 0),
        AppTime.now(at("2026-11-01T10:00:00Z", ZoneOffset.UTC)));
  }

  @ParameterizedTest
  @ValueSource(strings = {"UTC", "Asia/Tokyo", "America/New_York", "America/Los_Angeles"})
  public void the_clock_less_versions_ignore_the_jvm_zone(String zone) {
    TimeZone.setDefault(TimeZone.getTimeZone(zone));
    LocalDateTime before = LocalDateTime.now(AppTime.ZONE);
    LocalDateTime now = AppTime.now();
    LocalDate today = AppTime.today();
    LocalDateTime after = LocalDateTime.now(AppTime.ZONE);

    assertTrue(!now.isBefore(before) && !now.isAfter(after), now + " not in " + before);
    assertTrue(Duration.between(before, now).abs().getSeconds() < 5);
    assertTrue(
        today.equals(before.toLocalDate()) || today.equals(after.toLocalDate()), "today " + today);
  }

  @Test
  public void installing_makes_pacific_the_jvm_default() {
    TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
    AppTime.installAsDefaultTimeZone();
    assertEquals("America/Los_Angeles", TimeZone.getDefault().getID());
    assertEquals(AppTime.ZONE, ZoneId.systemDefault());
    // twice is harmless
    AppTime.installAsDefaultTimeZone();
    assertEquals("America/Los_Angeles", TimeZone.getDefault().getID());
  }
}
