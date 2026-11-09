import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import type { RecruitmentCourse } from "main/components/Recruitments/RecruitmentCourseTable";
import type { DetailsColumn } from "main/components/Common/DetailsTable";
import type { CourseTargets } from "main/utils/courseTargets";

/** Shown while faculty reviews have not opened, in place of the ranking button. */
export const NOT_OPEN_NOTE =
  "Candidate rankings will be available when faculty reviews open.";

/**
 * A recruitment as /api/instructor/recruitments returns it: with the instructor's courses in it,
 * and, once the admin has released hiring targets (issue #224), each course's figures keyed by
 * course id; null or absent while withheld. `allocationsReleased` (issue #364) says outright
 * whether the admin has released this recruitment's allocations to faculty.
 */
export type InstructorRecruitment = Recruitment & {
  courses: RecruitmentCourse[];
  targets?: Record<string, CourseTargets> | null;
  allocationsReleased?: boolean;
};

/** A course's row in one recruitment, with the recruitment it is in. */
export type CourseInRecruitment = {
  recruitment: InstructorRecruitment;
  course: RecruitmentCourse;
};

/**
 * One course the instructor teaches in a quarter (issue #364): the same section in the quarter's
 * TA and ULA recruitments is one entry, with the row from each recruitment it is in. The
 * enrollment figures are the quarter's (one estimate per course per quarter, issue #363): the
 * estimate is taken from whichever row carries it, since a recruitment whose allocations are not
 * released blanks it.
 */
export type QuarterCourse = {
  /** The id of the TA row if there is one, else the ULA row's: for test ids and React keys. */
  id: number;
  courseId: string;
  section: string | null;
  title: string | null;
  enrollment: number | null;
  maxEnroll: number | null;
  enrollmentEstimate: number | null;
  ta?: CourseInRecruitment;
  ula?: CourseInRecruitment;
};

/** A quarter's card: its courses, course id then section, and which recruitments are in it. */
export type InstructorQuarter = {
  quarter: string;
  ta?: InstructorRecruitment;
  ula?: InstructorRecruitment;
  courses: QuarterCourse[];
};

/** Whether the admin has released this recruitment's allocations to faculty. */
export const isReleased = (recruitment: InstructorRecruitment): boolean =>
  recruitment.allocationsReleased === true;

/** Course id first, then section, nulls first: the order the backend uses. */
const compareCourses = (a: QuarterCourse, b: QuarterCourse): number =>
  a.courseId.localeCompare(b.courseId) ||
  (a.section ?? "").localeCompare(b.section ?? "");

/**
 * The instructor's recruitments regrouped by quarter, newest first (issue #364). A course in both
 * of a quarter's recruitments appears once; a quarter with no course does not appear. Anything that
 * is not a list of recruitments with lists of courses is treated as empty.
 */
export function groupByQuarter(
  recruitments: InstructorRecruitment[] | null | undefined,
): InstructorQuarter[] {
  if (!Array.isArray(recruitments)) {
    return [];
  }
  const byQuarter = new Map<string, InstructorQuarter>();
  for (const recruitment of recruitments) {
    const slot = recruitment.type === "ULA" ? "ula" : "ta";
    let quarter = byQuarter.get(recruitment.quarter);
    if (quarter === undefined) {
      quarter = { quarter: recruitment.quarter, courses: [] };
      byQuarter.set(recruitment.quarter, quarter);
    }
    quarter[slot] = recruitment;
    const courses = Array.isArray(recruitment.courses)
      ? recruitment.courses
      : [];
    for (const course of courses) {
      let entry = quarter.courses.find(
        (c) => c.courseId === course.courseId && c.section === course.section,
      );
      if (entry === undefined) {
        entry = {
          id: course.id,
          courseId: course.courseId,
          section: course.section,
          title: course.title,
          enrollment: course.enrollment,
          maxEnroll: course.maxEnroll,
          enrollmentEstimate: null,
        };
        quarter.courses.push(entry);
      }
      if (entry.enrollmentEstimate === null) {
        entry.enrollmentEstimate = course.enrollmentEstimate ?? null;
      }
      entry[slot] = { recruitment, course };
    }
  }
  const quarters = [...byQuarter.values()].filter(
    (quarter) => quarter.courses.length > 0,
  );
  for (const quarter of quarters) {
    quarter.courses.sort(compareCourses);
    // The TA row's id names a course in both recruitments, whichever order they came in.
    for (const course of quarter.courses) {
      course.id = (course.ta ?? course.ula)!.course.id;
    }
  }
  return quarters.sort((a, b) => b.quarter.localeCompare(a.quarter));
}

/** A number as a cell shows it: blank when there is none. */
const figure = (value: number | null | undefined): string =>
  value === null || value === undefined ? "" : String(value);

/**
 * What an allocation cell says while that recruitment's allocations are withheld, and what the
 * Enrollment Estimate cell says while neither recruitment's are (issue #410).
 */
export const ALLOCATION_TBD = "TBD";

/** What an allocation cell says when the course is in no recruitment of that type (issue #410). */
export const ALLOCATION_NA = "N/A";

/**
 * What the TA or ULA Allocation cell of a course shows (issue #410): the allocation (blank when
 * there is none) once that recruitment's allocations are released, TBD while they are withheld,
 * and N/A when the course is in no recruitment of that type.
 */
export const allocationCell = (
  entry: CourseInRecruitment | undefined,
): string =>
  entry === undefined
    ? ALLOCATION_NA
    : isReleased(entry.recruitment)
      ? figure(entry.course.allocation)
      : ALLOCATION_TBD;

/**
 * What the Enrollment Estimate cell of a course shows (issue #410): the quarter's estimate (blank
 * when there is none) once the allocations of either recruitment the course is in are released,
 * and TBD until then.
 */
export const estimateCell = (course: QuarterCourse): string =>
  [course.ta, course.ula].some(
    (entry) => entry !== undefined && isReleased(entry.recruitment),
  )
    ? figure(course.enrollmentEstimate)
    : ALLOCATION_TBD;

/**
 * The columns of a course's enrollment table (issue #364; always all six since issue #410):
 * Section, Enrolled, Max, Enrollment Estimate, TA Allocation and ULA Allocation, the last three
 * reading the number, TBD or N/A as `estimateCell` and `allocationCell` say.
 */
export function enrollmentColumns(
  course: QuarterCourse,
  testIdPrefix: string,
): DetailsColumn[] {
  const column = (
    label: string,
    value: string,
    testId: string,
  ): DetailsColumn => ({
    label,
    value,
    text: value,
    testId: `${testIdPrefix}-${testId}`,
  });
  return [
    column("Section", course.section ?? "", "section"),
    column("Enrolled", figure(course.enrollment), "enrolled"),
    column("Max", figure(course.maxEnroll), "max"),
    column("Enrollment Estimate", estimateCell(course), "enrollment-estimate"),
    column("TA Allocation", allocationCell(course.ta), "ta-allocation"),
    column("ULA Allocation", allocationCell(course.ula), "ula-allocation"),
  ];
}
