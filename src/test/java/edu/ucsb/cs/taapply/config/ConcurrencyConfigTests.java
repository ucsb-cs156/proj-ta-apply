package edu.ucsb.cs.taapply.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.concurrency.ClientActivityDetector;
import edu.ucsb.cs.taapply.concurrency.InMemoryClientActivityDetector;
import java.time.Duration;
import org.junit.jupiter.api.Test;

public class ConcurrencyConfigTests {

  @Test
  public void the_detector_is_the_in_memory_one_with_the_configured_window() {
    ClientActivityDetector detector = new ConcurrencyConfig().clientActivityDetector(6);

    assertTrue(detector instanceof InMemoryClientActivityDetector);
    assertEquals(Duration.ofSeconds(6), detector.window());
  }

  @Test
  public void it_uses_the_real_clock() {
    ClientActivityDetector detector = new ConcurrencyConfig().clientActivityDetector(60);

    detector.record("draft:1", "a");
    detector.record("draft:1", "b");
    // Seen a moment ago by the system clock, so well within a minute.
    assertTrue(detector.othersActive("draft:1", "a"));
  }
}
