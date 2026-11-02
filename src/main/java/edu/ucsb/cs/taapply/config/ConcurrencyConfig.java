package edu.ucsb.cs.taapply.config;

import edu.ucsb.cs.taapply.concurrency.ClientActivityDetector;
import edu.ucsb.cs.taapply.concurrency.InMemoryClientActivityDetector;
import java.time.Clock;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Makes the one {@link ClientActivityDetector} the application uses (issue #273). The window is the
 * only setting: 60 seconds, unless {@code app.concurrency.window-seconds} says otherwise, which the
 * integration tests do so that a warning can be seen to clear in seconds.
 */
@Configuration
public class ConcurrencyConfig {

  @Bean
  public ClientActivityDetector clientActivityDetector(
      @Value("${app.concurrency.window-seconds:60}") long windowSeconds) {
    return new InMemoryClientActivityDetector(Clock.systemUTC(), Duration.ofSeconds(windowSeconds));
  }
}
