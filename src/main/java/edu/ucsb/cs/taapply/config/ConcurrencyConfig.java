package edu.ucsb.cs.taapply.config;

import edu.ucsb.cs.taapply.concurrency.ClientActivityDetector;
import edu.ucsb.cs.taapply.concurrency.InMemoryClientActivityDetector;
import java.time.Clock;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Makes the one {@link ClientActivityDetector} the application uses (issues #273, #284). Two
 * settings, both from the environment: {@code CLIENT_HEARTBEAT_INTERVAL_SEC}, how often an open tab
 * sends a heartbeat (5), and {@code CLIENT_TIMEOUT_MISSED_HEARTBEATS}, how many intervals of
 * silence make a tab count as gone (3). A tab is forgotten after the interval times the missed
 * heartbeats, 15 seconds by default. A value that is not a whole number of at least 1 is replaced
 * by the default, so a typo cannot stop the application from starting.
 */
@Configuration
public class ConcurrencyConfig {

  public static final int DEFAULT_HEARTBEAT_INTERVAL_SEC = 5;
  public static final int DEFAULT_TIMEOUT_MISSED_HEARTBEATS = 3;

  /** The setting as a whole number of at least 1, or the fallback if it is anything else. */
  static int positiveOrDefault(String setting, int fallback) {
    try {
      int value = Integer.parseInt(setting.trim());
      return value >= 1 ? value : fallback;
    } catch (NumberFormatException e) {
      return fallback;
    }
  }

  @Bean
  public ClientActivityDetector clientActivityDetector(
      @Value("${app.concurrency.heartbeat-interval-sec:5}") String heartbeatIntervalSec,
      @Value("${app.concurrency.timeout-missed-heartbeats:3}") String missedHeartbeats) {
    return new InMemoryClientActivityDetector(
        Clock.systemUTC(),
        Duration.ofSeconds(positiveOrDefault(heartbeatIntervalSec, DEFAULT_HEARTBEAT_INTERVAL_SEC)),
        positiveOrDefault(missedHeartbeats, DEFAULT_TIMEOUT_MISSED_HEARTBEATS));
  }
}
