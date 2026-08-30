package edu.ucsb.cs.taapply.errors;

/**
 * Thrown when a request is refused for a reason the client can fix (e.g. a missing PAT or a repo
 * the stored PAT cannot reach). Mapped to a 403 response carrying the message, so the frontend can
 * show it to the user.
 */
public class ForbiddenException extends RuntimeException {
  public ForbiddenException(String message) {
    super(message);
  }
}
