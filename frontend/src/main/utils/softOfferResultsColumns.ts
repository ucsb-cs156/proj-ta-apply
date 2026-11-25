/**
 * The columns of the two tables on the Soft Offer Results page (issue #494): which may be hidden,
 * where the choice is kept, and how wide Comments may be. The backend sends the headings and the
 * rows as lists of text in a fixed order (SoftOffersService.RESULTS_HEADERS and
 * UNASSIGNED_HEADERS); the ids here name the columns in that order, for the Columns menu, the
 * "hide" links and the test ids.
 */
import type { ColumnChoice } from "main/components/Common/ColumnVisibilityControl";
import { WIDE_COLUMN_MIN_WIDTH } from "main/utils/columnWidths";

/** The main table's columns, in the backend's order: one row per assigned ULA. */
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
  "instructor",
  "instructorEmail",
  "firstTimeUla",
  "status",
  "respondedAt",
  "comments",
];

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
 * The Columns menu's choices for a table: its columns, labelled by the backend's headings, less
 * the ones that are always shown. A heading the backend did not send (it sends one per id) is
 * labelled by the id, so the menu never has a blank line.
 */
export const columnChoices = (
  ids: readonly string[],
  headers: readonly string[],
): ColumnChoice[] =>
  ids
    .map((id, i) => ({ id, label: headers[i] ?? id }))
    .filter((choice) => !ALWAYS_SHOWN_COLUMN_IDS.includes(choice.id));
