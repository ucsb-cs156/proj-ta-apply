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
