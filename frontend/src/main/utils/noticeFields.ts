import {
  fromFormat,
  nextQuarter,
  quarterOfDate,
  toNumericYYYYQ,
} from "main/utils/quarterUtilities";
import {
  QUARTER_DATE_FIELDS,
  type UcsbApiQuarter,
} from "main/utils/quarterCalendar";

/**
 * Issue #150: "mail merge" fields in the Notices, Terms and Conditions text. An admin writes
 * `${quarter}` or `${primaryConsiderationDate}` and each applicant sees their recruitment's
 * values in their place. Anything else in that shape, or a field with no value to hand (the
 * editor's preview, say), is left exactly as written.
 */

/**
 * What a notice can be filled in with: the recruitment's quarter (YYYYQ) and deadline (ISO), and
 * (issue #153) the quarter calendar's row for that quarter, when it is on file.
 */
export type NoticeFillIn = {
  quarter?: string | null;
  primaryConsiderationDate?: string | null;
  calendar?: UcsbApiQuarter | null;
};

/** The recruitment's own fields, as written between `${` and `}`. */
export const NOTICE_FIELDS = ["quarter", "primaryConsiderationDate"] as const;

/** The quarter calendar's name fields a notice can carry (issue #153), with what each holds. */
export const QUARTER_NAME_FIELDS: {
  key: keyof UcsbApiQuarter;
  label: string;
}[] = [
  { key: "qyy", label: "The quarter in short form, e.g. F21" },
  {
    key: "name",
    label: "The quarter's name as UCSB writes it, e.g. FALL 2021",
  },
  { key: "category", label: "The season, e.g. FALL" },
  { key: "academicYear", label: "The academic year, e.g. 2021-2022" },
];

/** Every calendar field a notice can carry: the names, then the dates in the cards' order. */
export const QUARTER_NOTICE_FIELDS: {
  key: keyof UcsbApiQuarter;
  label: string;
}[] = [
  ...QUARTER_NAME_FIELDS,
  ...QUARTER_DATE_FIELDS.map((field) => ({
    key: field.key,
    label: field.label,
  })),
];

/** "2021-05-10T09:00:00" as "May 10, 2021 at 9:00 AM" for a pass, or "May 10, 2021" otherwise. */
export const longDateTime = (iso: string, withTime: boolean): string => {
  const [date, time] = iso.split("T");
  const dateText = longDate(date);
  if (!withTime || !time) return dateText;
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours < 12 ? "AM" : "PM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${dateText} at ${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
};

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
  const calendar = fillIn.calendar;
  if (calendar) {
    for (const { key } of QUARTER_NAME_FIELDS) {
      const value = calendar[key];
      if (value) filled = filled.replaceAll("${" + key + "}", String(value));
    }
    for (const { key, withTime } of QUARTER_DATE_FIELDS) {
      const value = calendar[key];
      if (value) {
        filled = filled.replaceAll(
          "${" + key + "}",
          longDateTime(String(value), withTime === true),
        );
      }
    }
  }
  return filled;
}

/** The one-line explanation beside the editor. */
export const NOTICE_FIELDS_HINT =
  "Write ${quarter} or ${primaryConsiderationDate} and each applicant sees their recruitment's quarter (e.g. Winter 2026) or primary consideration date (e.g. January 20, 2026) in its place; the various dates of that quarter, such as ${firstDayOfClasses}, can be inserted the same way. The preview fills them in for the quarter chosen above it.";

/** Every field name a notice may carry (issue #192): the recruitment's own and the calendar's. */
export const KNOWN_NOTICE_FIELDS: readonly string[] = [
  ...NOTICE_FIELDS,
  ...QUARTER_NOTICE_FIELDS.map((field) => String(field.key)),
];

/** Anything written as ${...}, whatever is inside the braces (no closing brace or line break). */
const FIELD_PATTERN = /\$\{([^}\n]*)\}/g;

/**
 * The names written as ${name} that are not fields at all (issue #192), each once, in the order
 * they first appear; "${}" counts, as the empty name.
 */
export const findUnknownFields = (content: string): string[] => {
  const unknown: string[] = [];
  for (const match of content.matchAll(FIELD_PATTERN)) {
    const key = match[1];
    if (!KNOWN_NOTICE_FIELDS.includes(key) && !unknown.includes(key)) {
      unknown.push(key);
    }
  }
  return unknown;
};

/**
 * The quarter the editor's preview is filled in for by default (issue #192): the one after the
 * quarter today falls in, as YYYYQ, since the next notice is most likely for that quarter.
 */
export const defaultPreviewQuarter = (today: Date = new Date()): string =>
  String(nextQuarter(toNumericYYYYQ(quarterOfDate(today))));

/** The title that marks a link as an unknown field in the preview, so it can be drawn in red. */
export const UNKNOWN_FIELD_TITLE = "unknown-notice-field";

/**
 * The content with every unknown ${name} turned into a Markdown link titled
 * {@link UNKNOWN_FIELD_TITLE}, which the preview renders as red text instead of a link. Known
 * fields, filled in or not, are left alone. Brackets and backslashes in the name are escaped so
 * the link text survives Markdown.
 */
export const markUnknownFields = (content: string): string =>
  content.replace(FIELD_PATTERN, (whole, key: string) =>
    KNOWN_NOTICE_FIELDS.includes(key)
      ? whole
      : `[${whole.replace(/[\\[\]]/g, "\\$&")}](# "${UNKNOWN_FIELD_TITLE}")`,
  );

/** A sample quarter for the help page, so each calendar field can be shown with a value. */
export const SAMPLE_CALENDAR: UcsbApiQuarter = {
  quarter: "20214",
  qyy: "F21",
  name: "FALL 2021",
  category: "FALL",
  academicYear: "2021-2022",
  firstDayOfClasses: "2021-10-01T00:00:00",
  lastDayOfClasses: "2021-12-10T00:00:00",
  firstDayOfFinals: "2021-12-11T00:00:00",
  lastDayOfFinals: "2021-12-17T00:00:00",
  firstDayOfQuarter: "2021-09-26T00:00:00",
  lastDayOfSchedule: "2022-01-01T00:00:00",
  pass1Begin: "2021-05-10T09:00:00",
  pass2Begin: "2021-05-24T09:00:00",
  pass3Begin: "2021-06-07T09:00:00",
  feeDeadline: "2021-09-13T00:00:00",
  lastDayToAddUnderGrad: "2021-10-18T00:00:00",
  lastDayToAddGrad: "2021-10-18T00:00:00",
  lastDayThirdWeek: "2021-10-19T00:00:00",
};

/** The two examples from issue #150, for the help page. */
export const NOTICE_FIELD_EXAMPLES = [
  "If you are a BS/MS student, and you will be in graduate status during ${quarter}, please apply to be a TA instead of applying to be a ULA.",
  "Applications received by ${primaryConsiderationDate} will be given full consideration.  Applications received after that date are not guaranteed to be considered, but may be reviewed if time permits and/or positions remain unfilled.",
];
