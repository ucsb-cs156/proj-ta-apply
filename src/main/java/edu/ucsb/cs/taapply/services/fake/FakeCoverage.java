package edu.ucsb.cs.taapply.services.fake;

/**
 * How widely fake applicants' interest is spread over a recruitment's courses (issue #219).
 *
 * <ul>
 *   <li>{@code ALL}: every course is some applicant's first choice and some applicant's second
 *       choice, and every applicant answers for every course, so each course has candidates.
 *   <li>{@code SPARSE}: interest is confined to a random few of the courses, so the others have no
 *       interested candidates at all. Useful for seeing how the review pages show an uncovered
 *       course.
 * </ul>
 */
public enum FakeCoverage {
  ALL,
  SPARSE
}
