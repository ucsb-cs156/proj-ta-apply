import type { ColumnChoice } from "main/components/Common/ColumnVisibilityControl";
import {
  WIDE_COLUMN_MIN_WIDTH,
  compactCourseNumber,
} from "main/utils/columnWidths";

/**
 * One instructor's feedback on one course, as /api/admin/instructorFeedback returns it (issue
 * #427). The allocations are null when the quarter has no recruitment of that type or the course
 * is not in it; the preferred counts are null unless their box is checked (the server drops a
 * count kept behind an unchecked box).
 */
export type InstructorFeedbackRow = {
  id: number;
  quarter: string;
  courseId: string;
  section: string | null;
  title: string | null;
  email: string;
  instructorName: string | null;
  allocReasonable: boolean;
  differentTACount: boolean;
  differentULACount: boolean;
  otherConcerns: boolean;
  taAllocation: number | null;
  ulaAllocation: number | null;
  numTAsPreferred: number | null;
  numULAsPreferred: number | null;
  comments: string | null;
  lastUpdated: string | null;
};

/** What an allocation cell says when the quarter or the course has no recruitment of that type. */
export const NOT_APPLICABLE = "N/A";

/**
 * Every column but Course Name, which cannot be hidden, in table order: the Columns menu's
 * choices and the "hide" links. The issue's order, with Last Updated added after Comments.
 */
export const FEEDBACK_COLUMN_CHOICES: ColumnChoice[] = [
  { id: "instructor", label: "Instructor" },
  { id: "allocReasonable", label: "Alloc Reasonable" },
  { id: "differentTACount", label: "Diff TA Count" },
  { id: "taAllocation", label: "TA Allocation" },
  { id: "numTAsPreferred", label: "Preferred TA Allocation" },
  { id: "differentULACount", label: "Diff ULA Count" },
  { id: "ulaAllocation", label: "ULA Allocation" },
  { id: "otherConcerns", label: "Other Concerns" },
  { id: "numULAsPreferred", label: "Preferred ULA Allocation" },
  { id: "comments", label: "Comments" },
  { id: "lastUpdated", label: "Last Updated" },
];

/** Where the hidden columns are remembered, in this browser; the same for every quarter. */
export const FEEDBACK_COLUMNS_STORAGE_KEY = "instructorFeedback.hiddenColumns";

/** The narrowest the Comments column may be, in pixels. */
export const COMMENTS_MIN_WIDTH = WIDE_COLUMN_MIN_WIDTH;

/** The Comments column's starting width: 80% of the window, and never under the minimum. */
export const commentsDefaultWidth = (windowWidth: number): number =>
  Math.max(COMMENTS_MIN_WIDTH, 0.8 * windowWidth);

/** A checkbox's answer as words, the accessible name of its mark. */
export const yesNo = (value: boolean): string => (value ? "Yes" : "No");

/** The read-only mark of a checked box (U+2612), as the maintainer asked on issue #427. */
export const CHECKED_MARK = "\u2612";

/** The read-only mark of an unchecked box (U+2610). */
export const UNCHECKED_MARK = "\u2610";

/** The mark a true-or-false column shows. */
export const checkboxMark = (value: boolean): string =>
  value ? CHECKED_MARK : UNCHECKED_MARK;

/** The course as the Combined Allocation page writes it, then its section in parentheses. */
export const courseName = (
  row: Pick<InstructorFeedbackRow, "courseId" | "section">,
): string =>
  row.section
    ? `${compactCourseNumber(row.courseId)} (${row.section})`
    : compactCourseNumber(row.courseId);

/** The instructor's catalog name and email, or the email alone when the name is not known. */
export const instructorText = (row: InstructorFeedbackRow): string =>
  row.instructorName ? `${row.instructorName} ${row.email}` : row.email;

/**
 * One instructor of a course who has not checked any box of the feedback form, as
 * /api/admin/instructorFeedback/missing returns it (issue #427). The email is null when the
 * Instructors list has no email for the course's catalog name.
 */
export type MissingFeedbackRow = {
  courseId: string;
  section: string | null;
  title: string | null;
  instructorName: string;
  email: string | null;
};

/** What the Email cell says for an instructor the Instructors list has no email for. */
export const NO_EMAIL_ON_FILE = "no email on file";

/**
 * The emails the "Copy emails of instructors that have not provided feedback" button copies: each
 * one once, in the table's order, leaving out the instructors with no email on file.
 */
export const missingFeedbackEmails = (rows: MissingFeedbackRow[]): string[] => [
  ...new Set(
    rows
      .map((row) => row.email)
      .filter((email): email is string => email !== null),
  ),
];

/** The toast after the button has copied them. */
export const emailsCopiedText = (count: number): string =>
  count === 1
    ? "1 email copied to clipboard."
    : `${count} emails copied to clipboard.`;

/** The heading of the second table, as the maintainer worded it (issue #427). */
export const MISSING_HEADING = "No Feedback Yet From These Instructors";

/** The copy-all button's label, as the maintainer worded it. */
export const COPY_MISSING_LABEL =
  "Copy emails of instructors that have not provided feedback";
