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

/** A checkbox as the admin's tables show a yes-or-no answer (as on the application tables). */
export const yesNo = (value: boolean): string => (value ? "Yes" : "No");

/** The course as the Combined Allocation page writes it, then its section in parentheses. */
export const courseName = (row: InstructorFeedbackRow): string =>
  row.section
    ? `${compactCourseNumber(row.courseId)} (${row.section})`
    : compactCourseNumber(row.courseId);

/** The instructor's catalog name and email, or the email alone when the name is not known. */
export const instructorText = (row: InstructorFeedbackRow): string =>
  row.instructorName ? `${row.instructorName} ${row.email}` : row.email;
