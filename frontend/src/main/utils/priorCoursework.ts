import { recentQuarters } from "main/utils/bulkCourses";
import { qyyToYyyyq } from "main/utils/quarterUtilities";

/** One course an applicant lists as relevant background, as the API stores and returns it. */
export type PriorCourse = {
  /** Present on rows that came back from the backend; absent on rows just added in the browser. */
  id?: number;
  ucsbCourse: boolean;
  /** Required when ucsbCourse is false; null/blank otherwise. */
  otherSchool: string | null;
  courseNumber: string;
  courseTitle: string | null;
  term: string | null;
  grade: string | null;
};

/** How many courses an application of each type must list. */
export const MIN_COURSES: Record<"TA" | "ULA", number> = { TA: 3, ULA: 1 };

/** What the applicant is told above the table, per form type. */
export const COURSEWORK_INSTRUCTIONS: Record<"TA" | "ULA", string> = {
  TA: "List the courses that are relevant background for serving as a TA. TA applicants must list at least 3 courses; there is no maximum.",
  ULA: "List, at a minimum, every course that is relevant background for the courses you are applying to be a ULA for. That means at least one course; there is no maximum.",
};

/** "UCSB" or the other school, for the table's School column. */
export const schoolOf = (course: PriorCourse): string =>
  course.ucsbCourse ? "UCSB" : (course.otherSchool ?? "");

/** The complaint shown when too few courses are listed. */
export const tooFewCoursesMessage = (type: "TA" | "ULA"): string => {
  const minimum = MIN_COURSES[type];
  return `Please list at least ${minimum} course${minimum === 1 ? "" : "s"}.`;
};

/** How many years back the Term dropdown goes (issue #305). */
export const TERM_YEARS_BACK = 8;

/** The legend shown under the Term dropdown. */
export const TERM_LEGEND = "F: Fall, W: Winter, S: Spring, M: Summer";

const QUARTER_NAMES: Record<string, string> = {
  F: "F",
  FA: "F",
  FALL: "F",
  W: "W",
  WI: "W",
  WIN: "W",
  WINTER: "W",
  S: "S",
  SP: "S",
  SPR: "S",
  SPRING: "S",
  M: "M",
  SU: "M",
  SUM: "M",
  SUMMER: "M",
};

const QUARTER_FIRST = /^([A-Z]+)[\s\-_/,.']*(\d{4}|\d{2})$/;
const YEAR_FIRST = /^(\d{4}|\d{2})[\s\-_/,.']*([A-Z]+)$/;

/**
 * A term in the canonical form [FWSM]\d\d (F25), or null when that cannot be done with a high
 * degree of certainty. The text is upper-cased (f25 -> F25) and a quarter letter, name or
 * abbreviation (Fall, Fa, Sp, Su, Wi, ...) is read beside a four-digit 20xx or two-digit year, in either
 * order ("Fall 2025", "Fa 25", "2025 Fall").
 */
export function canonicalTerm(term: string | null | undefined): string | null {
  if (!term) return null;
  const text = term.trim().toUpperCase();
  const first = QUARTER_FIRST.exec(text);
  const second = first ? null : YEAR_FIRST.exec(text);
  const parts = first
    ? { name: first[1], year: first[2] }
    : second
      ? { name: second[2], year: second[1] }
      : null;
  if (parts === null) return null;
  const quarter = QUARTER_NAMES[parts.name];
  if (quarter === undefined) return null;
  if (parts.year.length === 2) return `${quarter}${parts.year}`;
  return parts.year.startsWith("20")
    ? `${quarter}${parts.year.substring(2)}`
    : null;
}

/**
 * The term as it should be held and saved: canonical when it can be made so, otherwise as typed
 * (trimmed), and null when blank.
 */
export function normalizeTerm(term: string | null | undefined): string | null {
  const text = (term ?? "").trim();
  if (text === "") return null;
  return canonicalTerm(text) ?? text;
}

/** The course with its term normalized; used when an application is loaded for editing. */
export const withNormalizedTerm = (course: PriorCourse): PriorCourse => ({
  ...course,
  term: normalizeTerm(course.term),
});

/** The Term dropdown's choices: the current quarter first, then back TERM_YEARS_BACK years. */
export const termOptions = (now?: Date): string[] =>
  recentQuarters(now, TERM_YEARS_BACK).map((quarter) => quarter.qyy);

/** The numeric sort key for a term: S26 -> 20262; anything not in [FWSM]\d\d form -> 0. */
export const termSortKey = (term: string | null | undefined): number => {
  const yyyyq = qyyToYyyyq(term);
  return yyyyq === null ? 0 : parseInt(yyyyq, 10);
};
