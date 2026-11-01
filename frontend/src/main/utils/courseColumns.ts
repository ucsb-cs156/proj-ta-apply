/**
 * The columns of the Recruitment Courses table an admin may hide, and which quarters get the
 * Summer Session column (issue #185).
 */

/** A quarter in YYYYQ form is a summer quarter when its last digit is 3 (M, as in M26). */
export const isSummerQuarter = (quarter: string | null | undefined): boolean =>
  quarter != null && quarter.endsWith("3");

/** The table's key in the hidden-columns table (issue #185). */
export const COURSES_TABLE_KEY = "recruitmentCourses";

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
  { id: "allocationReleased", label: "Released to faculty" },
  { id: "unroundedAllocation", label: "Unrounded Allocation" },
  { id: "delta", label: "Delta" },
  { id: "ratio", label: "TA:student ratio" },
  { id: "status", label: "Status" },
  ...(summer ? [{ id: "summerSession", label: "Summer Session" }] : []),
  { id: "removed", label: "Remove / Unremove" },
];
