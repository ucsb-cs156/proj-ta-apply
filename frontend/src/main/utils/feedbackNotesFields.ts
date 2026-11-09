import {
  costDisplay,
  ratioDisplay,
  type TradeoffCosts,
} from "main/utils/instructorFeedback";
import {
  fillNoticeFields,
  QUARTER_NOTICE_FIELDS,
} from "main/utils/noticeFields";
import type { UcsbApiQuarter } from "main/utils/quarterCalendar";
import type { SavedVersion } from "main/utils/notices";

/**
 * Issue #429: the "Notes on TA/ULA tradeoffs" under each course's allocation feedback form are an
 * admin's Markdown, kept as versions on the Instructor Feedback Settings page. They carry the same
 * `${field}`s as the Notices, Terms and Conditions, filled in for the feedback's quarter, except
 * `${primaryConsiderationDate}`, which belongs to a recruitment; and three of their own: the
 * quarter's costs from its budget.
 */

/** One saved version of the Instructor Feedback Settings, as the API returns it. */
export type InstructorFeedbackSettings = SavedVersion & {
  /** The admin who saved it; null for the version the database was installed with. */
  editorEmail: string | null;
  /** Markdown. */
  notesText: string;
};

/** Where an instructor reads the settings in force: a list of zero or one. */
export const FEEDBACK_SETTINGS_URL = "/api/instructor/feedback/settings";
/** Where an admin reads every version, newest first. */
export const FEEDBACK_SETTINGS_HISTORY_URL =
  "/api/admin/instructorFeedbackSettings/all";
/** Where an admin saves a new version. */
export const FEEDBACK_SETTINGS_SAVE_URL =
  "/api/admin/instructorFeedbackSettings";
/** Where the admin's preview reads a quarter's costs, without creating its budget. */
export const FEEDBACK_SETTINGS_COSTS_URL =
  "/api/admin/instructorFeedbackSettings/costs";
/** The help page listing the fields. */
export const FEEDBACK_NOTES_FIELDS_HELP_PATH =
  "/help/instructor-feedback-fields";

/** The three cost fields, with what each holds. */
export const COST_FIELDS = [
  {
    key: "estimatedCostPerTA",
    label: "The quarter's estimated cost of one TA, from its budget",
  },
  {
    key: "estimatedCostPerULA",
    label:
      "The quarter's estimated cost of one ULA: the ULA hourly rate times the estimated hours per ULA",
  },
  {
    key: "taToUlaCostRatio",
    label:
      "The cost of a TA over the cost of a ULA, as 1:X.X, to one decimal place",
  },
] as const;

/** Every field name the notes may carry: the quarter, its calendar's fields and the costs. */
export const KNOWN_FEEDBACK_NOTES_FIELDS: readonly string[] = [
  "quarter",
  ...QUARTER_NOTICE_FIELDS.map((field) => String(field.key)),
  ...COST_FIELDS.map((field) => field.key),
];

/** What the notes are filled in with: the feedback's quarter, its calendar and its costs. */
export type FeedbackNotesFillIn = {
  quarter?: string | null;
  calendar?: UcsbApiQuarter | null;
  costs?: TradeoffCosts | null;
};

/**
 * The notes with their fields filled in. The quarter and calendar fields are filled as a notice's
 * are, and stay as written without a value. The costs are always filled: a cost that is missing
 * or zero, and the ratio then, read "not yet set", as the notes said before issue #429.
 */
export function fillFeedbackNotesFields(
  text: string,
  { quarter, calendar, costs }: FeedbackNotesFillIn,
): string {
  return fillNoticeFields(text, { quarter, calendar })
    .replaceAll("${estimatedCostPerTA}", costDisplay(costs?.estimatedCostPerTA))
    .replaceAll(
      "${estimatedCostPerULA}",
      costDisplay(costs?.estimatedCostPerULA),
    )
    .replaceAll("${taToUlaCostRatio}", ratioDisplay(costs));
}

/** The one-line explanation beside the editor. */
export const FEEDBACK_NOTES_FIELDS_HINT =
  "Write ${estimatedCostPerTA}, ${estimatedCostPerULA} or ${taToUlaCostRatio} and each instructor sees their quarter's estimated cost of a TA (e.g. $12,000.00), of a ULA (e.g. $2,000.00), or the ratio of the two (e.g. 1:6.0) in its place, or \"not yet set\" until the quarter's budget has them; ${quarter} and the dates of the quarter, such as ${firstDayOfClasses}, can be inserted as in the notices. The preview fills them in for the quarter chosen above it.";

/** The notes as they were hard coded before issue #429, and as changeset 069 installs them. */
export const ORIGINAL_FEEDBACK_NOTES =
  "Note that the current estimated cost of a TA is ${estimatedCostPerTA} while the estimated cost of a ULA is ${estimatedCostPerULA}. This means that on a cost basis, the ratio of TA to ULA is ${taToUlaCostRatio}.\n\nOn the other hand, TAs work 20 hours per week, while ULAs work 10 hours per week.\n\nWe are not always in a position to trade off TAs for ULAs in precisely the way each faculty member would prefer; there are constraints other than faculty preferences that we must satisfy. That being said, we will do our best to take your preferences into consideration.";
