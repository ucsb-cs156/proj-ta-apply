package edu.ucsb.cs.taapply.concurrency;

import java.time.Duration;
import java.util.List;

/**
 * Notices when more than one client (a tab, a window, a device) is working on the same thing at
 * once, and who they are (issue #273).
 *
 * <p>Every request that touches the thing says which client sent it, by a random identifier the
 * client made for itself, and the application says who that client is, as a {@link ClientIdentity}.
 * The detector remembers which clients it saw on each <b>resource key</b> (any string, such as
 * {@code "draft:42"}) within the <b>window</b>, and answers who, other than the caller, was among
 * them. It is advice, not a lock.
 *
 * <p><b>Authorization is the caller's job.</b> The detector answers anyone who asks, and tells them
 * names. The application must check that the caller may use the resource <em>before</em> it records
 * the caller or asks who else is there, or the answer would let anyone probe resource keys to learn
 * who is working where.
 *
 * <p>This package depends on nothing else in the application, so that it could be lifted out as a
 * library of its own. The implementation here keeps its state in memory; see {@link
 * InMemoryClientActivityDetector} for what that means for more than one server.
 */
public interface ClientActivityDetector {

  /** Notes that this client, who is this person, has just been seen on the resource. */
  void record(String resourceKey, String clientId, ClientIdentity identity);

  /**
   * The other people active on the resource within the window, one for each person, in order of
   * label. A person is marked {@link OtherClient#samePerson()} if they are the same person as the
   * caller, which means the caller has another tab or window open. The caller's own client is never
   * among them. A caller who has not been recorded is nobody's same person.
   */
  List<OtherClient> othersActive(String resourceKey, String clientId);

  /** How long a client counts as active after it was last seen. */
  Duration window();

  /**
   * How often a client should send a heartbeat: three a window, so that one lost one is harmless.
   */
  default long suggestedHeartbeatSeconds() {
    return Math.max(1, window().toSeconds() / 3);
  }

  /**
   * Records the client if it named itself usably (see {@link ConcurrencyHeaders#usable}); does
   * nothing otherwise. For requests that are not heartbeats, such as saves.
   */
  default void note(String resourceKey, String clientId, ClientIdentity identity) {
    if (ConcurrencyHeaders.usable(clientId)) {
      record(resourceKey, clientId, identity);
    }
  }

  /**
   * The answer to a heartbeat: records the client, then says who else is active and how often to
   * beat. A client that did not name itself usably is not recorded and is told of no one.
   */
  default Presence heartbeat(String resourceKey, String clientId, ClientIdentity identity) {
    if (!ConcurrencyHeaders.usable(clientId)) {
      return new Presence(List.of(), suggestedHeartbeatSeconds());
    }
    record(resourceKey, clientId, identity);
    return new Presence(othersActive(resourceKey, clientId), suggestedHeartbeatSeconds());
  }
}
