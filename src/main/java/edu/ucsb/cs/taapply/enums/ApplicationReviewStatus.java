package edu.ucsb.cs.taapply.enums;

/**
 * Where an application stands. Reviewing and hiring move it from {@code PENDING} to {@code HIRED}
 * or {@code NOT_HIRED}; the applicant themself may move it to {@code CANCELLED} (issue #107), which
 * is final.
 */
public enum ApplicationReviewStatus {
  PENDING,
  HIRED,
  NOT_HIRED,
  CANCELLED
}
