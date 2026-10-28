/** One saved version of the "Notices, Terms and Conditions" text, as the API returns it. */
export type NoticeVersion = {
  id: number;
  type: "TA" | "ULA";
  /** Markdown. */
  content: string;
  /** ISO local date-time, e.g. 2026-01-02T03:04:05. */
  createdAt: string;
};

/** The wording the issue asks for, verbatim; shared by the form and its tests. */
export const AGREEMENT_LABEL =
  "I have read and understood the text above, and I agree to the terms and conditions it specifies";

/** "Version 3, saved 1/2/2026, 3:04:05 AM" for a card footer or a summary line. */
export const describeVersion = (version: NoticeVersion): string =>
  `Version ${version.id}, saved ${new Date(version.createdAt).toLocaleString()}`;
