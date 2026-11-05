import {
  collapseCourseId,
  recentQuarters,
  type CatalogCourse,
} from "main/utils/bulkCourses";
import { qyyToYyyyq } from "main/utils/quarterUtilities";
import { courseKey } from "main/utils/untakenCourses";

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

/**
 * What makes two rows the same course (issue #334): course number, school (UCSB, or the named other
 * school) and term, each ignoring case and spacing; the term as it would be saved (Fall 2025 and
 * F25 are one). The same course in another term, a retake, is a different row.
 */
export const sameCourseKey = (course: PriorCourse): string =>
  [
    // Stryker disable next-line StringLiteral : any text unlike a school's does, and a blank school equals a missing one
    course.ucsbCourse ? "UCSB" : `other:${courseKey(course.otherSchool ?? "")}`,
    courseKey(course.courseNumber),
    // Stryker disable next-line StringLiteral : a missing term and a blank one are the same, whatever stands for them
    courseKey(normalizeTerm(course.term) ?? ""),
  ].join("|");

/**
 * The courses with `added` joined in, one row per course (issue #334). An added course that matches
 * one already listed takes that row's place (and replaces its answers, a changed grade for
 * example) instead of becoming a second row; one that matches nothing goes on the end. Rows that
 * were already duplicated, as an older application may have them, collapse into the first's place.
 */
export function upsertCourses(
  list: PriorCourse[],
  added: PriorCourse[],
): PriorCourse[] {
  let result = list;
  for (const course of added) {
    const key = sameCourseKey(course);
    const first = result.findIndex((row) => sameCourseKey(row) === key);
    result =
      first === -1
        ? [...result, course]
        : result.flatMap((row, index) =>
            index === first
              ? [course]
              : sameCourseKey(row) === key
                ? []
                : [row],
          );
  }
  return result;
}

/**
 * The courses with the row at `index` replaced by its edited version (issue #334). If the edit made
 * it the same course as another row, that other row goes: the edited row is the one the applicant
 * is looking at, so it wins.
 */
export function replaceCourse(
  list: PriorCourse[],
  index: number,
  course: PriorCourse,
): PriorCourse[] {
  const key = sameCourseKey(course);
  return list.flatMap((row, position) =>
    position === index ? [course] : sameCourseKey(row) === key ? [] : [row],
  );
}

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

/**
 * The prior courses with a blank title filled in from the course catalog (issue #306). Only a UCSB
 * course whose number matches a catalog course, written the way the table writes it ("CMPSC 156"),
 * and whose title is blank is touched; a title the applicant typed is never replaced. When nothing
 * needs filling the very same array comes back, so callers can tell nothing changed. Meant for any
 * place an application's courses are loaded or copied in (the form's initial answers, including
 * those seeded from an earlier application, and any future seeding from another type's application).
 */
export function withCatalogTitles(
  courses: PriorCourse[],
  catalog: CatalogCourse[],
): PriorCourse[] {
  const titles = new Map<string, string>();
  for (const entry of catalog) {
    const title = (entry.title ?? "").trim();
    if (title !== "") titles.set(collapseCourseId(entry.courseId), title);
  }
  let changed = false;
  const filled = courses.map((course) => {
    const title = titles.get(collapseCourseId(course.courseNumber));
    if (!course.ucsbCourse || title === undefined) return course;
    if ((course.courseTitle ?? "").trim() !== "") return course;
    changed = true;
    return { ...course, courseTitle: title };
  });
  return changed ? filled : courses;
}
