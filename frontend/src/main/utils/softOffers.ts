import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { formatPacificDateTime } from "main/utils/pacificTime";
import { SOFT_OFFER_CHOICES } from "main/utils/softOfferNotices";
import { RESULTS_COLUMN_IDS } from "main/utils/softOfferResultsColumns";

// Soft offers (issue #483): the optional, ULA-only step after hiring decisions are released in
// which each assigned applicant is asked whether to proceed to a formal offer. This file is the
// admin side of releasing them (issue #485).

export const RELEASE_SOFT_OFFERS_LABEL = "Release Soft Offers";

/** PUT here with id and deadline releases soft offers, or changes the deadline once released. */
export const SOFT_OFFERS_URL = "/api/admin/recruitments/softOffers";

/** The newest Soft Offer Notices version, as a list of zero or one (issue #484). */
export const SOFT_OFFER_NOTICES_CURRENT_URL = "/api/softOfferNotices/current";

export const SOFT_OFFERS_HELP = "/help/admins#soft-offers";

export const RELEASE_SOFT_OFFERS_EXPLANATION =
  'Clicking "Release Soft Offers" will make soft offers available to students when they log in to the portal, and begin collecting their decisions. Please choose a date/time as a deadline for soft offers.';

export const NO_NOTICE_WARNING =
  "No Soft Offer Notices text has been saved (Admin → ULA App Settings), so students will see the course details and the question but no notice text.";

export const TENTATIVE_WARNING =
  "Hiring decisions are tentative: applications or faculty ranking have been reopened.";

export const DEADLINE_ERROR = "Enter a deadline in the future.";

export const RELEASED_TOAST = "Soft offers released.";

/** Whether soft offers have been released for the recruitment. */
export const softOffersReleased = (
  recruitment: Pick<Recruitment, "softOffersReleasedAt">,
): boolean =>
  recruitment.softOffersReleasedAt !== null &&
  recruitment.softOffersReleasedAt !== undefined;

/**
 * Whether the card offers Release Soft Offers: a ULA recruitment whose hiring decisions are
 * released and whose soft offers are not yet.
 */
export const canReleaseSoftOffers = (
  recruitment: Pick<
    Recruitment,
    "type" | "assignmentsPublished" | "softOffersReleasedAt"
  >,
): boolean =>
  recruitment.type === "ULA" &&
  recruitment.assignmentsPublished === true &&
  !softOffersReleased(recruitment);

// ---- the admin's results (issue #487) ----

export const SOFT_OFFER_RESULTS_LABEL = "Soft Offer Results";
export const SOFT_OFFER_RESULTS_URL = "/api/admin/softOffers";
export const DEADLINE_CHANGED_TOAST = "Soft offer deadline changed.";
export const CHANGE_DEADLINE_LABEL = "Change Deadline";

/** The admin page of a recruitment's soft offer results. */
export const softOfferResultsPath = (recruitmentId: number | string): string =>
  `/admin/recruitments/${recruitmentId}/softOffers`;

export const softOfferResultsCsvUrl = (
  recruitmentId: number | string,
): string => `${SOFT_OFFER_RESULTS_URL}/csv?recruitmentId=${recruitmentId}`;

/** The file name the browser saves the CSV under, matching the backend's. */
export const softOfferResultsCsvFileName = (
  recruitmentId: number | string,
): string => `soft-offers-${recruitmentId}.csv`;

/** What GET /api/admin/softOffers answers: text tables, like the published assignments. */
export type SoftOfferResults = {
  recruitmentId: number;
  quarter: string;
  releasedAt: string;
  deadline: string;
  counts: { assigned: number; proceed: number; declined: number; none: number };
  headers: string[];
  rows: string[][];
  unassignedHeaders: string[];
  unassigned: string[][];
};

/** An answer given for a lecture other than the one now held: "Proceed (for CMPSC 8)". */
export const isStaleStatus = (cell: string): boolean => cell.includes(" (for ");

/**
 * A response stamp cell as the page shows it: the backend's "2026-11-21T08:05" in Pacific form,
 * keeping its " (late)" mark; an empty cell stays empty. (The formatter reads the stamp at the
 * start of the text and ignores what follows, and gives "" for "".)
 */
export const formatStamp = (cell: string): string =>
  formatPacificDateTime(cell) + (cell.endsWith(" (late)") ? " (late)" : "");

/** A stored deadline ("2025-10-25T17:00:00", or none) as the datetime-local box takes it. */
export const deadlineAsLocal = (deadline: string | null | undefined): string =>
  (deadline ?? "").slice(0, 16);

// ---- the Copy Soft Offer Emails buttons (issue #511) ----

/** The line's label, before the four buttons. */
export const COPY_EMAILS_LABEL = "Copy Soft Offer Emails:";

/** The Offer Status words the results rows carry (SoftOffersService.PROCEED / DECLINED). */
export const PROCEED_STATUS = "Proceed";
export const DECLINED_STATUS = "Declined";

export type EmailBucketId = "all" | "proceed" | "declined" | "none";

/** The four buttons, in order, with their labels. */
export const EMAIL_BUCKETS: readonly { id: EmailBucketId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "proceed", label: `Responded "${PROCEED_STATUS}"` },
  { id: "declined", label: `Responded "${DECLINED_STATUS}"` },
  { id: "none", label: "No Response" },
];

/**
 * The emails of the main table's rows (one per assigned ULA), in the table's order, split the way
 * the counts sentence splits them: by the answer for the lecture each applicant now holds. A stale
 * answer ("Proceed (for CMPSC 8)") and a blank one are both "none", as in the counts. The second
 * table (applicants no longer assigned) is not part of this.
 */
export const softOfferEmailBuckets = (
  rows: readonly (readonly string[])[],
): Record<EmailBucketId, string[]> => {
  const email = RESULTS_COLUMN_IDS.indexOf("email");
  const status = RESULTS_COLUMN_IDS.indexOf("status");
  const buckets: Record<EmailBucketId, string[]> = {
    all: [],
    proceed: [],
    declined: [],
    none: [],
  };
  for (const row of rows) {
    buckets.all.push(row[email]);
    if (row[status] === PROCEED_STATUS) {
      buckets.proceed.push(row[email]);
    } else if (row[status] === DECLINED_STATUS) {
      buckets.declined.push(row[email]);
    } else {
      buckets.none.push(row[email]);
    }
  }
  return buckets;
};

/** "3 assigned ULAs: 1 proceed, 0 declined, 2 no response yet." */
export const countsSentence = (counts: SoftOfferResults["counts"]): string =>
  `${counts.assigned} assigned ULA${counts.assigned === 1 ? "" : "s"}: ${counts.proceed} proceed, ${counts.declined} declined, ${counts.none} no response yet.`;

// ---- the applicant's side (issue #486) ----

export type SoftOfferDecision = "PROCEED" | "DECLINE";

/** One meeting of one discussion section; a section with no scheduled time has nulls. */
export type SoftOfferMeeting = {
  section: string | null;
  days: string | null;
  beginTime: string | null;
  endTime: string | null;
};

export type SoftOfferCourse = {
  recruitmentCourseId: number;
  courseNumber: string;
  section: string | null;
  title: string | null;
  instructor: string | null;
  instructorEmail: string | null;
  days: string | null;
  beginTime: string | null;
  endTime: string | null;
};

export type SoftOfferAnswer = {
  decision: SoftOfferDecision;
  comments: string | null;
  /** Pacific wall-clock time, e.g. 2026-11-21T08:00:00. */
  respondedAt: string;
};

/** One open soft offer, as GET /api/softOffers/mine answers. */
export type SoftOffer = {
  recruitmentId: number;
  quarter: string;
  applicationId: number;
  releasedAt: string;
  deadline: string;
  notice: { id: number; content: string } | null;
  course: SoftOfferCourse;
  /** Null when the UCSB API could not be reached. */
  sections: SoftOfferMeeting[] | null;
  response: SoftOfferAnswer | null;
};

export const SOFT_OFFERS_MINE_URL = "/api/softOffers/mine";
export const SOFT_OFFERS_RESPOND_URL = "/api/softOffers/respond";

export const SOFT_OFFER_INTRO =
  "You have been recommended for a ULA position for the following course:";

/** The two radio buttons, in the order the design lists them. */
export const SOFT_OFFER_DECISIONS: {
  decision: SoftOfferDecision;
  label: string;
}[] = [
  { decision: "PROCEED", label: SOFT_OFFER_CHOICES[0] },
  { decision: "DECLINE", label: SOFT_OFFER_CHOICES[1] },
];

export const SECTIONS_UNAVAILABLE =
  "Section times are not available right now.";
export const SECTIONS_NONE = "This lecture has no discussion sections listed.";
export const SECTIONS_NOTE =
  "Which section(s) you will staff is decided by the instructor.";
export const SUBMIT_RESPONSE_LABEL = "Submit My Response";
export const RESPONSE_RECORDED_TOAST = "Your response has been recorded.";

const CONTACT_SENTENCE =
  "If you change your mind after submitting this form, please contact the ULA program directors, or the CS Department Student Affairs Manager.";

/** What the read-only section says under the recorded answer. */
export const decisionSentence = (decision: SoftOfferDecision): string =>
  decision === "PROCEED"
    ? `You have indicated that you would like to proceed to a formal offer. ${CONTACT_SENTENCE}`
    : `You have indicated that you would like to decline this offer. ${CONTACT_SENTENCE}`;

/** The label of a decision, as the radio button read. */
export const decisionLabel = (decision: SoftOfferDecision): string =>
  decision === "PROCEED" ? SOFT_OFFER_CHOICES[0] : SOFT_OFFER_CHOICES[1];

/** The sentence above the radio buttons, with the deadline in Pacific time. */
export const deadlineSentence = (deadline: string): string =>
  `Please choose an option below by ${formatPacificDateTime(deadline)}. If you do not respond by that deadline, we may need to offer this position to another candidate.`;

/** The open soft offer for one recruitment's card, if any. */
export const offerFor = (
  offers: readonly SoftOffer[],
  recruitmentId: number,
): SoftOffer | undefined =>
  offers.find((offer) => offer.recruitmentId === recruitmentId);

/**
 * Whether the released hiring decisions are tentative (issue #237): applications or faculty
 * ranking have been reopened since, so the assignments may still move.
 */
export const hiringDecisionsTentative = (
  recruitment: Pick<Recruitment, "applicationStatus" | "reviewStatus">,
): boolean =>
  recruitment.applicationStatus === "OPEN" ||
  recruitment.reviewStatus === "Open";
