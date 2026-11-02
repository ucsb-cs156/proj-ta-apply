package edu.ucsb.cs.taapply.concurrency;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** The detector on its own: no Spring, no application classes, a clock the test moves. */
public class InMemoryClientActivityDetectorTests {

  /** A clock that stands still until the test moves it. */
  static class MovableClock extends Clock {
    private Instant now = Instant.parse("2026-11-02T12:00:00Z");

    void advance(Duration by) {
      now = now.plus(by);
    }

    @Override
    public ZoneId getZone() {
      return ZoneOffset.UTC;
    }

    @Override
    public Clock withZone(ZoneId zone) {
      return this;
    }

    @Override
    public Instant instant() {
      return now;
    }
  }

  private final MovableClock clock = new MovableClock();
  private final InMemoryClientActivityDetector detector =
      new InMemoryClientActivityDetector(clock, Duration.ofSeconds(60));

  @Test
  public void nobody_is_active_before_anyone_is_seen() {
    assertFalse(detector.othersActive("draft:1", "a"));
  }

  @Test
  public void a_client_alone_does_not_see_itself_as_another() {
    detector.record("draft:1", "a");
    assertFalse(detector.othersActive("draft:1", "a"));
  }

  @Test
  public void a_second_client_makes_each_see_the_other() {
    detector.record("draft:1", "a");
    detector.record("draft:1", "b");
    assertTrue(detector.othersActive("draft:1", "a"));
    assertTrue(detector.othersActive("draft:1", "b"));
  }

  @Test
  public void a_client_who_was_never_recorded_sees_those_who_were() {
    detector.record("draft:1", "a");
    assertTrue(detector.othersActive("draft:1", "never-seen"));
  }

  @Test
  public void clients_on_other_resources_do_not_count() {
    detector.record("draft:1", "a");
    detector.record("draft:2", "b");
    assertFalse(detector.othersActive("draft:1", "a"));
    assertFalse(detector.othersActive("draft:2", "b"));
  }

  @Test
  public void another_client_stops_counting_exactly_when_the_window_has_passed() {
    detector.record("draft:1", "a");
    detector.record("draft:1", "b");

    clock.advance(Duration.ofSeconds(59));
    assertTrue(detector.othersActive("draft:1", "a"));

    // Exactly one window since b was seen: no longer active.
    clock.advance(Duration.ofSeconds(1));
    assertFalse(detector.othersActive("draft:1", "a"));
  }

  @Test
  public void seeing_a_client_again_keeps_it_active() {
    detector.record("draft:1", "a");
    detector.record("draft:1", "b");

    clock.advance(Duration.ofSeconds(40));
    detector.record("draft:1", "b");
    clock.advance(Duration.ofSeconds(40));

    // a was last seen 80 seconds ago and b 40, and only a is the one asking.
    assertTrue(detector.othersActive("draft:1", "a"));
    assertFalse(detector.othersActive("draft:1", "b"));
  }

  @Test
  public void the_warning_clears_once_the_other_copy_goes_quiet() {
    detector.record("draft:1", "a");
    detector.record("draft:1", "b");
    assertTrue(detector.othersActive("draft:1", "a"));

    // b is closed and stops beating; a goes on being seen.
    for (int i = 0; i < 4; i++) {
      clock.advance(Duration.ofSeconds(20));
      detector.record("draft:1", "a");
    }
    assertFalse(detector.othersActive("draft:1", "a"));
  }

  @Test
  public void recording_forgets_what_is_older_than_the_window_on_every_resource() {
    detector.record("draft:1", "a");
    detector.record("draft:2", "b");
    detector.record("draft:2", "c");
    assertEquals(2, detector.resourcesRemembered());

    clock.advance(Duration.ofSeconds(61));
    detector.record("draft:3", "d");

    // Only the resource just recorded is left; the others aged out without being touched.
    assertEquals(1, detector.resourcesRemembered());
    assertFalse(detector.othersActive("draft:2", "x"));
  }

  @Test
  public void recording_keeps_a_resource_while_any_of_its_clients_is_recent() {
    detector.record("draft:1", "old");
    clock.advance(Duration.ofSeconds(50));
    detector.record("draft:1", "recent");
    clock.advance(Duration.ofSeconds(20));
    detector.record("draft:2", "other");

    assertEquals(2, detector.resourcesRemembered());
    // old aged out of draft:1, recent has not.
    assertTrue(detector.othersActive("draft:1", "old"));
    assertFalse(detector.othersActive("draft:1", "recent"));
  }

  @Test
  public void the_window_is_reported() {
    assertEquals(Duration.ofSeconds(60), detector.window());
  }

  @Test
  public void a_window_of_zero_or_less_is_refused() {
    assertThrows(
        IllegalArgumentException.class,
        () -> new InMemoryClientActivityDetector(clock, Duration.ZERO));
    assertThrows(
        IllegalArgumentException.class,
        () -> new InMemoryClientActivityDetector(clock, Duration.ofSeconds(-1)));
  }

  @Test
  public void the_heartbeat_is_three_a_window_and_never_less_than_a_second() {
    assertEquals(20, detector.suggestedHeartbeatSeconds());
    assertEquals(
        2,
        new InMemoryClientActivityDetector(clock, Duration.ofSeconds(6))
            .suggestedHeartbeatSeconds());
    assertEquals(
        1,
        new InMemoryClientActivityDetector(clock, Duration.ofSeconds(2))
            .suggestedHeartbeatSeconds());
    assertEquals(
        1,
        new InMemoryClientActivityDetector(clock, Duration.ofMillis(300))
            .suggestedHeartbeatSeconds());
  }

  @Test
  public void observe_records_the_client_and_answers_with_both_headers() {
    Map<String, String> first = detector.observe("draft:1", "a");
    assertEquals(
        Map.of(
            ConcurrencyHeaders.OTHER_CLIENTS_ACTIVE, "false",
            ConcurrencyHeaders.HEARTBEAT_SECONDS, "20"),
        first);

    Map<String, String> second = detector.observe("draft:1", "b");
    assertEquals("true", second.get(ConcurrencyHeaders.OTHER_CLIENTS_ACTIVE));
    // It really did record: a now sees b without having been recorded since.
    assertTrue(detector.othersActive("draft:1", "a"));
  }

  @Test
  public void observe_ignores_a_client_that_did_not_name_itself_usably() {
    assertEquals(Map.of(), detector.observe("draft:1", null));
    assertEquals(Map.of(), detector.observe("draft:1", ""));
    assertEquals(Map.of(), detector.observe("draft:1", "   "));
    assertEquals(
        Map.of(),
        detector.observe("draft:1", "x".repeat(ConcurrencyHeaders.MAX_CLIENT_ID_LENGTH + 1)));
    assertEquals(0, detector.resourcesRemembered());
  }
}
