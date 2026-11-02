package edu.ucsb.cs.taapply.concurrency;

/**
 * The one HTTP header the multi-tab warning uses (issue #273), and the rule about what a client may
 * send in it.
 *
 * <p>The client names itself in a request header. Nothing comes back in headers: names are not
 * always plain ASCII and can be long, so what the server has to say, including who else is active,
 * is the JSON body of the heartbeat's answer (see {@link Presence}).
 */
public final class ConcurrencyHeaders {

  /** Request: the random identifier a tab or window made for itself when it opened. */
  public static final String CLIENT_ID = "X-Client-Id";

  /** The longest client identifier that is kept; a UUID is 36 characters. */
  public static final int MAX_CLIENT_ID_LENGTH = 100;

  private ConcurrencyHeaders() {}

  /** Whether a client identifier is worth recording: present, not blank, and not absurdly long. */
  public static boolean usable(String clientId) {
    return clientId != null && !clientId.isBlank() && clientId.length() <= MAX_CLIENT_ID_LENGTH;
  }
}
