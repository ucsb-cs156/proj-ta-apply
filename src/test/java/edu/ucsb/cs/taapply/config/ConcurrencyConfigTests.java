package edu.ucsb.cs.taapply.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.concurrency.ClientActivityDetector;
import edu.ucsb.cs.taapply.concurrency.ClientIdentity;
import edu.ucsb.cs.taapply.concurrency.InMemoryClientActivityDetector;
import edu.ucsb.cs.taapply.concurrency.OtherClient;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;

public class ConcurrencyConfigTests {

  @Test
  public void the_detector_is_the_in_memory_one_with_the_configured_timing() {
    ClientActivityDetector detector = new ConcurrencyConfig().clientActivityDetector("2", "4");

    assertTrue(detector instanceof InMemoryClientActivityDetector);
    assertEquals(Duration.ofSeconds(2), detector.heartbeatInterval());
    assertEquals(Duration.ofSeconds(8), detector.window());
  }

  @Test
  public void the_defaults_are_five_seconds_and_three_missed_heartbeats() {
    ClientActivityDetector detector = new ConcurrencyConfig().clientActivityDetector("5", "3");

    assertEquals(Duration.ofSeconds(5), detector.heartbeatInterval());
    assertEquals(Duration.ofSeconds(15), detector.window());
    assertEquals(5, ConcurrencyConfig.DEFAULT_HEARTBEAT_INTERVAL_SEC);
    assertEquals(3, ConcurrencyConfig.DEFAULT_TIMEOUT_MISSED_HEARTBEATS);
  }

  @Test
  public void a_setting_that_is_unusable_falls_back_to_the_default() {
    for (String bad : new String[] {"", "  ", "abc", "1.5", "0", "-3", "99999999999"}) {
      ClientActivityDetector detector = new ConcurrencyConfig().clientActivityDetector(bad, bad);
      assertEquals(Duration.ofSeconds(5), detector.heartbeatInterval(), bad);
      assertEquals(Duration.ofSeconds(15), detector.window(), bad);
    }
  }

  @Test
  public void the_two_settings_fall_back_separately() {
    ClientActivityDetector detector = new ConcurrencyConfig().clientActivityDetector("x", "2");
    assertEquals(Duration.ofSeconds(5), detector.heartbeatInterval());
    assertEquals(Duration.ofSeconds(10), detector.window());

    detector = new ConcurrencyConfig().clientActivityDetector("7", "x");
    assertEquals(Duration.ofSeconds(7), detector.heartbeatInterval());
    assertEquals(Duration.ofSeconds(21), detector.window());
  }

  @Test
  public void a_setting_of_one_is_the_least_that_is_accepted() {
    ClientActivityDetector detector = new ConcurrencyConfig().clientActivityDetector(" 1 ", "1");
    assertEquals(Duration.ofSeconds(1), detector.heartbeatInterval());
    assertEquals(Duration.ofSeconds(1), detector.window());
  }

  @Test
  public void it_uses_the_real_clock() {
    ClientActivityDetector detector = new ConcurrencyConfig().clientActivityDetector("5", "3");

    detector.record("draft:1", "a", new ClientIdentity("a@example.org", "a"));
    detector.record("draft:1", "b", new ClientIdentity("b@example.org", "b"));
    // Seen a moment ago by the system clock, so well within a minute.
    assertEquals(List.of(new OtherClient("a", false)), detector.othersActive("draft:1", "b"));
  }
}
