package edu.ucsb.cs.taapply.concurrency;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * A {@link ClientActivityDetector} that keeps what it has seen in memory: for each resource key,
 * the time each client was last seen.
 *
 * <p>The clock and the window are given to the constructor, so that tests run in no time with a
 * clock they control. Every {@link #record} also forgets everything older than the window, on every
 * resource, so the state stays as small as the activity of the last window.
 *
 * <p><b>One server only.</b> A second server process would have a state of its own and the two
 * would not see each other's clients. The application runs as one instance. If that changes, the
 * state moves to the database behind this same interface.
 */
public class InMemoryClientActivityDetector implements ClientActivityDetector {

  private final Clock clock;
  private final Duration window;
  private final Map<String, Map<String, Instant>> seen = new HashMap<>();

  public InMemoryClientActivityDetector(Clock clock, Duration window) {
    if (window.isZero() || window.isNegative()) {
      throw new IllegalArgumentException("The window must be longer than zero");
    }
    this.clock = clock;
    this.window = window;
  }

  @Override
  public Duration window() {
    return window;
  }

  /** Whether a client last seen at this time still counts as active at {@code now}. */
  private boolean active(Instant lastSeen, Instant now) {
    return lastSeen.isAfter(now.minus(window));
  }

  @Override
  public synchronized void record(String resourceKey, String clientId) {
    Instant now = clock.instant();
    seen.computeIfAbsent(resourceKey, key -> new HashMap<>()).put(clientId, now);
    seen.values()
        .removeIf(
            clients -> {
              clients.values().removeIf(lastSeen -> !active(lastSeen, now));
              return clients.isEmpty();
            });
  }

  @Override
  public synchronized boolean othersActive(String resourceKey, String clientId) {
    Instant now = clock.instant();
    return seen.getOrDefault(resourceKey, Map.of()).entrySet().stream()
        .anyMatch(entry -> !entry.getKey().equals(clientId) && active(entry.getValue(), now));
  }

  /** How many resources currently have anyone remembered; for tests of the forgetting. */
  synchronized int resourcesRemembered() {
    return seen.size();
  }
}
