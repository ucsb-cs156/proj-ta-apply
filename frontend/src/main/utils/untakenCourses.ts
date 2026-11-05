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

/** The legend directly beneath each flagged course row. */
export const UNTAKEN_EXPLANATION =
  "Have you taken this course? If so, add it to the courses taken section. If not, please explain your background for serving as a ULA for this course in the comments section at the bottom of the application.";

/** "A", "A and B", "A, B and C". */
function joinNames(names: string[]): string {
  const last = names[names.length - 1];
  return names.length < 2
    ? last
    : `${names.slice(0, -1).join(", ")} and ${last}`;
}

/** The red reminder beside the comments box, naming every flagged course. */
export function untakenCommentsReminder(courseIds: string[]): string {
  // Course ids pad the department to a fixed width ("CMPSC   156"); show a single space.
  const courses = courseIds.map((id) => id.replace(/\s+/g, " "));
  const many = courses.length > 1;
  return `You have listed ${joinNames(courses)} as ${many ? "courses" : "a course"} you are interested in serving as a ULA for. Please explain in the comments section what your preparation is for serving as a ULA for ${many ? "these courses" : "this course"}.`;
}
