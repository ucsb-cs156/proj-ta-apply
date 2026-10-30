import { fromFormat } from "main/utils/quarterUtilities";

/**
 * Issue #150: "mail merge" fields in the Notices, Terms and Conditions text. An admin writes
 * `${quarter}` or `${primaryConsiderationDate}` and each applicant sees their recruitment's
 * values in their place. Anything else in that shape, or a field with no value to hand (the
 * editor's preview, say), is left exactly as written.
 */

/** What a notice can be filled in with: the recruitment's quarter (YYYYQ) and deadline (ISO). */
export type NoticeFillIn = {
  quarter?: string | null;
  primaryConsiderationDate?: string | null;
};

/** The fields, as written between `${` and `}`. */
export const NOTICE_FIELDS = ["quarter", "primaryConsiderationDate"] as const;

/** "20261" as "Winter 2026". */
export const quarterName = (yyyyq: string): string => {
  const [season, year] = fromFormat(yyyyq).split(" ");
  return `${season.charAt(0)}${season.slice(1).toLowerCase()} ${year}`;
};

/** "2026-01-20" as "January 20, 2026", read as a calendar date rather than a UTC instant. */
export const longDate = (iso: string): string => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

/** The text with every field that has a value filled in; the rest untouched. */
export function fillNoticeFields(
  content: string,
  fillIn?: NoticeFillIn | null,
): string {
  if (!fillIn) return content;
  let filled = content;
  if (fillIn.quarter) {
    filled = filled.replaceAll("${quarter}", quarterName(fillIn.quarter));
  }
  if (fillIn.primaryConsiderationDate) {
    filled = filled.replaceAll(
      "${primaryConsiderationDate}",
      longDate(fillIn.primaryConsiderationDate),
    );
  }
  return filled;
}

/** The one-line explanation beside the editor. */
export const NOTICE_FIELDS_HINT =
  "Write ${quarter} or ${primaryConsiderationDate} and each applicant sees their recruitment's quarter (e.g. Winter 2026) or primary consideration date (e.g. January 20, 2026) in its place. The preview shows them as written.";

/** The two examples from issue #150, for the help page. */
export const NOTICE_FIELD_EXAMPLES = [
  "If you are a BS/MS student, and you will be in graduate status during ${quarter}, please apply to be a TA instead of applying to be a ULA.",
  "Applications received by ${primaryConsiderationDate} will be given full consideration.  Applications received after that date are not guaranteed to be considered, but may be reviewed if time permits and/or positions remain unfilled.",
];
