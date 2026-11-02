package edu.ucsb.cs.taapply.concurrency;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
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

  private static final ClientIdentity ADA = new ClientIdentity("ada@example.org", "Ada (Ada L)");
  private static final ClientIdentity BEN = new ClientIdentity("ben@example.org", "Ben (Ben B)");
  private static final ClientIdentity CAL =
      new ClientIdentity("cal@example.org", "cal@example.org");

  private final MovableClock clock = new MovableClock();
  private final InMemoryClientActivityDetector detector =
      new InMemoryClientActivityDetector(clock, Duration.ofSeconds(20), 3);

  @Test
  public void nobody_is_active_before_anyone_is_seen() {
    assertEquals(List.of(), detector.othersActive("draft:1", "a"));
  }

  @Test
  public void a_client_alone_does_not_see_itself_as_another() {
    detector.record("draft:1", "a", ADA);
    assertEquals(List.of(), detector.othersActive("draft:1", "a"));
  }

  @Test
  public void a_second_person_is_named_to_the_first_and_the_first_to_the_second() {
    detector.record("draft:1", "a", ADA);
    detector.record("draft:1", "b", BEN);

    assertEquals(
        List.of(new OtherClient("Ben (Ben B)", false)), detector.othersActive("draft:1", "a"));
    assertEquals(
        List.of(new OtherClient("Ada (Ada L)", false)), detector.othersActive("draft:1", "b"));
  }

  @Test
  public void a_second_tab_of_the_same_person_is_marked_as_the_same_person() {
    detector.record("draft:1", "tab-1", ADA);
    detector.record("draft:1", "tab-2", ADA);

    assertEquals(
        List.of(new OtherClient("Ada (Ada L)", true)), detector.othersActive("draft:1", "tab-1"));
    assertEquals(
        List.of(new OtherClient("Ada (Ada L)", true)), detector.othersActive("draft:1", "tab-2"));
  }

  @Test
  public void several_tabs_of_one_other_person_are_one_entry() {
    detector.record("draft:1", "a", ADA);
    detector.record("draft:1", "b-1", BEN);
    detector.record("draft:1", "b-2", BEN);
    detector.record("draft:1", "b-3", BEN);

    assertEquals(
        List.of(new OtherClient("Ben (Ben B)", false)), detector.othersActive("draft:1", "a"));
  }

  @Test
  public void the_same_person_and_other_people_are_all_listed_each_once() {
    detector.record("draft:1", "ada-1", ADA);
    detector.record("draft:1", "ada-2", ADA);
    detector.record("draft:1", "ben", BEN);
    detector.record("draft:1", "cal", CAL);

    assertEquals(
        List.of(
            new OtherClient("Ada (Ada L)", true),
            new OtherClient("Ben (Ben B)", false),
            new OtherClient("cal@example.org", false)),
        detector.othersActive("draft:1", "ada-1"));
  }

  @Test
  public void people_are_in_order_of_label_ignoring_case() {
    detector.record("draft:1", "me", CAL);
    detector.record("draft:1", "x", new ClientIdentity("z", "zed"));
    detector.record("draft:1", "y", new ClientIdentity("a", "Alpha"));
    detector.record("draft:1", "w", new ClientIdentity("m", "mike"));

    assertEquals(
        List.of("Alpha", "mike", "zed"),
        detector.othersActive("draft:1", "me").stream().map(OtherClient::label).toList());
  }

  @Test
  public void people_whose_labels_differ_only_in_case_are_still_in_a_fixed_order() {
    detector.record("draft:1", "me", CAL);
    detector.record("draft:1", "x", new ClientIdentity("1", "sam"));
    detector.record("draft:1", "y", new ClientIdentity("2", "Sam"));

    assertEquals(
        List.of("Sam", "sam"),
        detector.othersActive("draft:1", "me").stream().map(OtherClient::label).toList());
  }

  @Test
  public void a_caller_who_was_never_recorded_sees_those_who_were_and_is_nobodys_same_person() {
    detector.record("draft:1", "a", ADA);

    assertEquals(
        List.of(new OtherClient("Ada (Ada L)", false)),
        detector.othersActive("draft:1", "never-seen"));
  }

  @Test
  public void clients_on_other_resources_do_not_count() {
    detector.record("draft:1", "a", ADA);
    detector.record("draft:2", "b", BEN);

    assertEquals(List.of(), detector.othersActive("draft:1", "a"));
    assertEquals(List.of(), detector.othersActive("draft:2", "b"));
  }

  @Test
  public void another_client_stops_counting_exactly_when_the_window_has_passed() {
    detector.record("draft:1", "a", ADA);
    detector.record("draft:1", "b", BEN);

    clock.advance(Duration.ofSeconds(59));
    assertEquals(1, detector.othersActive("draft:1", "a").size());

    // Exactly one window since b was seen: no longer active.
    clock.advance(Duration.ofSeconds(1));
    assertEquals(List.of(), detector.othersActive("draft:1", "a"));
  }

  @Test
  public void seeing_a_client_again_keeps_it_active() {
    detector.record("draft:1", "a", ADA);
    detector.record("draft:1", "b", BEN);

    clock.advance(Duration.ofSeconds(40));
    detector.record("draft:1", "b", BEN);
    clock.advance(Duration.ofSeconds(40));

    // a was last seen 80 seconds ago and b 40, and only a is the one asking.
    assertEquals(
        List.of(new OtherClient("Ben (Ben B)", false)), detector.othersActive("draft:1", "a"));
    assertEquals(List.of(), detector.othersActive("draft:1", "b"));
  }

  @Test
  public void a_client_seen_again_is_known_by_the_identity_it_last_gave() {
    detector.record("draft:1", "a", ADA);
    detector.record("draft:1", "b", new ClientIdentity("ben@example.org", "Ben (old name)"));
    detector.record("draft:1", "b", BEN);

    assertEquals(
        List.of(new OtherClient("Ben (Ben B)", false)), detector.othersActive("draft:1", "a"));
  }

  @Test
  public void the_warning_clears_once_the_other_copy_goes_quiet() {
    detector.record("draft:1", "a", ADA);
    detector.record("draft:1", "b", BEN);
    assertEquals(1, detector.othersActive("draft:1", "a").size());

    // b is closed and stops beating; a goes on being seen.
    for (int i = 0; i < 4; i++) {
      clock.advance(Duration.ofSeconds(20));
      detector.record("draft:1", "a", ADA);
    }
    assertEquals(List.of(), detector.othersActive("draft:1", "a"));
  }

  @Test
  public void recording_forgets_what_is_older_than_the_window_on_every_resource() {
    detector.record("draft:1", "a", ADA);
    detector.record("draft:2", "b", BEN);
    detector.record("draft:2", "c", CAL);
    assertEquals(2, detector.resourcesRemembered());

    clock.advance(Duration.ofSeconds(61));
    detector.record("draft:3", "d", ADA);

    // Only the resource just recorded is left; the others aged out without being touched.
    assertEquals(1, detector.resourcesRemembered());
    assertEquals(List.of(), detector.othersActive("draft:2", "x"));
  }

  @Test
  public void recording_keeps_a_resource_while_any_of_its_clients_is_recent() {
    detector.record("draft:1", "old", ADA);
    clock.advance(Duration.ofSeconds(50));
    detector.record("draft:1", "recent", BEN);
    clock.advance(Duration.ofSeconds(20));
    detector.record("draft:2", "other", CAL);

    assertEquals(2, detector.resourcesRemembered());
    // old aged out of draft:1, recent has not.
    assertEquals(
        List.of(new OtherClient("Ben (Ben B)", false)), detector.othersActive("draft:1", "old"));
    assertEquals(List.of(), detector.othersActive("draft:1", "recent"));
  }

  @Test
  public void the_window_is_the_interval_times_the_missed_heartbeats() {
    assertEquals(Duration.ofSeconds(60), detector.window());
    assertEquals(Duration.ofSeconds(20), detector.heartbeatInterval());
    assertEquals(
        Duration.ofSeconds(15),
        new InMemoryClientActivityDetector(clock, Duration.ofSeconds(5), 3).window());
  }

  @Test
  public void an_interval_of_zero_or_less_or_no_missed_heartbeats_is_refused() {
    assertThrows(
        IllegalArgumentException.class,
        () -> new InMemoryClientActivityDetector(clock, Duration.ZERO, 3));
    assertThrows(
        IllegalArgumentException.class,
        () -> new InMemoryClientActivityDetector(clock, Duration.ofSeconds(-1), 3));
    assertThrows(
        IllegalArgumentException.class,
        () -> new InMemoryClientActivityDetector(clock, Duration.ofSeconds(5), 0));
    // One missed heartbeat is the least that is allowed.
    assertEquals(
        Duration.ofSeconds(5),
        new InMemoryClientActivityDetector(clock, Duration.ofSeconds(5), 1).window());
  }

  private static long suggested(Duration interval) {
    return new InMemoryClientActivityDetector(new MovableClock(), interval, 3)
        .suggestedHeartbeatSeconds();
  }

  @Test
  public void the_suggested_heartbeat_is_the_interval_in_seconds_rounded_up_and_at_least_one() {
    assertEquals(20, detector.suggestedHeartbeatSeconds());
    assertEquals(5, suggested(Duration.ofSeconds(5)));
    assertEquals(2, suggested(Duration.ofMillis(2000)));
    assertEquals(3, suggested(Duration.ofMillis(2001)));
    assertEquals(2, suggested(Duration.ofMillis(1001)));
    assertEquals(1, suggested(Duration.ofMillis(1000)));
    assertEquals(1, suggested(Duration.ofMillis(300)));
  }

  private static final long START = Instant.parse("2026-11-02T12:00:00Z").toEpochMilli();

  @Test
  public void a_heartbeat_records_the_client_and_answers_with_the_others_and_the_interval() {
    Presence first = detector.heartbeat("draft:1", "a", ADA);
    assertEquals(new Presence(List.of(), 20, true, START), first);

    clock.advance(Duration.ofSeconds(1));
    Presence second = detector.heartbeat("draft:1", "b", BEN);
    assertEquals(
        new Presence(List.of(new OtherClient("Ada (Ada L)", false)), 20, true, START + 1000),
        second);
    // It really did record: a now sees b without having been recorded since, and is not the newest.
    assertEquals(
        new Presence(List.of(new OtherClient("Ben (Ben B)", false)), 20, false, START),
        detector.heartbeat("draft:1", "a", ADA));
  }

  @Test
  public void a_heartbeat_from_a_client_that_did_not_name_itself_usably_is_not_recorded_or_told() {
    detector.record("draft:1", "a", ADA);

    for (String bad :
        new String[] {null, "", "   ", "x".repeat(ConcurrencyHeaders.MAX_CLIENT_ID_LENGTH + 1)}) {
      assertEquals(new Presence(List.of(), 20, false, 0), detector.heartbeat("draft:1", bad, BEN));
    }
    // Nobody was recorded by those: a sees no one.
    assertEquals(List.of(), detector.othersActive("draft:1", "a"));
  }

  @Test
  public void leaving_stops_a_client_counting_at_once() {
    detector.record("draft:1", "a", ADA);
    detector.record("draft:1", "b", BEN);
    assertEquals(1, detector.othersActive("draft:1", "a").size());

    detector.leave("draft:1", "b");

    assertEquals(List.of(), detector.othersActive("draft:1", "a"));
    assertEquals(1, detector.resourcesRemembered());
  }

  @Test
  public void leaving_takes_only_that_client_and_only_from_that_resource() {
    detector.record("draft:1", "a", ADA);
    detector.record("draft:1", "b", BEN);
    detector.record("draft:1", "c", CAL);
    detector.record("draft:2", "b", BEN);

    detector.leave("draft:1", "b");

    assertEquals(
        List.of(new OtherClient("cal@example.org", false)), detector.othersActive("draft:1", "a"));
    assertEquals(
        List.of(new OtherClient("Ben (Ben B)", false)), detector.othersActive("draft:2", "a"));
  }

  @Test
  public void the_last_client_to_leave_lets_the_resource_be_forgotten() {
    detector.record("draft:1", "a", ADA);
    detector.leave("draft:1", "a");
    assertEquals(0, detector.resourcesRemembered());
  }

  @Test
  public void leaving_when_not_known_changes_nothing() {
    detector.leave("draft:1", "nobody");
    assertEquals(0, detector.resourcesRemembered());

    detector.record("draft:1", "a", ADA);
    detector.leave("draft:1", "nobody");
    detector.leave("draft:9", "a");
    assertEquals(1, detector.resourcesRemembered());
    assertEquals(
        List.of(new OtherClient("Ada (Ada L)", false)), detector.othersActive("draft:1", "x"));
  }

  @Test
  public void a_client_alone_is_the_newest_and_arrived_when_first_seen() {
    detector.record("draft:1", "a", ADA);
    assertEquals(new Arrival(true, START), detector.arrival("draft:1", "a"));
  }

  @Test
  public void a_client_never_recorded_has_not_arrived() {
    detector.record("draft:1", "a", ADA);
    assertEquals(new Arrival(false, 0), detector.arrival("draft:1", "never"));
    assertEquals(new Arrival(false, 0), detector.arrival("draft:2", "a"));
  }

  @Test
  public void only_the_client_that_arrived_after_all_the_others_is_the_newest() {
    detector.record("draft:1", "a", ADA);
    clock.advance(Duration.ofSeconds(1));
    detector.record("draft:1", "b", BEN);
    clock.advance(Duration.ofSeconds(1));
    detector.record("draft:1", "c", CAL);

    assertEquals(new Arrival(false, START), detector.arrival("draft:1", "a"));
    assertEquals(new Arrival(false, START + 1000), detector.arrival("draft:1", "b"));
    assertEquals(new Arrival(true, START + 2000), detector.arrival("draft:1", "c"));
  }

  @Test
  public void a_second_tab_of_the_same_person_arrives_after_the_first() {
    detector.record("draft:1", "tab-1", ADA);
    clock.advance(Duration.ofSeconds(1));
    detector.record("draft:1", "tab-2", ADA);

    assertEquals(false, detector.arrival("draft:1", "tab-1").newest());
    assertEquals(true, detector.arrival("draft:1", "tab-2").newest());
  }

  @Test
  public void clients_that_arrive_together_are_put_in_order_by_identifier() {
    detector.record("draft:1", "a", ADA);
    detector.record("draft:1", "b", BEN);

    // Exactly one of them is the newest, however the clock stands.
    assertEquals(false, detector.arrival("draft:1", "a").newest());
    assertEquals(true, detector.arrival("draft:1", "b").newest());
  }

  @Test
  public void being_seen_again_keeps_the_arrival() {
    detector.record("draft:1", "a", ADA);
    clock.advance(Duration.ofSeconds(1));
    detector.record("draft:1", "b", BEN);
    clock.advance(Duration.ofSeconds(19));
    detector.record("draft:1", "a", ADA);
    clock.advance(Duration.ofSeconds(19));
    detector.record("draft:1", "a", ADA);

    // a keeps beating, but it was here first.
    assertEquals(new Arrival(false, START), detector.arrival("draft:1", "a"));
    assertEquals(true, detector.arrival("draft:1", "b").newest());
  }

  @Test
  public void a_client_that_had_gone_quiet_arrives_afresh_when_it_is_seen_again() {
    detector.record("draft:1", "a", ADA);
    detector.record("draft:1", "b", BEN);
    clock.advance(Duration.ofSeconds(30));
    detector.record("draft:1", "b", BEN);
    // Exactly one window since a was seen: a had gone.
    clock.advance(Duration.ofSeconds(30));
    detector.record("draft:1", "a", ADA);

    assertEquals(new Arrival(true, START + 60_000), detector.arrival("draft:1", "a"));
    assertEquals(new Arrival(false, START), detector.arrival("draft:1", "b"));
  }

  @Test
  public void a_client_just_inside_the_window_keeps_its_arrival() {
    detector.record("draft:1", "a", ADA);
    clock.advance(Duration.ofSeconds(59));
    detector.record("draft:1", "a", ADA);
    assertEquals(new Arrival(true, START), detector.arrival("draft:1", "a"));
  }

  @Test
  public void a_client_that_left_and_comes_back_arrives_afresh() {
    detector.record("draft:1", "a", ADA);
    clock.advance(Duration.ofSeconds(1));
    detector.record("draft:1", "b", BEN);
    detector.leave("draft:1", "a");
    clock.advance(Duration.ofSeconds(1));
    detector.record("draft:1", "a", ADA);

    assertEquals(new Arrival(true, START + 2000), detector.arrival("draft:1", "a"));
    assertEquals(false, detector.arrival("draft:1", "b").newest());
  }

  @Test
  public void a_newer_client_that_has_gone_quiet_does_not_stop_this_one_being_the_newest() {
    detector.record("draft:1", "a", ADA);
    clock.advance(Duration.ofSeconds(10));
    detector.record("draft:1", "b", BEN);
    clock.advance(Duration.ofSeconds(30));
    detector.record("draft:1", "a", ADA);
    // b was last seen 59 seconds ago: still here.
    clock.advance(Duration.ofSeconds(29));
    assertEquals(false, detector.arrival("draft:1", "a").newest());
    // Now b was last seen exactly a window ago, and has gone.
    clock.advance(Duration.ofSeconds(1));
    assertEquals(new Arrival(true, START), detector.arrival("draft:1", "a"));
  }

  @Test
  public void a_client_that_left_no_longer_decides_who_is_the_newest() {
    detector.record("draft:1", "a", ADA);
    clock.advance(Duration.ofSeconds(1));
    detector.record("draft:1", "b", BEN);
    assertEquals(false, detector.arrival("draft:1", "a").newest());

    detector.leave("draft:1", "b");

    assertEquals(true, detector.arrival("draft:1", "a").newest());
  }

  @Test
  public void noting_records_a_usable_client_and_ignores_the_rest() {
    detector.note("draft:1", "a", ADA);
    detector.note("draft:1", null, BEN);
    detector.note("draft:1", " ", BEN);
    detector.note("draft:1", "x".repeat(ConcurrencyHeaders.MAX_CLIENT_ID_LENGTH + 1), BEN);

    assertEquals(1, detector.resourcesRemembered());
    assertEquals(
        List.of(new OtherClient("Ada (Ada L)", false)),
        detector.othersActive("draft:1", "someone"));
  }
}
