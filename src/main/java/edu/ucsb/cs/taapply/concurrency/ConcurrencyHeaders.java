package edu.ucsb.cs.taapply.concurrency;

/**
 * The names of the HTTP headers the multi-tab warning uses (issue #273), and the one rule about
 * what a client may send.
 *
 * <p>The client names itself in a request header, and the server answers in two response headers,
 * so that the answer can ride on any response (a save, a refused save, a heartbeat) without
 * changing the shape of its body.
 */
public final class ConcurrencyHeaders {

  /** Request: the random identifier a tab or window made for itself when it opened. */
  public static final String CLIENT_ID = "X-Client-Id";

  /** Response: {@code true} if some other client was seen on the same resource recently. */
  public static final String OTHER_CLIENTS_ACTIVE = "X-Other-Clients-Active";

  /** Response: how often, in seconds, the client should send a heartbeat. */
  public static final String HEARTBEAT_SECONDS = "X-Heartbeat-Seconds";

  /** The longest client identifier that is kept; a UUID is 36 characters. */
  public static final int MAX_CLIENT_ID_LENGTH = 100;

  private ConcurrencyHeaders() {}

  /** Whether a client identifier is worth recording: present, not blank, and not absurdly long. */
  public static boolean usable(String clientId) {
    return clientId != null && !clientId.isBlank() && clientId.length() <= MAX_CLIENT_ID_LENGTH;
  }
}
