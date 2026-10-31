import type { Application } from "main/components/Applications/ApplicationTable";
import { submittedText } from "main/utils/adminApplications";
import {
  CLASS_LEVEL_LABELS,
  LANGUAGE_EXAM_LABELS,
  RESIDENCY_LABELS,
} from "main/utils/applicationLabels";
import { courseInterestLabel } from "main/utils/applicationFields";
import {
  OTHER_CAMPUS_JOB_OPTIONS,
  STUDENT_STATUS_OPTIONS,
  TRAINING_COMMITMENT_OPTIONS,
  labelOf,
  yesNoLabel,
} from "main/utils/ulaQuestions";

/**
 * The columns of the admin's applications table (issue #189): which exist for a TA or ULA
 * recruitment, which start hidden, and how each answer is shown. The id, View, Edit and Name
 * columns are rendered by the table itself and can never be hidden; everything else is listed
 * here and offered in the Columns menu.
 */

/** The table's key in the hidden-columns table. */
export const APPLICATIONS_TABLE_KEY = "recruitmentApplications";

/**
 * A pseudo column id kept on file once a recruitment's defaults have been written, so that an
 * admin who later shows every column is not given the defaults again. Never offered in the menu.
 */
export const DEFAULTS_MARKER = "_defaultsApplied";

export type ApplicationType = "TA" | "ULA";

export type ApplicationColumn = {
  id: string;
  label: string;
  /** A heading on two lines, when the label is long and the values short. */
  stacked?: [string, string];
  /** Only for recruitments of these types; both when absent. */
  types?: ApplicationType[];
  /** Hidden until the admin shows it; the columns the table always had start shown. */
  defaultHidden: boolean;
  /** Narrow columns shrink to their content; the rest take their natural width. */
  shrink: boolean;
  value: (application: Application) => string;
};

/** Blank rather than "null", like the summary. */
export const show = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value);

/** "CMPSC     8 Enthusiastic; CMPSC    16 Would consider", in course order; blank when none. */
export const courseInterestsText = (
  interests: Record<string, string> | null | undefined,
): string => {
  const marked = interests ?? {};
  return Object.keys(marked)
    .sort()
    .map((courseId) => `${courseId} ${courseInterestLabel(marked[courseId])}`)
    .join("; ");
};

/** "Java 5; React 3", in name order; blank when none. */
export const levelsText = (
  levels: Record<string, number> | null | undefined,
): string => {
  const rated = levels ?? {};
  return Object.keys(rated)
    .sort()
    .map((name) => `${name} ${rated[name]}`)
    .join("; ");
};

/** "2/3/2026, 4:05:00 AM: Found other employment" for a cancelled application; blank otherwise. */
export const cancelledText = (application: Application): string =>
  application.status === "CANCELLED"
    ? `${submittedText(application.cancelledAt)}: ${show(application.cancellationReason)}`
    : "";

const column = (
  id: string,
  label: string,
  defaultHidden: boolean,
  value: (application: Application) => string,
  extra: Partial<ApplicationColumn> = {},
): ApplicationColumn => ({
  id,
  label,
  defaultHidden,
  shrink: true,
  value,
  ...extra,
});

const TA: ApplicationType[] = ["TA"];
const ULA: ApplicationType[] = ["ULA"];

/** Every hideable column, for both types, in table order. */
export const ALL_APPLICATION_COLUMNS: ApplicationColumn[] = [
  column("submittedAt", "Submitted", false, (a) =>
    submittedText(a.submittedAt),
  ),
  column("email", "Email", false, (a) => show(a.email)),
  column("major", "Major", false, (a) => show(a.major)),
  column(
    "classLevel",
    "Level",
    false,
    (a) => CLASS_LEVEL_LABELS[show(a.classLevel)] ?? "",
    { types: TA },
  ),
  // Always on the ULA table; new, and so hidden at first, on the TA one (see defaultHiddenColumns).
  column(
    "graduationDate",
    "Expected Graduation",
    false,
    (a) => show(a.graduationDate),
    { stacked: ["Expected", "Graduation"] },
  ),
  column("status", "Status", true, (a) => show(a.status)),
  column("gpaMajor", "GPA in Major", true, (a) => show(a.gpaMajor), {
    stacked: ["GPA in", "Major"],
  }),
  column("gpaOverall", "Overall GPA", true, (a) => show(a.gpaOverall), {
    stacked: ["Overall", "GPA"],
  }),
  column(
    "yearInProgram",
    "Year in Program",
    true,
    (a) => show(a.yearInProgram),
    {
      stacked: ["Year in", "Program"],
    },
  ),
  column(
    "residencyStatus",
    "Residency Status",
    true,
    (a) => RESIDENCY_LABELS[show(a.residencyStatus)] ?? "",
    { types: TA, stacked: ["Residency", "Status"] },
  ),
  column(
    "languageExam",
    "TA Language Exam",
    true,
    (a) => LANGUAGE_EXAM_LABELS[show(a.languageExam)] ?? "",
    { types: TA, stacked: ["TA Language", "Exam"] },
  ),
  column(
    "languageExamDatePassed",
    "Language Exam Passed",
    true,
    (a) => show(a.languageExamDatePassed),
    { types: TA, stacked: ["Language Exam", "Passed"] },
  ),
  column("permNumber", "Perm Number", true, (a) => show(a.permNumber), {
    types: ULA,
  }),
  column(
    "previousServiceAsUla",
    "Quarters as ULA",
    true,
    (a) => show(a.previousServiceAsUla),
    { types: ULA, stacked: ["Quarters", "as ULA"] },
  ),
  column("videoLink", "Video Link", true, (a) => show(a.videoLink), {
    types: ULA,
  }),
  column(
    "changingMajor",
    "Changing Major",
    true,
    (a) => yesNoLabel(a.changingMajor),
    { types: ULA, stacked: ["Changing", "Major"] },
  ),
  column(
    "bsMsStudent",
    "BS/MS Student",
    true,
    (a) => yesNoLabel(a.bsMsStudent),
    {
      types: ULA,
      stacked: ["BS/MS", "Student"],
    },
  ),
  column(
    "studentStatusNextQuarter",
    "Student Status",
    true,
    (a) => labelOf(STUDENT_STATUS_OPTIONS, a.studentStatusNextQuarter),
    { types: ULA, stacked: ["Student", "Status"] },
  ),
  column(
    "wantsTaEligibility",
    "Wants TA Eligibility",
    true,
    (a) => yesNoLabel(a.wantsTaEligibility),
    { types: ULA, stacked: ["Wants TA", "Eligibility"] },
  ),
  column(
    "otherCampusJob",
    "Other Campus Job",
    true,
    (a) => labelOf(OTHER_CAMPUS_JOB_OPTIONS, a.otherCampusJob),
    { types: ULA, stacked: ["Other", "Campus Job"] },
  ),
  column(
    "priorUcsbEmployment",
    "Prior UCSB Employment",
    true,
    (a) => yesNoLabel(a.priorUcsbEmployment),
    { types: ULA, stacked: ["Prior UCSB", "Employment"] },
  ),
  column("employeeId", "Employee ID", true, (a) => show(a.employeeId), {
    types: ULA,
  }),
  column(
    "i9Appointment",
    "I-9 Agreement",
    true,
    (a) => yesNoLabel(a.i9Appointment),
    { types: ULA, stacked: ["I-9", "Agreement"] },
  ),
  column(
    "trainingCommitment",
    "Training Commitment",
    true,
    (a) => labelOf(TRAINING_COMMITMENT_OPTIONS, a.trainingCommitment),
    { types: ULA, stacked: ["Training", "Commitment"] },
  ),
  column(
    "trainingCommitmentExplanation",
    "Training Explanation",
    true,
    (a) => show(a.trainingCommitmentExplanation),
    { types: ULA, shrink: false },
  ),
  column(
    "firstChoiceCourse",
    "First Choice",
    true,
    (a) => show(a.firstChoiceCourse),
    { stacked: ["First", "Choice"] },
  ),
  column(
    "secondChoiceCourse",
    "Second Choice",
    true,
    (a) => show(a.secondChoiceCourse),
    { stacked: ["Second", "Choice"] },
  ),
  column(
    "availableForLecturesFirstChoice",
    "Lecture (1st)",
    true,
    (a) => yesNoLabel(a.availableForLecturesFirstChoice),
    { types: TA, stacked: ["Lecture", "(1st)"] },
  ),
  column(
    "availableForDiscussionFirstChoice",
    "Discussion (1st)",
    true,
    (a) => yesNoLabel(a.availableForDiscussionFirstChoice),
    { types: TA, stacked: ["Discussion", "(1st)"] },
  ),
  column(
    "availabilityCommentsFirstChoice",
    "Availability (1st)",
    true,
    (a) => show(a.availabilityCommentsFirstChoice),
    { types: TA, shrink: false },
  ),
  column(
    "availableForLecturesSecondChoice",
    "Lecture (2nd)",
    true,
    (a) => yesNoLabel(a.availableForLecturesSecondChoice),
    { types: TA, stacked: ["Lecture", "(2nd)"] },
  ),
  column(
    "availableForDiscussionSecondChoice",
    "Discussion (2nd)",
    true,
    (a) => yesNoLabel(a.availableForDiscussionSecondChoice),
    { types: TA, stacked: ["Discussion", "(2nd)"] },
  ),
  column(
    "availabilityCommentsSecondChoice",
    "Availability (2nd)",
    true,
    (a) => show(a.availabilityCommentsSecondChoice),
    { types: TA, shrink: false },
  ),
  column(
    "courseInterests",
    "Other Courses of Interest",
    true,
    (a) => courseInterestsText(a.courseInterests),
    { shrink: false },
  ),
  column(
    "topicProficiencies",
    "Topic Proficiencies",
    true,
    (a) => levelsText(a.topicProficiencies),
    { shrink: false },
  ),
  column("interests", "Interests", true, (a) => levelsText(a.interests), {
    types: ULA,
    shrink: false,
  }),
  column(
    "prevExperience",
    "Previous Experience",
    true,
    (a) => show(a.prevExperience),
    { shrink: false },
  ),
  column("comments", "Anything Else", true, (a) => show(a.comments), {
    shrink: false,
  }),
  column(
    "postApplicationComments",
    "Post-Application Comments",
    true,
    (a) => show(a.postApplicationComments),
    { shrink: false },
  ),
  column(
    "adminComments",
    "Admin Comments",
    true,
    (a) => show(a.adminComments),
    {
      shrink: false,
    },
  ),
  column("cancelled", "Cancelled", true, cancelledText, { shrink: false }),
  column(
    "noticeVersionId",
    "Notice Version",
    true,
    (a) => show(a.noticeVersionId),
    { stacked: ["Notice", "Version"] },
  ),
];

/** The hideable columns of a recruitment of the given type, in table order. */
export const applicationColumns = (
  type: ApplicationType,
): ApplicationColumn[] =>
  ALL_APPLICATION_COLUMNS.filter(
    (c) => c.types === undefined || c.types.includes(type),
  );

/** What the Columns menu offers: every hideable column's id and label. */
export const applicationColumnChoices = (
  type: ApplicationType,
): { id: string; label: string }[] =>
  applicationColumns(type).map(({ id, label }) => ({ id, label }));

/**
 * The ids hidden until an admin shows them, plus the marker that says the defaults have been
 * written. Expected Graduation starts hidden on a TA table only: the ULA table always had it.
 */
export const defaultHiddenColumns = (type: ApplicationType): string[] => [
  ...applicationColumns(type)
    .filter(
      (c) => c.defaultHidden || (c.id === "graduationDate" && type === "TA"),
    )
    .map((c) => c.id),
  DEFAULTS_MARKER,
];
