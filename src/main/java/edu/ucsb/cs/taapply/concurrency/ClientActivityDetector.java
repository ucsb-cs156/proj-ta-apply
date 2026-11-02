package edu.ucsb.cs.taapply.concurrency;

import java.time.Duration;
import java.util.Map;

/**
 * Notices when more than one client (a tab, a window, a device) is working on the same thing at
 * once (issue #273).
 *
 * <p>Every request that touches the thing says who sent it, by a random identifier the client made
 * for itself. The detector remembers which identifiers it saw on each <b>resource key</b> (any
 * string, such as {@code "draft:42"}) within the <b>window</b>, and answers whether anyone other
 * than the caller was among them. It is advice, not a lock.
 *
 * <p>This package depends on nothing else in the application, so that it could be lifted out as a
 * library of its own. The implementation here keeps its state in memory; see {@link
 * InMemoryClientActivityDetector} for what that means for more than one server.
 */
public interface ClientActivityDetector {

  /** Notes that this client has just been seen on the resource. */
  void record(String resourceKey, String clientId);

  /** Whether any client other than this one has been seen on the resource within the window. */
  boolean othersActive(String resourceKey, String clientId);

  /** How long a client counts as active after it was last seen. */
  Duration window();

  /**
   * How often a client should send a heartbeat: three a window, so that one lost one is harmless.
   */
  default long suggestedHeartbeatSeconds() {
    return Math.max(1, window().toSeconds() / 3);
  }

  /**
   * What to put on a response: records the client, then returns the response headers that tell it
   * whether others are active and how often to send a heartbeat. Returns no headers for a request
   * that did not name itself, or named itself unusably.
   */
  default Map<String, String> observe(String resourceKey, String clientId) {
    if (!ConcurrencyHeaders.usable(clientId)) {
      return Map.of();
    }
    record(resourceKey, clientId);
    return Map.of(
        ConcurrencyHeaders.OTHER_CLIENTS_ACTIVE,
        String.valueOf(othersActive(resourceKey, clientId)),
        ConcurrencyHeaders.HEARTBEAT_SECONDS,
        String.valueOf(suggestedHeartbeatSeconds()));
  }
}
