/**
 * The published assignments of a recruitment (issue #180), as GET /api/assignments returns them:
 * a header row and text rows, in one of two layouts.
 */

export type AssignmentsLayout = "course" | "student";

export type PublishedAssignmentsTable = {
  recruitmentId: number;
  type: "TA" | "ULA";
  layout: AssignmentsLayout;
  headers: string[];
  rows: string[][];
  /** Released, but applications or faculty ranking have been reopened since (issue #237). */
  tentative?: boolean;
};

/** The radio button labels, as the design words them. */
export const LAYOUT_LABELS: Record<AssignmentsLayout, string> = {
  course: "One Row per course",
  student: "One Row per TA/ULA",
};

/** Where the CSV of one layout is downloaded from. */
export const assignmentsCsvUrl = (
  recruitmentId: string | number,
  layout: AssignmentsLayout,
): string =>
  `/api/assignments/csv?recruitmentId=${recruitmentId}&layout=${layout}`;

/** The file name the browser saves the CSV under, matching the backend's. */
export const assignmentsCsvFileName = (
  recruitmentId: string | number,
  layout: AssignmentsLayout,
): string => `assignments-${recruitmentId}-${layout}.csv`;

/** The design's modal text, for the recruitment's type. */
export const publishModalText = (type: "TA" | "ULA"): string[] => [
  `Proceeding will create a new page that shows the table of Assignments, with all courses, and information about the ${type}s hired, and make this available to admins and faculty. It will also unlock the ability to download a CSV file of assignments to pass off to the financial office to start hiring paperwork.`,
  "It is still possible to update assignments after this point, but it's best to wait on this step until most assignments are finalized.",
  "Proceed?",
];

/** What the backend says when faculty ranking has not been closed (issue #237). */
export const CLOSE_RANKING_FIRST =
  "Close Faculty Ranking before releasing hiring decisions.";
/** What the backend says when applications are still open (issue #237). */
export const CLOSE_APPLICATIONS_FIRST =
  "Close Applications before releasing hiring decisions.";

/**
 * The first prerequisite of releasing hiring decisions that the recruitment itself shows is not
 * met, in the order the backend checks them, or null. Whether anyone has been assigned is not known
 * here; the backend refuses that case and the modal shows its message.
 */
export const unmetPrerequisite = (recruitment: {
  applicationStatus: "OPEN" | "CLOSED";
  reviewStatus: "NotStarted" | "Open" | "Closed";
}): string | null => {
  if (recruitment.reviewStatus !== "Closed") {
    return CLOSE_RANKING_FIRST;
  }
  return recruitment.applicationStatus === "OPEN"
    ? CLOSE_APPLICATIONS_FIRST
    : null;
};
