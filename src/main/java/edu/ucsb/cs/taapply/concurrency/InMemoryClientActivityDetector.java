package edu.ucsb.cs.taapply.concurrency;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * A {@link ClientActivityDetector} that keeps what it has seen in memory: for each resource key and
 * client, when it was last seen and who it is.
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

  /** When a client was last seen, and who it is. */
  private record Seen(Instant at, ClientIdentity identity) {}

  private static final Comparator<OtherClient> BY_LABEL =
      Comparator.comparing(OtherClient::label, String.CASE_INSENSITIVE_ORDER)
          .thenComparing(OtherClient::label);

  private final Clock clock;
  private final Duration window;
  private final Map<String, Map<String, Seen>> seen = new HashMap<>();

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
  public synchronized void record(String resourceKey, String clientId, ClientIdentity identity) {
    Instant now = clock.instant();
    seen.computeIfAbsent(resourceKey, key -> new HashMap<>())
        .put(clientId, new Seen(now, identity));
    seen.values()
        .removeIf(
            clients -> {
              clients.values().removeIf(client -> !active(client.at(), now));
              return clients.isEmpty();
            });
  }

  @Override
  public synchronized List<OtherClient> othersActive(String resourceKey, String clientId) {
    Instant now = clock.instant();
    Map<String, Seen> clients = seen.getOrDefault(resourceKey, Map.of());
    Seen caller = clients.get(clientId);
    String callerKey = caller == null ? null : caller.identity().personKey();

    // One entry for each person, however many of their clients are active.
    Map<String, OtherClient> people = new HashMap<>();
    clients.forEach(
        (id, client) -> {
          if (!id.equals(clientId) && active(client.at(), now)) {
            ClientIdentity who = client.identity();
            people.putIfAbsent(
                who.personKey(), new OtherClient(who.label(), who.personKey().equals(callerKey)));
          }
        });
    return people.values().stream().sorted(BY_LABEL).toList();
  }

  /** How many resources currently have anyone remembered; for tests of the forgetting. */
  synchronized int resourcesRemembered() {
    return seen.size();
  }
}
