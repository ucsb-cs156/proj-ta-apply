package edu.ucsb.cs.taapply.concurrency;

/**
 * When a client arrived on a resource, as against the others active there (issue #284).
 *
 * <p>{@code newest} is true if every other active client arrived before this one, which is how the
 * application decides which tab is asked to step aside. Arrival is the time the client was first
 * seen in its present stay: a client that went away (said goodbye, or was quiet for longer than the
 * window) and came back arrives afresh. Clients that arrive at the same instant are put in order by
 * their identifiers, so there is always exactly one newest client and never a tie. That is what
 * keeps two tabs from both being asked to wait for the other.
 *
 * <p>{@code arrivedAtMillis} is that time in milliseconds since the epoch, so that a client can
 * tell when it has arrived afresh; it is 0 for a client that was never recorded.
 */
public record Arrival(boolean newest, long arrivedAtMillis) {}
