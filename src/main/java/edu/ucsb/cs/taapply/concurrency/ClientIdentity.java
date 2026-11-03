package edu.ucsb.cs.taapply.concurrency;

/**
 * Who a client is, as the application tells the detector (issue #273): an opaque, stable key for
 * the person, and the label to show other people.
 *
 * <p>The detector never looks inside either. It treats two clients with the same {@link #personKey}
 * as the same person, and hands {@link #label} back as it is. The application decides what they
 * are; for the people of this application the key is the email address and the label is the email
 * address followed by the full name in parentheses, or the email address alone if there is no name.
 *
 * <p>{@link #admin} says whether the person is an admin (issue #302). The detector does not act on
 * it; it hands it back with the label, for the client to choose its message by.
 *
 * <p>A label that is blank becomes the key. A label longer than {@value #MAX_LABEL_LENGTH}
 * characters is cut short with an ellipsis, so that no one's name can swell a response.
 */
public record ClientIdentity(String personKey, String label, boolean admin) {

  /** The longest label that is kept, in characters (code points, so no character is split). */
  public static final int MAX_LABEL_LENGTH = 200;

  /** Someone who is not an admin. */
  public ClientIdentity(String personKey, String label) {
    this(personKey, label, false);
  }

  public ClientIdentity {
    if (personKey == null || personKey.isBlank()) {
      throw new IllegalArgumentException("A person key is required");
    }
    if (label == null || label.isBlank()) {
      label = personKey;
    } else if (label.codePointCount(0, label.length()) > MAX_LABEL_LENGTH) {
      label = label.substring(0, label.offsetByCodePoints(0, MAX_LABEL_LENGTH - 1)) + "…";
    }
  }
}
