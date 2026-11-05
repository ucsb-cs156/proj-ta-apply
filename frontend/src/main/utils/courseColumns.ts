/**
 * The columns of the Recruitment Courses table an admin may hide, and which quarters get the
 * Summer Session column (issue #185).
 */

/** A quarter in YYYYQ form is a summer quarter when its last digit is 3 (M, as in M26). */
export const isSummerQuarter = (quarter: string | null | undefined): boolean =>
  quarter != null && quarter.endsWith("3");

/** Where a recruitment's hidden course columns are remembered, in the browser's local storage. */
export const courseColumnsStorageKey = (
  recruitmentId: string | undefined,
): string => `recruitmentCourses.hiddenColumns.${recruitmentId}`;

/**
 * The columns that hold the planning figures (issue #300): Enrollment Estimate, Allocation,
 * Unrounded Allocation, Delta and TA:student ratio, by column id. Admins always see them; an
 * instructor's table has them only while the admin shows all courses' allocations to all faculty,
 * and otherwise does not have them at all, so they are not even offered in the Columns menu.
 */
export const AllocationsRelatedColumns: readonly string[] = [
  "enrollmentEstimate",
  "allocation",
  "unroundedAllocation",
  "delta",
  "ratio",
];

/**
 * The columns an instructor never gets, whatever the allocation visibility: the admin's email
 * mapping, with its link to the Instructors admin page, and the admin's Remove button.
 */
export const AdminOnlyColumns: readonly string[] = [
  "rankingCount",
  "instructorEmail",
  "removed",
];

/**
 * The columns that start visible (issue #300), besides Course Number, which cannot be hidden. Every
 * other column starts hidden, and the Columns menu brings it back.
 */
export const DEFAULT_VISIBLE_COLUMNS: readonly string[] = [
  "instructor",
  "enrollment",
  "maxEnroll",
  "enrollmentEstimate",
  "allocation",
  "unroundedAllocation",
  "delta",
  "ratio",
];

/**
 * The ids hidden until the user chooses otherwise: every column that may be hidden, in any
 * recruitment, except the default-visible ones. Computed over the full set (Rankings and Summer
 * Session included) so that a recruitment that gains one of them still starts with it hidden.
 */
export const defaultHiddenColumns = (): string[] =>
  columnChoices(true, true)
    .map((choice) => choice.id)
    .filter((id) => !DEFAULT_VISIBLE_COLUMNS.includes(id));

/**
 * Every column an admin may hide, by column id, with the label the Columns menu shows (issue
 * #185). The course number can never be hidden, so it is not listed. The Rankings column exists
 * only once faculty reviews have started, and Summer Session only for a summer quarter.
 */
export const columnChoices = (
  showRankings: boolean,
  summer: boolean,
): { id: string; label: string }[] => [
  ...(showRankings ? [{ id: "rankingCount", label: "Rankings" }] : []),
  { id: "section", label: "Section" },
  { id: "title", label: "Title" },
  { id: "instructor", label: "Instructor" },
  { id: "instructorEmail", label: "Email" },
  { id: "days", label: "Days" },
  { id: "time", label: "Time" },
  { id: "room", label: "Room" },
  { id: "enrollment", label: "Enrolled" },
  { id: "maxEnroll", label: "Max" },
  { id: "enrollmentEstimate", label: "Enrollment Estimate" },
  { id: "allocation", label: "Allocation" },
  { id: "unroundedAllocation", label: "Unrounded Allocation" },
  { id: "delta", label: "Delta" },
  { id: "ratio", label: "TA:student ratio" },
  { id: "status", label: "Status" },
  ...(summer ? [{ id: "summerSession", label: "Summer Session" }] : []),
  { id: "removed", label: "Remove / Unremove" },
];

/**
 * What an instructor may hide on the Courses page (issue #300): {@link columnChoices} without the
 * {@link AdminOnlyColumns} and, unless the admin shows all courses' allocations to all faculty,
 * without the {@link AllocationsRelatedColumns}.
 */
export const instructorColumnChoices = (
  summer: boolean,
  allocationsShown: boolean,
): { id: string; label: string }[] =>
  // Stryker disable next-line BooleanLiteral : Rankings is one of the AdminOnlyColumns, filtered out below
  columnChoices(false, summer).filter(
    (choice) =>
      !AdminOnlyColumns.includes(choice.id) &&
      (allocationsShown || !AllocationsRelatedColumns.includes(choice.id)),
  );
