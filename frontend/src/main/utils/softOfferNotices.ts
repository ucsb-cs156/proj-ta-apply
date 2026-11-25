// The "Soft Offer Notices" text (issue #484, part of the soft offers of issue #483): what a ULA
// applicant assigned to a course reads above the proceed-or-decline question.

/** One saved version, as the API returns it. */
export type SoftOfferNoticeVersion = {
  id: number;
  /** Markdown. */
  content: string;
  /** ISO local date-time, e.g. 2026-01-02T03:04:05. */
  createdAt: string;
};

export const SOFT_OFFER_NOTICES_TITLE = "Soft Offer Notices";

/** The two answers the applicant chooses between, as the card and the soft offer word them. */
export const SOFT_OFFER_CHOICES = [
  "Please proceed with a formal offer; I am likely to accept.",
  "I would like to decline this offer.",
] as const;

export const SOFT_OFFER_NOTICES_HISTORY_URL = "/api/admin/softOfferNotices/all";
export const SOFT_OFFER_NOTICES_SAVE_URL = "/api/admin/softOfferNotices";
