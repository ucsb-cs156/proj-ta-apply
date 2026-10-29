/**
 * The ULA questions the application form asks because the ULA Google Form asked them (issue
 * #72): their answer options, the labels the summary shows them back with, and the guidance text
 * the form shows beside them. Kept apart from the form so the summary and tests share one source.
 */

export type Option = { value: string; label: string };

/** A yes/no question; the form sends "true" or "false", or "" for unanswered. */
export const YES_NO_OPTIONS: Option[] = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

export const OTHER_CAMPUS_JOB_OPTIONS: Option[] = [
  { value: "YES", label: "Yes" },
  { value: "NO", label: "No" },
  { value: "NOT_SURE", label: "Not sure yet" },
];

export const STUDENT_STATUS_OPTIONS: Option[] = [
  { value: "UNDERGRADUATE", label: "Undergraduate" },
  { value: "GRADUATE", label: "Graduate" },
];

export const TRAINING_COMMITMENT_OPTIONS: Option[] = [
  { value: "AGREE", label: "I AGREE to this commitment." },
  {
    value: "UNSURE",
    label: "I am UNSURE if I can commit to this training at this point.",
  },
  { value: "CANNOT", label: "I CANNOT commit to this training at this point." },
];

/** The label for a stored enum value; blank for null or a value the list does not know. */
export const labelOf = (options: Option[], value: unknown): string =>
  options.find((option) => option.value === String(value))?.label ?? "";

/** Yes, No or blank for a nullable boolean. */
export const yesNoLabel = (value: boolean | null | undefined): string =>
  value === true ? "Yes" : value === false ? "No" : "";

/** A nullable boolean as the form's select value. */
export const booleanToSelect = (value: boolean | null | undefined): string =>
  value === true ? "true" : value === false ? "false" : "";

/** The form's select value as the payload's nullable boolean. */
export const selectToBoolean = (value: string): boolean | null =>
  value === "true" ? true : value === "false" ? false : null;

/** The perm number rule the backend enforces too: exactly 7 letters or digits. */
export const PERM_NUMBER_PATTERN = /^[A-Za-z0-9]{7}$/;

export const PERM_NUMBER_HINT =
  "7 characters, letters and digits only, no dash. Lower case is stored as upper case.";

// ---- guidance, as worded on the Google Form ----

export const GRADUATION_NOTE =
  "Your best guess of the earliest quarter you could graduate; it does not have to be exact. If you will graduate before the quarter you are applying for, you are not eligible to serve as a ULA in it.";

export const BS_MS_QUESTION =
  "Have you been accepted to, or are you considering applying to, a BS/MS degree program at UCSB?";

export const STUDENT_STATUS_QUESTION =
  "Will you be in undergraduate or graduate student status during the quarter for which you are applying to be a ULA?";

export const GRADUATE_WARNING =
  "The department does not have funding to hire graduate students for ULA positions; only students in undergraduate status are considered. If you will be in graduate status, you are strongly encouraged to apply to be a TA instead.";

export const TA_ELIGIBILITY_QUESTION =
  "Do you want to be eligible for TA positions in the future, and if so, will you enroll in the TA training course the next time it is offered in Fall?";

export const TA_ELIGIBILITY_NOTE =
  "You will not be eligible for TA positions unless and until you take this training course, which is offered only in Fall and requires both the campus and the departmental training.";

export const EMPLOYMENT_INTRO =
  "Your answers here do not affect the decision on your application; they let us start the hiring paperwork sooner if you are offered a position.";

export const OTHER_CAMPUS_JOB_QUESTION =
  "Will you have another job at UCSB, or work for another UC campus (including UCOP), during the quarter you are applying for?";

export const PRIOR_EMPLOYMENT_QUESTION =
  "Are you now, or have you ever been, employed at UCSB in any position where you received a paycheck from the University of California?";

export const EMPLOYEE_ID_NOTE =
  "Log into UCPath (https://www.ucpath.ucsb.edu/) and look up your employee ID. It is NOT your perm number and NOT your SSN; if you cannot find it, leave this blank.";

export const I9_QUESTION =
  "Have you made, or will you make, an appointment to complete the I-9 employment verification?";

export const TRAINING_STATEMENT =
  "First-time ULAs are required to attend five mandatory training sessions in the first weeks of the quarter, on Fridays from 1:00 pm to 1:50 pm. Absences are not excused for personal reasons such as hackathons or weddings, and a course that meets at that time is not permitted; if you register for one you may be asked to leave the ULA program. Absences for illness or a true emergency are dealt with case by case.";

export const TRAINING_EXPLANATION_PROMPT =
  "Since you are unsure or cannot commit to this training, please explain.";

export const CHANGING_MAJOR_QUESTION =
  "If your major is not CS, CE or CCS Computing, are you trying to change into one of them, or add one as a second major?";

export const VIDEO_GUIDANCE =
  "First-time applicants: please provide a link to a short video of a teaching demo; see https://bit.ly/ucsb-cs-la-program-application for how to prepare it. For returning ULAs it is optional but strongly encouraged, and reusing one from an earlier application is fine. Instructors use these when choosing among candidates they do not know.";

export const COURSE_PREFERENCES_GUIDANCE =
  "For each course, choose Enthusiastic if you would be glad to be assigned to it, Would Consider if you would take it when nothing else is available, and Not Applicable if you have no interest or are not qualified. To be a ULA for a course you must have taken it, or its equivalent, with a B or better, or be able to show thorough knowledge of the material another way; choose Not Applicable where that does not hold. A listed course is not a promise that ULAs will be assigned to it.";
