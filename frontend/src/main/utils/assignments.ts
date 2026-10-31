import { collapseCourseId } from "main/utils/bulkCourses";

/** One lecture of the recruitment as the admin Assignments page lists it (issue #179). */
export type AssignmentCourse = {
  id: number;
  courseId: string;
  section: string | null;
  enrollCode: string | null;
  allocation: number;
  assigned: number;
  left: number;
  /** No longer offered (removed, stale or cancelled) but kept for its rankings or assignee. */
  historical: boolean;
};

/** One real, uncancelled applicant: identity text by header, the pencilled-in lecture, ranks. */
export type AssignmentRow = {
  applicationId: number;
  identity: Record<string, string>;
  tentativeAssignment: number | null;
  /** Each lecture's rank for this applicant, keyed by recruitment course id; absent if unranked. */
  rankings: Record<string, number | null>;
};

/** The payload of GET /api/admin/assignments. */
export type Assignments = {
  recruitmentId: number;
  type: "TA" | "ULA";
  identityHeaders: string[];
  courses: AssignmentCourse[];
  rows: AssignmentRow[];
};

/** The column headings for the rankings CSV's identity fields. */
export const IDENTITY_LABELS: Record<string, string> = {
  firstName: "First Name",
  lastName: "Last Name",
  email: "Email",
  major: "Major",
  classLevel: "Class Level",
  yearInProgram: "Year in Program",
  graduationDate: "Graduation Date",
  gpaMajor: "GPA (Major)",
  gpaOverall: "GPA (Overall)",
  previousServiceAsUla: "Previous ULA Quarters",
};

/** A heading for an identity field; a field with no label of its own is shown by its name. */
export const identityLabel = (header: string): string =>
  IDENTITY_LABELS[header] ?? header;

/** "CMPSC 156 (0100)": how the dropdown and the column headings name a lecture. */
export const courseLabel = (course: {
  courseId: string;
  section: string | null;
}): string => `${collapseCourseId(course.courseId)} (${course.section ?? ""})`;

/** The dropdown's text for a lecture, flagging one that is no longer offered. */
export const courseOptionLabel = (course: AssignmentCourse): string =>
  course.historical
    ? `${courseLabel(course)} - no longer offered`
    : courseLabel(course);

/** The lecture a row is pencilled into, or null when there is none or it is no longer listed. */
export const assignedCourse = (
  row: AssignmentRow,
  courses: AssignmentCourse[],
): AssignmentCourse | null =>
  courses.find((course) => course.id === row.tentativeAssignment) ?? null;

/** A lecture's rank for a row, or undefined when it has not ranked them (sorted last). */
export const rankFor = (
  row: AssignmentRow,
  course: AssignmentCourse,
): number | undefined => row.rankings[String(course.id)] ?? undefined;
