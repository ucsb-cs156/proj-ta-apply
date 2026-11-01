package edu.ucsb.cs.taapply.enums;

/**
 * Who may see a recruitment's TA/ULA allocations (issue #224). One setting per recruitment, chosen
 * by an admin; faculty see the result, so changes are recorded in the recruitment audit trail.
 */
public enum AllocationVisibility {
  /** No faculty member sees any allocation; only admins do. The default. */
  ADMINS_ONLY,
  /** Each faculty member sees the allocations for the courses they teach. */
  OWN_COURSES,
  /** Every faculty member teaching in the recruitment sees the allocations of all its courses. */
  ALL_COURSES
}
