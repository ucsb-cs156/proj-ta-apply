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
 * client, when it arrived, when it was last seen and who it is.
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

  /** When a client arrived, when it was last seen, and who it is. */
  private record Seen(Instant first, Instant at, ClientIdentity identity) {}

  private static final Comparator<OtherClient> BY_LABEL =
      Comparator.comparing(OtherClient::label, String.CASE_INSENSITIVE_ORDER)
          .thenComparing(OtherClient::label);

  private static final Comparator<Map.Entry<String, Seen>> BY_ARRIVAL =
      Comparator.comparing((Map.Entry<String, Seen> entry) -> entry.getValue().first())
          .thenComparing(Map.Entry::getKey);

  private final Clock clock;
  private final Duration heartbeatInterval;
  private final Duration window;
  private final Map<String, Map<String, Seen>> seen = new HashMap<>();

  /**
   * The window is the heartbeat interval times the number of heartbeats that may be missed before a
   * client is considered gone (issue #284).
   */
  public InMemoryClientActivityDetector(
      Clock clock, Duration heartbeatInterval, int missedHeartbeats) {
    if (heartbeatInterval.isZero() || heartbeatInterval.isNegative()) {
      throw new IllegalArgumentException("The heartbeat interval must be longer than zero");
    }
    if (missedHeartbeats < 1) {
      throw new IllegalArgumentException("At least one missed heartbeat is needed");
    }
    this.clock = clock;
    this.heartbeatInterval = heartbeatInterval;
    this.window = heartbeatInterval.multipliedBy(missedHeartbeats);
  }

  @Override
  public Duration window() {
    return window;
  }

  @Override
  public Duration heartbeatInterval() {
    return heartbeatInterval;
  }

  /** Whether a client last seen at this time still counts as active at {@code now}. */
  private boolean active(Instant lastSeen, Instant now) {
    return lastSeen.isAfter(now.minus(window));
  }

  @Override
  public synchronized void record(String resourceKey, String clientId, ClientIdentity identity) {
    Instant now = clock.instant();
    Map<String, Seen> clients = seen.computeIfAbsent(resourceKey, key -> new HashMap<>());
    Seen before = clients.get(clientId);
    // A client that is still here keeps its arrival; one that had gone arrives afresh.
    Instant first = before != null && active(before.at(), now) ? before.first() : now;
    clients.put(clientId, new Seen(first, now, identity));
    seen.values()
        .removeIf(
            resource -> {
              resource.values().removeIf(client -> !active(client.at(), now));
              return resource.isEmpty();
            });
  }

  @Override
  public synchronized void leave(String resourceKey, String clientId) {
    Map<String, Seen> clients = seen.get(resourceKey);
    if (clients != null) {
      clients.remove(clientId);
      if (clients.isEmpty()) {
        seen.remove(resourceKey);
      }
    }
  }

  @Override
  public synchronized Arrival arrival(String resourceKey, String clientId) {
    Instant now = clock.instant();
    Map<String, Seen> clients = seen.getOrDefault(resourceKey, Map.of());
    Seen caller = clients.get(clientId);
    if (caller == null) {
      return new Arrival(false, 0);
    }
    // The newest of the clients that are here (this one included) is the one that arrived last,
    // ties going to the larger identifier, so that exactly one client is ever the newest.
    String newestId =
        clients.entrySet().stream()
            .filter(entry -> entry.getKey().equals(clientId) || active(entry.getValue().at(), now))
            .max(BY_ARRIVAL)
            .map(Map.Entry::getKey)
            .orElseThrow();
    return new Arrival(newestId.equals(clientId), caller.first().toEpochMilli());
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
                who.personKey(),
                new OtherClient(who.label(), who.personKey().equals(callerKey), who.admin()));
          }
        });
    return people.values().stream().sorted(BY_LABEL).toList();
  }

  /** How many resources currently have anyone remembered; for tests of the forgetting. */
  synchronized int resourcesRemembered() {
    return seen.size();
  }
}
