import type { PriorCourse } from "main/utils/priorCoursework";

/**
 * Issue #148, ULA form only: a course the applicant asks for (first or second choice, Enthusiastic,
 * or Would Consider) without listing it among the courses they have taken gets a warning, and the
 * table ends with an explanation of what to do about it.
 */

/** "CMPSC   156", "cmpsc 156" and "CMPSC156" name the same course. */
export const courseKey = (course: string): string =>
  course.toUpperCase().replace(/\s+/g, "");

/** Whether the applicant lists this course, at UCSB or elsewhere, among those they have taken. */
export const hasTaken = (taken: PriorCourse[], courseId: string): boolean =>
  taken.some(
    (course) => courseKey(course.courseNumber) === courseKey(courseId),
  );

/** The answers that ask for a course: a choice, or an interest above Not Interested. */
export const asksFor = (rank: string | null, interest: string): boolean =>
  rank !== null || interest === "ENTHUSIASTIC" || interest === "WOULD_CONSIDER";

/** The listed courses the applicant asks for but has not listed as taken, in list order. */
export function untakenAskedFor(
  courses: string[],
  taken: PriorCourse[],
  rankOf: (courseId: string) => string | null,
  interestIn: (courseId: string) => string,
): string[] {
  return courses.filter(
    (courseId) =>
      asksFor(rankOf(courseId), interestIn(courseId)) &&
      !hasTaken(taken, courseId),
  );
}

/** The hover text on the warning icon. */
export const UNTAKEN_TITLE = "Not listed as a course you have taken";

/** The explanation under the table, after the icon. */
export const UNTAKEN_EXPLANATION =
  "signifies that this is a course you have not listed as one you have taken. Be sure that in the comments field at the bottom of the application, you explain what background you have that prepares you to be a ULA for this course.";

export const UNTAKEN_EXAMPLE =
  "For example, CS students don't typically take CMPSC 5A or 5B, but if they have Python programming background, and some statistics background (e.g. PSTAT 5 or PSTAT 120A), that's typically enough preparation to be a ULA for CMPSC 5A/5B.";
