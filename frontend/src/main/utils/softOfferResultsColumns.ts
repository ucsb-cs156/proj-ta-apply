/**
 * The columns of the two tables on the Soft Offer Results page (issue #494): which may be hidden,
 * where the choice is kept, and how wide Comments may be. The backend sends the headings and the
 * rows as lists of text in a fixed order (SoftOffersService.RESULTS_HEADERS and
 * UNASSIGNED_HEADERS); the ids here name the columns in that order, for the Columns menu, the
 * "hide" links and the test ids.
 *
 * The main table also has nine columns the backend does not send as text (issues #509 and #512):
 * the staff's hiring-tracking fields, read from the results' hiring records and edited in place.
 * Their headings are the frontend's own, and sit among the text columns where the CSV puts them:
 * Funding after Course assignment, the eight staff columns after Comments.
 */
import type { ColumnChoice } from "main/components/Common/ColumnVisibilityControl";
import { WIDE_COLUMN_MIN_WIDTH } from "main/utils/columnWidths";
import type {
  HiringField,
  HiringRecord,
  NewHireForm,
} from "main/utils/softOffers";

/** The keys of a hiring record that hold a stamp. */
export type HiringStampKey = Extract<keyof HiringRecord, `${string}At`>;

type HiringColumnBase = {
  id: string;
  /** The column's heading, the base name of the CSV's heading (SoftOffersService.STAFF_HEADERS). */
  heading: string;
  /** The field PUT /hiring saves it as. */
  field: HiringField;
};

/**
 * One of the hiring columns: a stamped checkbox, the stamped New Hire form dropdown, the Staff
 * Comments text box, or the Funding dropdown, each naming the record's key(s) it reads.
 */
export type HiringColumn =
  | (HiringColumnBase & { kind: "checkbox"; stampKey: HiringStampKey })
  | (HiringColumnBase & {
      kind: "select";
      stampKey: HiringStampKey;
      valueKey: "newHireForm";
    })
  | (HiringColumnBase & { kind: "text"; valueKey: "staffComments" })
  | (HiringColumnBase & { kind: "funding"; valueKey: "fundingSource" });

/** Funding (issue #512): a dropdown of the Funding Sources' abbreviations, after Course assignment. */
export const FUNDING_COLUMN: HiringColumn = {
  id: "funding",
  heading: "Funding",
  kind: "funding",
  field: "FUNDING_SOURCE",
  valueKey: "fundingSource",
};

/** The eight staff columns (issue #509), after Comments, in the CSV's order. */
export const STAFF_COLUMNS: readonly HiringColumn[] = [
  {
    id: "formalOfferSent",
    heading: "Formal Offer Sent",
    kind: "checkbox",
    field: "FORMAL_OFFER_SENT",
    stampKey: "formalOfferSentAt",
  },
  {
    id: "formalOfferAccepted",
    heading: "Formal Offer Accepted",
    kind: "checkbox",
    field: "FORMAL_OFFER_ACCEPTED",
    stampKey: "formalOfferAcceptedAt",
  },
  {
    id: "newHireForm",
    heading: "New Hire form done (or not needed)",
    kind: "select",
    field: "NEW_HIRE_FORM",
    valueKey: "newHireForm",
    stampKey: "newHireFormAt",
  },
  {
    id: "flsaConflictFound",
    heading: "Other Campus Job FLSA conflict found",
    kind: "checkbox",
    field: "FLSA_CONFLICT_FOUND",
    stampKey: "flsaConflictFoundAt",
  },
  {
    id: "flsaConflictResolved",
    heading: "Other Campus Job FLSA conflict resolved",
    kind: "checkbox",
    field: "FLSA_CONFLICT_RESOLVED",
    stampKey: "flsaConflictResolvedAt",
  },
  {
    id: "inUcpath",
    heading: "In UCPath",
    kind: "checkbox",
    field: "IN_UCPATH",
    stampKey: "inUcpathAt",
  },
  {
    id: "i9Complete",
    heading: "I-9 Complete",
    kind: "checkbox",
    field: "I9_COMPLETE",
    stampKey: "i9CompleteAt",
  },
  {
    id: "staffComments",
    heading: "Staff Comments",
    kind: "text",
    field: "STAFF_COMMENTS",
    valueKey: "staffComments",
  },
];

/** The nine hiring columns, in the order they appear. */
export const HIRING_COLUMNS: readonly HiringColumn[] = [
  FUNDING_COLUMN,
  ...STAFF_COLUMNS,
];

/** The hiring column with this id, or undefined for one of the backend's text columns. */
export const hiringColumn = (id: string): HiringColumn | undefined =>
  HIRING_COLUMNS.find((column) => column.id === id);

/**
 * The main table's columns, in order: the backend's text columns (one row per assigned ULA) with
 * the hiring columns among them.
 */
export const RESULTS_COLUMN_IDS: readonly string[] = [
  "firstName",
  "lastName",
  "email",
  "permNumber",
  "previousServiceAsUla",
  "graduationDate",
  "otherCampusJob",
  "employeeId",
  "course",
  "funding",
  "instructor",
  "instructorEmail",
  "firstTimeUla",
  "status",
  "respondedAt",
  "comments",
  "formalOfferSent",
  "formalOfferAccepted",
  "newHireForm",
  "flsaConflictFound",
  "flsaConflictResolved",
  "inUcpath",
  "i9Complete",
  "staffComments",
];

/**
 * The main table's text columns alone, in the backend's order: the layout of each row of
 * `rows` (SoftOffersService.RESULTS_HEADERS).
 */
export const RESULTS_TEXT_COLUMN_IDS: readonly string[] =
  RESULTS_COLUMN_IDS.filter((id) => hiringColumn(id) === undefined);

/** The second table's columns, in the backend's order: answers from applicants no longer assigned. */
export const UNASSIGNED_COLUMN_IDS: readonly string[] = [
  "firstName",
  "lastName",
  "email",
  "courseAnswered",
  "status",
  "respondedAt",
  "comments",
];

/**
 * The columns hidden until the admin shows them (issue #500): the applicant fields the financial
 * office staff need, which the CSV always carries. Opt-in in the sense of useStoredHiddenColumns,
 * so they start hidden even for an admin whose choices were stored before they existed.
 */
export const OPT_IN_COLUMN_IDS: readonly string[] = [
  "permNumber",
  "previousServiceAsUla",
  "graduationDate",
  "otherCampusJob",
  "employeeId",
];

/** The columns that are always shown: not in the Columns menu, and with no "hide" link. */
export const ALWAYS_SHOWN_COLUMN_IDS: readonly string[] = [
  "firstName",
  "lastName",
];

/** The Offer Status column: muted when the answer was for another lecture. */
export const STATUS_COLUMN_ID = "status";
/** The Offer Response Date/Time column: shown in Pacific time, keeping its "(late)" mark. */
export const STAMP_COLUMN_ID = "respondedAt";
/** The Comments column: the one with a drag handle. */
export const COMMENTS_COLUMN_ID = "comments";

/** Where the browser keeps the hidden columns, for every recruitment's results page. */
export const SOFT_OFFER_COLUMNS_STORAGE_KEY = "softOfferResults.hiddenColumns";

/** The width Comments starts at, in pixels. */
export const COMMENTS_DEFAULT_WIDTH = 300;
/** The narrowest Comments may be dragged, in pixels. */
export const COMMENTS_MIN_WIDTH = WIDE_COLUMN_MIN_WIDTH;
/** The widest Comments may be dragged: this share of the window's width. */
export const COMMENTS_MAX_SHARE = 0.8;

/** The widest Comments may be in a window this wide: 80% of it, and never under the minimum. */
export const commentsMaxWidth = (windowWidth: number): number =>
  Math.max(COMMENTS_MIN_WIDTH, Math.floor(COMMENTS_MAX_SHARE * windowWidth));

/**
 * One column of a table as laid out: a text column reads the row's cell at `textIndex`, its place
 * among the table's text columns, under the backend's heading at that place; a hiring column reads
 * the row's hiring record, under its own heading.
 */
export type ResultsColumn =
  | { id: string; heading: string; textIndex: number; hiring: null }
  | { id: string; heading: string; textIndex: null; hiring: HiringColumn };

/**
 * The layout of a table's columns from its ids and the backend's headings, which cover the text
 * columns alone, in order. A heading the backend did not send (it sends one per text column) is
 * the id, so no heading is ever blank.
 */
export const layoutColumns = (
  ids: readonly string[],
  headers: readonly string[],
): ResultsColumn[] => {
  let textIndex = 0;
  return ids.map((id) => {
    const hiring = hiringColumn(id);
    if (hiring !== undefined) {
      return { id, heading: hiring.heading, textIndex: null, hiring };
    }
    const i = textIndex++;
    return { id, heading: headers[i] ?? id, textIndex: i, hiring: null };
  });
};

/**
 * The Columns menu's choices for a table: its columns, labelled by their headings, less the ones
 * that are always shown.
 */
export const columnChoices = (
  ids: readonly string[],
  headers: readonly string[],
): ColumnChoice[] =>
  layoutColumns(ids, headers)
    .map(({ id, heading }) => ({ id, label: heading }))
    .filter((choice) => !ALWAYS_SHOWN_COLUMN_IDS.includes(choice.id));

// ---- sorting the hiring columns (issue #509) ----

/** Plain code-point order of two texts, a null counting as blank. */
const compareText = (a: string | null, b: string | null): number => {
  const x = a ?? "";
  const y = b ?? "";
  return x < y ? -1 : x > y ? 1 : 0;
};

/** The New Hire form choices in sort order: blank, Done, Not needed. */
const NEW_HIRE_FORM_RANK: Record<NewHireForm, number> = {
  DONE: 1,
  NOT_NEEDED: 2,
};

const newHireFormRank = (value: NewHireForm | null): number =>
  value === null ? 0 : NEW_HIRE_FORM_RANK[value];

/**
 * How two rows' hiring records order in a hiring column, ascending; a row without a record is
 * blank throughout. A stamped checkbox orders by its stamp, so unchecked rows (no stamp) group
 * together, first, and checked rows follow in the order they were checked (the backend's
 * "2025-10-22T14:05:00" form orders by time as text); the direction toggle reverses the whole.
 * New Hire form orders by its value (blank, Done, Not needed), then by its stamp. Staff Comments
 * and Funding order as text.
 */
export const compareHiring = (
  column: HiringColumn,
  a: HiringRecord | null,
  b: HiringRecord | null,
): number => {
  switch (column.kind) {
    case "checkbox":
      return compareText(
        a?.[column.stampKey] ?? null,
        b?.[column.stampKey] ?? null,
      );
    case "select":
      return (
        newHireFormRank(a?.newHireForm ?? null) -
          newHireFormRank(b?.newHireForm ?? null) ||
        compareText(a?.[column.stampKey] ?? null, b?.[column.stampKey] ?? null)
      );
    default:
      return compareText(
        a?.[column.valueKey] ?? null,
        b?.[column.valueKey] ?? null,
      );
  }
};
