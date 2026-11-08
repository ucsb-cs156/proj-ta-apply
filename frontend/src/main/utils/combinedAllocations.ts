/**
 * The figures of the Combined Allocation page (issue #358): the union of a quarter's TA and ULA
 * courses, the cost ratio, the TA to ULA conversion factor and the overall ASE:Student ratio.
 */
import type { RecruitmentCourse } from "main/components/Recruitments/RecruitmentCourseTable";

/** The explanation of the conversion factor: its tooltip, and the same words on the Help page. */
export const CONVERSION_FACTOR_EXPLANATION =
  "When computing overall ASE:Student ratio, how many ULAs count as 1 TA? You can set this to the ratio of their costs (computed above), or the ratio of the number of hours they put in (20 for TAs vs. 10 for ULAs) or whatever basis makes the most sense.";

/** What the backend says, and the field shows, about a factor that is not greater than zero. */
export const CONVERSION_FACTOR_INVALID_MESSAGE =
  "conversionTAtoULA must be greater than zero";

/** A positive number, typed with digits and at most one point: what may be saved as the factor. */
export const isValidConversionFactor = (value: string): boolean =>
  /^\d+(\.\d+)?$/.test(value) && Number(value) > 0;

/** What a quarter's factor is until an admin sets it, as on the backend. */
export const DEFAULT_CONVERSION_FACTOR = 3;

/** The shown placeholder for a ratio that cannot be computed; the same as the other ratio columns. */
const NO_RATIO = "—";

/**
 * TA Cost/ULA Cost: Cost per TA divided by Cost per ULA, with two decimal places, whenever the
 * cost per ULA is non-zero; empty (the empty string) otherwise, or when either cost is unknown.
 */
export const costRatioDisplay = (
  costPerTa: number | null | undefined,
  costPerUla: number | null | undefined,
): string =>
  costPerTa == null || costPerUla == null || costPerUla === 0
    ? ""
    : (costPerTa / costPerUla).toFixed(2);

/**
 * The ASE:Student ratio of one course: the number of students per TA-equivalent, as "1:N" with N
 * rounded to a whole number like the other ratio columns,
 *
 * `1 : ( enrollmentEstimate / ( TA allocation + ULA allocation / conversionTAtoULA ) )`.
 *
 * A dash when there is no enrollment estimate or the TA-equivalents are zero. A type that the
 * course does not have counts as no allocation.
 */
export const aseRatioDisplay = (
  taAllocation: number | null | undefined,
  ulaAllocation: number | null | undefined,
  enrollmentEstimate: number | null | undefined,
  conversionFactor: number,
): string => {
  const taEquivalents =
    (taAllocation ?? 0) + (ulaAllocation ?? 0) / conversionFactor;
  if (enrollmentEstimate == null || !(taEquivalents > 0)) {
    return NO_RATIO;
  }
  return `1:${Math.round(enrollmentEstimate / taEquivalents)}`;
};

/**
 * One row of the combined table: a section as offered in the quarter, with its TA row and its ULA
 * row (each absent when that recruitment does not have the section).
 */
export type CombinedCourse = {
  /** The quarter's identity for a section: its enroll code. */
  enrollCode: string;
  courseId: string;
  section: string | null;
  title: string | null;
  instructor: string | null;
  days: string | null;
  time: string | null;
  room: string | null;
  enrollment: number | null;
  maxEnroll: number | null;
  status: string | null;
  summerSession: string | null;
  /** Set by Populate when the section was not found (issue #122). */
  stale?: boolean;
  /** The section's estimate for the quarter, from whichever row has it; null when neither does. */
  enrollmentEstimate: number | null;
  ta?: RecruitmentCourse;
  ula?: RecruitmentCourse;
};

/** Code-unit order, as the course list is sorted, so padded ids such as "CMPSC   130A" sort. */
const orderKey = (value: string | null): string => value ?? "";
const compare = (a: string | null, b: string | null): number =>
  orderKey(a) < orderKey(b) ? -1 : orderKey(a) > orderKey(b) ? 1 : 0;

/**
 * The union of a quarter's TA and ULA courses (issue #358), one row per enroll code (so two
 * lectures of a course are two rows, and a section in both recruitments is one), in course id then
 * section order. Details (title, instructor, days, time, room, enrollment, status) come from the TA
 * row when there is one, and from the ULA row otherwise: a section in both recruitments is the same
 * course. The enrollment estimate is the section's one estimate for the quarter (issue #363), which
 * both recruitments' rows carry, so it is taken from whichever row has it.
 */
export const combineCourses = (
  taCourses: RecruitmentCourse[],
  ulaCourses: RecruitmentCourse[],
): CombinedCourse[] => {
  const byCode = new Map<string, CombinedCourse>();
  const add = (course: RecruitmentCourse, type: "ta" | "ula") => {
    const existing = byCode.get(course.enrollCode);
    const details = existing ?? course;
    byCode.set(course.enrollCode, {
      enrollCode: course.enrollCode,
      courseId: details.courseId,
      section: details.section,
      title: details.title,
      instructor: details.instructor,
      days: details.days,
      time: details.time,
      room: details.room,
      enrollment: details.enrollment,
      maxEnroll: details.maxEnroll,
      status: details.status,
      summerSession: details.summerSession,
      stale: details.stale,
      enrollmentEstimate:
        existing?.enrollmentEstimate ?? course.enrollmentEstimate ?? null,
      ta: existing?.ta,
      ula: existing?.ula,
      [type]: course,
    });
  };
  taCourses.forEach((course) => add(course, "ta"));
  ulaCourses.forEach((course) => add(course, "ula"));
  return [...byCode.values()].sort(
    (a, b) =>
      compare(a.courseId, b.courseId) ||
      compare(a.section, b.section) ||
      compare(a.enrollCode, b.enrollCode),
  );
};
