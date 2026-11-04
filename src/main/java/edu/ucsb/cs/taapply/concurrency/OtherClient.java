package edu.ucsb.cs.taapply.concurrency;

/**
 * One other person who is active on the same resource (issue #273): the label to show, whether they
 * are the same person as the one asking, which means another tab, window or device of their own,
 * and whether they are an admin (issue #302), so that the client can choose its message.
 *
 * <p>There is one of these for each <em>person</em>, however many tabs they have open.
 */
public record OtherClient(String label, boolean samePerson, boolean admin) {

  /** Someone who is not an admin. */
  public OtherClient(String label, boolean samePerson) {
    this(label, samePerson, false);
  }
}
