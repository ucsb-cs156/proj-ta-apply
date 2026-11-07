import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import type { RecruitmentCourse } from "main/components/Recruitments/RecruitmentCourseTable";
import type { DetailsColumn } from "main/components/Common/DetailsTable";
import type { CourseTargets } from "main/utils/courseTargets";

/** Where faculty will one day comment on their allocations (issue #364); the feature is later. */
export const FEEDBACK_PLACEHOLDER =
  "Coming soon: the ability for faculty to provide feedback on allocations of TA/ULAs to their courses";

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
 * The columns of a course's enrollment table (issue #364): Section, Enrolled and Max always; the
 * quarter's Enrollment Estimate once the allocations of either recruitment the course is in are
 * released; and the TA and ULA Allocation each once its recruitment's allocations are released. So
 * three, five or six columns.
 */
export function enrollmentColumns(
  course: QuarterCourse,
  testIdPrefix: string,
): DetailsColumn[] {
  // The TA and ULA rows of the course, only while their recruitment's allocations are released.
  const ta =
    course.ta && isReleased(course.ta.recruitment) ? course.ta : undefined;
  const ula =
    course.ula && isReleased(course.ula.recruitment) ? course.ula : undefined;
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
  const columns = [
    column("Section", course.section ?? "", "section"),
    column("Enrolled", figure(course.enrollment), "enrolled"),
    column("Max", figure(course.maxEnroll), "max"),
  ];
  if (ta || ula) {
    columns.push(
      column(
        "Enrollment Estimate",
        figure(course.enrollmentEstimate),
        "enrollment-estimate",
      ),
    );
  }
  if (ta) {
    columns.push(
      column("TA Allocation", figure(ta.course.allocation), "ta-allocation"),
    );
  }
  if (ula) {
    columns.push(
      column("ULA Allocation", figure(ula.course.allocation), "ula-allocation"),
    );
  }
  return columns;
}
