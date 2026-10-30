import { quarterRange, yyyyqToQyy } from "main/utils/quarterUtilities";
import type { PriorCourse } from "main/utils/priorCoursework";

/** The grades the bulk-add modal offers (issue #100): in progress first, then the letter grades. */
export const GRADE_OPTIONS = [
  "IP",
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D+",
  "D",
  "D-",
  "F",
];

/** How far back the term choices go. */
export const YEARS_BACK = 10;

/** A course as the admin-populated course table returns it; only these two fields matter here. */
export type CatalogCourse = { courseId: string; title: string | null };

/** What the applicant has said about one listed course. */
export type BulkCourseAnswer = { taken: boolean; term: string; grade: string };

export const NO_ANSWER: BulkCourseAnswer = {
  taken: false,
  term: "",
  grade: "",
};

/**
 * The quarter a date falls in, as YYYYQ: January to March is winter (1), April to June spring (2),
 * July to September summer (3), October to December fall (4).
 */
export function quarterOf(date: Date): string {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `${date.getFullYear()}${quarter}`;
}

/** The terms on offer: the current quarter and every quarter of the ten years before it, newest first. */
export function recentQuarters(
  now: Date = new Date(),
): { yyyyq: string; qyy: string }[] {
  const current = quarterOf(now);
  const earliest = `${now.getFullYear() - YEARS_BACK}${current.charAt(4)}`;
  return quarterRange(earliest, current).reverse();
}

/** "CMPSC   156" as the prior coursework table writes a course number: "CMPSC 156". */
export const collapseCourseId = (courseId: string): string =>
  courseId.trim().replace(/\s+/g, " ");

/**
 * The rows to append to the prior coursework: one per course ticked, in the order the courses are
 * listed, each a UCSB course with the title carried over and the term written the way the form's
 * own placeholder suggests (F25).
 */
export function bulkCourseRows(
  courses: CatalogCourse[],
  answers: Record<string, BulkCourseAnswer | undefined>,
): PriorCourse[] {
  return courses
    .filter((course) => answers[course.courseId]?.taken)
    .map((course) => {
      const answer = answers[course.courseId] ?? NO_ANSWER;
      return {
        ucsbCourse: true,
        otherSchool: null,
        courseNumber: collapseCourseId(course.courseId),
        courseTitle: course.title ?? null,
        term: answer.term === "" ? null : yyyyqToQyy(answer.term),
        grade: answer.grade === "" ? null : answer.grade,
      };
    });
}
