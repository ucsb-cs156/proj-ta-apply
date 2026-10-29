import type { PriorCourse } from "main/utils/priorCoursework";
import { selectToBoolean } from "main/utils/ulaQuestions";

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

/** One radio button on a rating scale: the stored number and the column heading above it. */
export type ScaleLevel = { value: number; label: string };

/** The lowest self-rating an applicant can give for a topic, on either form. */
export const MIN_PROFICIENCY = 1;

/** A TA applicant rates each topic 1 (lowest) to 5 (highest); the headings are the numbers. */
export const TA_PROFICIENCY_LEVELS: ScaleLevel[] = [1, 2, 3, 4, 5].map(
  (value) => ({ value, label: String(value) }),
);

/** A ULA applicant rates each topic on three levels, worded so that 1 is the most comfortable. */
export const ULA_PROFICIENCY_LEVELS: ScaleLevel[] = [
  { value: 1, label: "1-Very comfortable" },
  { value: 2, label: "2-Somewhat comfortable" },
  { value: 3, label: "3-Not familiar" },
];

/** The topic scale for a form type. */
export const proficiencyLevels = (type: "TA" | "ULA"): ScaleLevel[] =>
  type === "TA" ? TA_PROFICIENCY_LEVELS : ULA_PROFICIENCY_LEVELS;

/** The instruction above the topic table for a form type. */
export const proficiencyInstruction = (type: "TA" | "ULA"): string =>
  type === "TA"
    ? "Choose a level of proficiency, with 1 being the lowest, and 5 being the highest."
    : "For each topic, choose 1 if you are very comfortable with it, 2 if somewhat comfortable, or 3 if you are not familiar with it.";

/** A ULA applicant rates each interest area 1 (not interested) to 5 (very interested). */
export const INTEREST_LEVELS: ScaleLevel[] = [
  { value: 1, label: "1-Not interested" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5-Very interested" },
];

/** The option value that means "my major is not on the list"; never stored. */
export const OTHER_MAJOR = "__OTHER__";

/**
 * The admin-maintained lists the form for one recruitment offers, from /api/recruitments/options.
 * Only a ULA recruitment has interests; a TA one sends an empty list.
 */
export type ApplicationOptions = {
  majors: string[];
  topics: string[];
  interests: string[];
};

export const EMPTY_OPTIONS: ApplicationOptions = {
  majors: [],
  topics: [],
  interests: [],
};

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
  /** The courses listed as relevant background, in order; see utils/priorCoursework. */
  priorCoursework: PriorCourse[];
  /** Topic name to self-rated proficiency (1..5 on a TA form, 1..3 on a ULA one), rated ones only. */
  topicProficiencies: Record<string, number>;
  /** ULA only: interest area to level 1..5, for the areas the applicant answered. */
  interests: Record<string, number>;
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
  videoLink: string;
  previousServiceAsUla: string;
  // ---- ULA only, from the Google Form (issue #72); the yes/no ones hold "true", "false" or "" ----
  permNumber: string;
  bsMsStudent: string;
  studentStatusNextQuarter: string;
  wantsTaEligibility: string;
  otherCampusJob: string;
  priorUcsbEmployment: string;
  employeeId: string;
  i9Appointment: string;
  trainingCommitment: string;
  trainingCommitmentExplanation: string;
  changingMajor: string;
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
  | "bsMsStudent"
  | "studentStatusNextQuarter"
  | "wantsTaEligibility"
  | "otherCampusJob"
  | "priorUcsbEmployment"
  | "i9Appointment"
  | "trainingCommitment"
  | "changingMajor"
> & {
  gpaMajor: number | null;
  gpaOverall: number | null;
  previousServiceAsUla: number | null;
  languageExamDatePassed: string | null;
  residencyStatus: string | null;
  languageExam: string | null;
  classLevel: string | null;
  bsMsStudent: boolean | null;
  studentStatusNextQuarter: string | null;
  wantsTaEligibility: boolean | null;
  otherCampusJob: string | null;
  priorUcsbEmployment: boolean | null;
  i9Appointment: boolean | null;
  trainingCommitment: string | null;
  changingMajor: boolean | null;
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
    bsMsStudent: selectToBoolean(data.bsMsStudent),
    studentStatusNextQuarter: orNull(data.studentStatusNextQuarter),
    wantsTaEligibility: selectToBoolean(data.wantsTaEligibility),
    otherCampusJob: orNull(data.otherCampusJob),
    priorUcsbEmployment: selectToBoolean(data.priorUcsbEmployment),
    i9Appointment: selectToBoolean(data.i9Appointment),
    trainingCommitment: orNull(data.trainingCommitment),
    changingMajor: selectToBoolean(data.changingMajor),
  };
}
