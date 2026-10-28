export type CourseInterestValue =
  "ENTHUSIASTIC" | "WOULD_CONSIDER" | "NOT_INTERESTED";

/** The three answers offered for each course other than the first and second choice, in order. */
export const COURSE_INTEREST_OPTIONS: {
  value: CourseInterestValue;
  label: string;
}[] = [
  { value: "ENTHUSIASTIC", label: "Enthusiastic" },
  { value: "WOULD_CONSIDER", label: "Would Consider" },
  { value: "NOT_INTERESTED", label: "Not Applicable / Not Interested" },
];

/** The answer for every course the applicant says nothing about. Never sent or stored. */
export const DEFAULT_COURSE_INTEREST: CourseInterestValue = "NOT_INTERESTED";

/** The label for a stored interest code; blank for one that is not recognised. */
export const courseInterestLabel = (value: string): string =>
  COURSE_INTEREST_OPTIONS.find((option) => option.value === value)?.label ?? "";

/** The lowest and highest self-rating an applicant can give for a topic. */
export const MIN_PROFICIENCY = 1;
export const MAX_PROFICIENCY = 5;

/** 1 through 5, in order, for the radio buttons beside each topic. */
export const PROFICIENCY_LEVELS: number[] = [1, 2, 3, 4, 5];

/** The option value that means "my major is not on the list"; never stored. */
export const OTHER_MAJOR = "__OTHER__";

/** The admin-maintained lists the form for one recruitment offers, from /api/recruitments/options. */
export type ApplicationOptions = { majors: string[]; topics: string[] };

export const EMPTY_OPTIONS: ApplicationOptions = { majors: [], topics: [] };

/** Everything the applicant may set. Deliberately not the whole entity: status is not theirs. */
export type ApplicationFormFields = {
  firstName: string;
  middleName: string;
  lastName: string;
  major: string;
  gpaMajor: string;
  gpaOverall: string;
  yearInProgram: string;
  graduationDate: string;
  courseworkUcsb: string;
  /** Topic name to self-rated proficiency 1..5, only for topics the applicant rated. */
  topicProficiencies: Record<string, number>;
  prevExperience: string;
  comments: string;
  firstChoiceCourse: string;
  secondChoiceCourse: string;
  availableForLecturesFirstChoice: boolean;
  availableForLecturesSecondChoice: boolean;
  availableForDiscussionFirstChoice: boolean;
  availableForDiscussionSecondChoice: boolean;
  availabilityCommentsFirstChoice: string;
  availabilityCommentsSecondChoice: string;
  /** Course id to interest, one entry per course the form showed, defaults included. */
  courseInterests: Record<string, string>;
  residencyStatus: string;
  languageExam: string;
  languageExamDatePassed: string;
  classLevel: string;
  courseworkOther: string;
  coursework290: string;
  videoLink: string;
  previousServiceAsUla: string;
  /** The notice version the applicant ticked the box for; null when no notice is shown. */
  noticeVersionId: number | null;
};

/** The shape the API takes, once the numeric answers are numbers again. */
export type ApplicationPayload = Omit<
  ApplicationFormFields,
  | "gpaMajor"
  | "gpaOverall"
  | "previousServiceAsUla"
  | "languageExamDatePassed"
  | "residencyStatus"
  | "languageExam"
  | "classLevel"
> & {
  gpaMajor: number | null;
  gpaOverall: number | null;
  previousServiceAsUla: number | null;
  languageExamDatePassed: string | null;
  residencyStatus: string | null;
  languageExam: string | null;
  classLevel: string | null;
};

/** An empty answer is no answer, not zero. */
const asNumber = (value: string): number | null =>
  value === "" || value === null || value === undefined ? null : Number(value);

/**
 * An unchosen dropdown or an unfilled date reads as "" in the DOM, and the backend cannot coerce
 * that into an enum or a date. No answer is null.
 */
const orNull = (value: string): string | null => (value === "" ? null : value);

/**
 * Only the answers that say something. NOT_INTERESTED is the default, so sending it would only
 * pad the table, and the first and second choice have their own fields: the form never asks about
 * them, but an answer given before a course was chosen must not go with it.
 */
const interestsWorthSending = (
  data: ApplicationFormFields,
): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const [courseId, interest] of Object.entries(data.courseInterests)) {
    if (
      interest !== DEFAULT_COURSE_INTEREST &&
      courseId !== data.firstChoiceCourse &&
      courseId !== data.secondChoiceCourse
    ) {
      result[courseId] = interest;
    }
  }
  return result;
};

export function toPayload(data: ApplicationFormFields): ApplicationPayload {
  return {
    ...data,
    courseInterests: interestsWorthSending(data),
    gpaMajor: asNumber(data.gpaMajor),
    gpaOverall: asNumber(data.gpaOverall),
    previousServiceAsUla: asNumber(data.previousServiceAsUla),
    languageExamDatePassed: orNull(data.languageExamDatePassed),
    residencyStatus: orNull(data.residencyStatus),
    languageExam: orNull(data.languageExam),
    classLevel: orNull(data.classLevel),
  };
}
