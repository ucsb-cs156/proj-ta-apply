/**
 * The columns of the Combined Allocation table (issue #358) that an admin may hide, which of them
 * start hidden, and where the choice is remembered. The choices follow the Recruitment Courses
 * table's (courseColumns.ts), with one set of allocation columns per type.
 */
import type { ColumnChoice } from "main/components/Common/ColumnVisibilityControl";

/** Where a quarter's hidden columns are remembered, in the browser's local storage. */
export const combinedColumnsStorageKey = (
  quarter: string | undefined,
): string => `combinedAllocations.hiddenColumns.${quarter}`;

type Type = "TA" | "ULA";

/** The ids of one type's columns: its rankings, Allocation, Unrounded Allocation, Delta, ratio. */
export const typeColumnId = (
  type: Type,
  column:
    "rankingCount" | "allocation" | "unroundedAllocation" | "delta" | "ratio",
): string =>
  `${type.toLowerCase()}${column[0].toUpperCase()}${column.slice(1)}`;

/**
 * Every column that may be hidden, with the label of the Columns menu, in table order. The course
 * number is not listed: it is always shown. A column of a type (its name starts with TA or ULA)
 * exists only when the quarter has that recruitment, and its rankings column only once that
 * recruitment's faculty review has started, as on the Recruitment Courses page.
 */
export const combinedColumnChoices = (
  ta: { exists: boolean; showRankings: boolean },
  ula: { exists: boolean; showRankings: boolean },
): ColumnChoice[] => {
  const typeChoices = (type: Type): ColumnChoice[] => [
    { id: typeColumnId(type, "allocation"), label: `${type} Allocation` },
    {
      id: typeColumnId(type, "unroundedAllocation"),
      label: `${type} Unrounded Allocation`,
    },
    { id: typeColumnId(type, "delta"), label: `${type} Delta` },
    { id: typeColumnId(type, "ratio"), label: `${type}:student ratio` },
  ];
  return [
    ...(ta.exists && ta.showRankings
      ? [{ id: typeColumnId("TA", "rankingCount"), label: "TA Rankings" }]
      : []),
    ...(ula.exists && ula.showRankings
      ? [{ id: typeColumnId("ULA", "rankingCount"), label: "ULA Rankings" }]
      : []),
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
    ...(ta.exists ? typeChoices("TA") : []),
    ...(ula.exists ? typeChoices("ULA") : []),
    ...(ta.exists && ula.exists
      ? [{ id: "aseRatio", label: "ASE:Student Ratio" }]
      : []),
    { id: "status", label: "Status" },
  ];
};

/**
 * The columns that start visible, besides Course Number: the same as on the Recruitment Courses
 * page (courseColumns.ts), and the ASE:Student Ratio, which is what this page is for. Every other
 * column starts hidden, and the Columns menu brings it back.
 */
export const COMBINED_DEFAULT_VISIBLE_COLUMNS: readonly string[] = [
  "instructor",
  "enrollment",
  "maxEnroll",
  "enrollmentEstimate",
  ...(["TA", "ULA"] as const).flatMap((type) => [
    typeColumnId(type, "allocation"),
    typeColumnId(type, "unroundedAllocation"),
    typeColumnId(type, "delta"),
    typeColumnId(type, "ratio"),
  ]),
  "aseRatio",
];

/**
 * The ids hidden until the user chooses otherwise: every column that may be hidden, for either
 * type and with rankings, except the default-visible ones. Computed over the full set so that a
 * quarter that gains a recruitment or opens its rankings still starts with those columns hidden.
 */
export const defaultHiddenCombinedColumns = (): string[] =>
  combinedColumnChoices(
    { exists: true, showRankings: true },
    { exists: true, showRankings: true },
  )
    .map((choice) => choice.id)
    .filter((id) => !COMBINED_DEFAULT_VISIBLE_COLUMNS.includes(id));
