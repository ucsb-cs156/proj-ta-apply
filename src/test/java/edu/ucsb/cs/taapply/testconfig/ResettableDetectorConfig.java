package edu.ucsb.cs.taapply.testconfig;

import edu.ucsb.cs.taapply.concurrency.Arrival;
import edu.ucsb.cs.taapply.concurrency.ClientActivityDetector;
import edu.ucsb.cs.taapply.concurrency.ClientIdentity;
import edu.ucsb.cs.taapply.concurrency.OtherClient;
import edu.ucsb.cs.taapply.config.ConcurrencyConfig;
import java.time.Duration;
import java.util.List;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

/**
 * The application's detector for controller tests, but one that can be emptied. The detector is one
 * bean for the whole test class, and a mutation tester runs the tests again and again in one JVM,
 * so what one run recorded would otherwise be there for the next. Import this class and call {@link
 * Resettable#reset()} before each test.
 */
@TestConfiguration
public class ResettableDetectorConfig {

  public static class Resettable implements ClientActivityDetector {
    private volatile ClientActivityDetector delegate = fresh();

    private static ClientActivityDetector fresh() {
      return new ConcurrencyConfig().clientActivityDetector("5", "3");
    }

    public void reset() {
      delegate = fresh();
    }

    @Override
    public void record(String resourceKey, String clientId, ClientIdentity identity) {
      delegate.record(resourceKey, clientId, identity);
    }

    @Override
    public List<OtherClient> othersActive(String resourceKey, String clientId) {
      return delegate.othersActive(resourceKey, clientId);
    }

    @Override
    public void leave(String resourceKey, String clientId) {
      delegate.leave(resourceKey, clientId);
    }

    @Override
    public Arrival arrival(String resourceKey, String clientId) {
      return delegate.arrival(resourceKey, clientId);
    }

    @Override
    public Duration window() {
      return delegate.window();
    }

    @Override
    public Duration heartbeatInterval() {
      return delegate.heartbeatInterval();
    }
  }

  @Bean
  public Resettable clientActivityDetector() {
    return new Resettable();
  }
}
