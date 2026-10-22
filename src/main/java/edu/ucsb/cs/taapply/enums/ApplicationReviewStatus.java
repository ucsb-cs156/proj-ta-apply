package edu.ucsb.cs.taapply.enums;

/**
 * Where an application stands. Everything is {@code PENDING} in iteration 4: reviewing and hiring
 * are a later increment, and nothing yet moves an application off this value.
 */
public enum ApplicationReviewStatus {
  PENDING,
  HIRED,
  NOT_HIRED
}
