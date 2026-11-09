import { formatDollars } from "main/utils/currency";
import {
  isReleased,
  type InstructorQuarter,
} from "main/utils/instructorQuarters";

/** Where an instructor reads and saves their allocation feedback (issue #425). */
export const FEEDBACK_URL = "/api/instructor/feedback";
/** The two cost figures of a quarter's budget, for the tradeoff notes. */
export const FEEDBACK_COSTS_URL = "/api/instructor/feedback/costs";

/** What the form saves, each on its own as it changes. */
export type FeedbackFields = {
  allocReasonable: boolean;
  differentTACount: boolean;
  differentULACount: boolean;
  otherConcerns: boolean;
  numTAsPreferred: number | null;
  numULAsPreferred: number | null;
  comments: string | null;
};

/** One row of /api/instructor/feedback: the caller's feedback on one course in one quarter. */
export type InstructorFeedback = FeedbackFields & {
  id: number;
  quarter: string;
  email: string;
  recruitmentCourseId: number;
  lastUpdated: string | null;
};

/** What /api/instructor/feedback/costs returns: null for a figure not yet entered. */
export type TradeoffCosts = {
  quarter: string;
  estimatedCostPerTA: number | null;
  estimatedCostPerULA: number | null;
};

/** The longest the comments may be, in characters; the server refuses longer. */
export const MAX_COMMENTS = 2048;

/** Said under the text area once the comments reach the limit. */
export const COMMENTS_LIMIT_MESSAGE =
  "If you need more than 2048 characters for your comments, it may be better to send an email.";

/** Said while no box is checked: the form asks for at least one. */
export const AT_LEAST_ONE_MESSAGE =
  "Please select at least one of the options above.";

/** Said in place of a cost or the ratio while a figure is missing or zero. */
export const NOT_YET_SET = "not yet set";

/** How long the comments wait after the last keystroke before they are saved. */
export const COMMENTS_SAVE_DELAY_MS = 750;

/** Said in place of the form while a TA-only quarter's TA allocations are withheld. */
export const WAITING_FOR_TA =
  "When initial TA allocations have been released to faculty, you will be given an opportunity here to provide feedback";
/** Said in place of the form while a ULA-only quarter's ULA allocations are withheld. */
export const WAITING_FOR_ULA =
  "When initial ULA allocations have been released to faculty, you will be given an opportunity here to provide feedback";
/** Said in place of the form while a quarter with both has not released both. */
export const WAITING_FOR_BOTH =
  "When both the initial TA and ULA allocations have been released to faculty, you will be given an opportunity here to provide feedback";

/**
 * What a course's feedback area says while the form is not open yet (issue #425), or null once it
 * is: the form opens when every recruitment of the quarter has released its allocations to faculty.
 */
export function feedbackWaitingMessage(
  quarter: InstructorQuarter,
): string | null {
  const { ta, ula } = quarter;
  if ([ta, ula].every((r) => r === undefined || isReleased(r))) {
    return null;
  }
  if (ta && ula) {
    return WAITING_FOR_BOTH;
  }
  return ta ? WAITING_FOR_TA : WAITING_FOR_ULA;
}

/** Whether a cost figure has a value the notes can use: present and not zero. */
const usable = (amount: number | null | undefined): amount is number =>
  amount !== null && amount !== undefined && amount !== 0;

/** A cost as the notes show it: dollars and cents, or "not yet set". */
export const costDisplay = (amount: number | null | undefined): string =>
  usable(amount) ? formatDollars(amount) : NOT_YET_SET;

/**
 * The TA to ULA ratio on a cost basis as the notes show it: "1:X.X", the cost per TA over the cost
 * per ULA to one decimal place; "not yet set" while either cost is missing or zero.
 */
export const ratioDisplay = (
  costs: TradeoffCosts | null | undefined,
): string => {
  const ta = costs?.estimatedCostPerTA;
  const ula = costs?.estimatedCostPerULA;
  return usable(ta) && usable(ula) ? `1:${(ta / ula).toFixed(1)}` : NOT_YET_SET;
};

/** What may be typed as a preferred count: digits, or nothing (which clears it). */
export const isValidCount = (value: string): boolean => /^\d*$/.test(value);

/** A typed count as it is saved: null for an empty box. */
export const countFromInput = (value: string): number | null =>
  value === "" ? null : Number(value);
