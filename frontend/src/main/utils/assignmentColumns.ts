import {
  courseLabel,
  identityLabel,
  type Assignments,
} from "main/utils/assignments";

/** The Assignments table's key in the hidden-columns table (issue #314). */
export const ASSIGNMENTS_TABLE_KEY = "recruitmentAssignments";

/** The id of the Tentative Assignment column, which can never be hidden. */
export const TENTATIVE_COLUMN_ID = "tentativeAssignment";

/** The id of a lecture's column. */
export const courseColumnId = (courseId: number): string =>
  `course-${courseId}`;

/**
 * Every column an admin may hide on the Assignments page, in table order, with the label the
 * Columns menu shows (issue #314): each of the applicant's identity columns and each lecture. The
 * Tentative Assignment column is the point of the page, so it is not listed.
 */
export const assignmentColumnChoices = (
  data: Pick<Assignments, "identityHeaders" | "courses">,
): { id: string; label: string }[] => [
  ...data.identityHeaders.map((header) => ({
    id: header,
    label: identityLabel(header),
  })),
  ...data.courses.map((course) => ({
    id: courseColumnId(course.id),
    label: courseLabel(course),
  })),
];

/**
 * The lecture columns, each with whether its lecture is complete: as many applicants pencilled in
 * (the page's "Assigned", the tentative assignments) as its allocation, the hiring target the page
 * shows as "Allocation". Over the target counts as complete too (issue #343).
 */
export const courseColumnStatus = (
  data: Pick<Assignments, "courses">,
): { id: string; complete: boolean }[] =>
  data.courses.map((course) => ({
    id: courseColumnId(course.id),
    complete: course.assigned >= course.allocation,
  }));

/**
 * The Tentative Assignment column's order (issue #348), on the text its cells show: a blank (no
 * tentative assignment) before every assignment, and the assignments in natural order, so
 * "CMPSC 8" comes before "CMPSC 16". Ascending therefore leaves the blank rows at the top and the
 * assigned rows at the bottom; TanStack inverts this for descending, which puts the assigned rows
 * at the top. Rows that tie keep the order they came in.
 */
export const compareTentativeAssignments = (a: string, b: string): number =>
  a.localeCompare(b, "en", { numeric: true });
