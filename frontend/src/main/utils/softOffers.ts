import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";

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

/**
 * Whether the released hiring decisions are tentative (issue #237): applications or faculty
 * ranking have been reopened since, so the assignments may still move.
 */
export const hiringDecisionsTentative = (
  recruitment: Pick<Recruitment, "applicationStatus" | "reviewStatus">,
): boolean =>
  recruitment.applicationStatus === "OPEN" ||
  recruitment.reviewStatus === "Open";
