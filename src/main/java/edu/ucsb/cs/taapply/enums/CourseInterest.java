package edu.ucsb.cs.taapply.enums;

/**
 * How interested an applicant is in a course other than their first or second choice.
 *
 * <p>{@code NOT_INTERESTED} is the default answer for every course and is never stored: an
 * application's course interest map holds only the courses the applicant said something about.
 */
public enum CourseInterest {
  ENTHUSIASTIC,
  WOULD_CONSIDER,
  NOT_INTERESTED
}
