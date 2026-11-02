package edu.ucsb.cs.taapply.concurrency;

/**
 * One other person who is active on the same resource (issue #273): the label to show, and whether
 * they are the same person as the one asking, which means another tab, window or device of their
 * own.
 *
 * <p>There is one of these for each <em>person</em>, however many tabs they have open.
 */
public record OtherClient(String label, boolean samePerson) {}
