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
  knowledge: string;
  prevExperience: string;
  desiredCourses: string;
  comments: string;
  firstChoiceCourse: string;
  secondChoiceCourse: string;
  availableForLecturesFirstChoice: boolean;
  availableForLecturesSecondChoice: boolean;
  availableForDiscussionFirstChoice: boolean;
  availableForDiscussionSecondChoice: boolean;
  residencyStatus: string;
  languageExam: string;
  languageExamDatePassed: string;
  classLevel: string;
  courseworkOther: string;
  coursework290: string;
  videoLink: string;
  previousServiceAsUla: string;
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

export function toPayload(data: ApplicationFormFields): ApplicationPayload {
  return {
    ...data,
    gpaMajor: asNumber(data.gpaMajor),
    gpaOverall: asNumber(data.gpaOverall),
    previousServiceAsUla: asNumber(data.previousServiceAsUla),
    languageExamDatePassed: orNull(data.languageExamDatePassed),
    residencyStatus: orNull(data.residencyStatus),
    languageExam: orNull(data.languageExam),
    classLevel: orNull(data.classLevel),
  };
}
