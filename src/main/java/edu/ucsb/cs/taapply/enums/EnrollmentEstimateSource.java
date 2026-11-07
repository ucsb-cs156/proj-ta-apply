package edu.ucsb.cs.taapply.enums;

/**
 * Which UCSB API figure to copy into every course's enrollment estimate (issue #175). Also recorded
 * on the quarter's {@code budget_courses} row (issue #363) as where its estimate came from; an
 * estimate the admin typed has no source.
 */
public enum EnrollmentEstimateSource {
  /** The section's maximum enrollment. */
  MAX,
  /** The section's current enrollment. */
  ACTUAL
}
