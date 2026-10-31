package edu.ucsb.cs.taapply.errors;

/**
 * An outside service the request depended on, such as the UCSB API, failed or answered badly.
 * Mapped to 502 Bad Gateway: the fault is neither the caller's nor this app's.
 */
public class UpstreamApiException extends RuntimeException {
  public UpstreamApiException(String message, Throwable cause) {
    super(message, cause);
  }
}
