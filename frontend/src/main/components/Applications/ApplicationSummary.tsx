import type { Application } from "main/components/Applications/ApplicationTable";
import NoticeAgreement from "main/components/Notices/NoticeAgreement";
import PriorCourseworkTable from "main/components/PriorCoursework/PriorCourseworkTable";
import { courseInterestLabel } from "main/utils/applicationFields";
import type { NoticeVersion } from "main/utils/notices";
import {
  OTHER_CAMPUS_JOB_OPTIONS,
  STUDENT_STATUS_OPTIONS,
  TRAINING_COMMITMENT_OPTIONS,
  labelOf,
  yesNoLabel,
} from "main/utils/ulaQuestions";

type ApplicationSummaryProps = {
  application: Application;
  /** TA and ULA ask different questions, so only the relevant ones are shown back. */
  type: "TA" | "ULA";
  /** The notice version the applicant agreed to, if the caller has it; shown back ticked. */
  notice?: NoticeVersion | null;
  testIdPrefix?: string;
};

const RESIDENCY_LABELS: Record<string, string> = {
  US_CITIZEN: "US Citizen",
  US_RESIDENT: "US Permanent Resident",
  F1_STUDENT_VISA: "F1 Student Visa",
  J1_STUDENT_VISA: "J1 Student Visa",
  OTHER: "Other",
};

const LANGUAGE_EXAM_LABELS: Record<string, string> = {
  EXEMPT_US_CITIZEN: "exempt (U.S. Citizen)",
  PASSED_US_PERMANENT_RESIDENT: "passed (U.S. Perm. Resident)",
  PASSED_F1_OR_J1_VISA: "passed (F1 or J1 visa)",
  NOT_PASSED: "not passed",
};

const CLASS_LEVEL_LABELS: Record<string, string> = { PHD: "PhD", MS: "MS" };

/** Blank rather than "null"; an unanswered question should read as unanswered. */
const show = (value: unknown): string =>
  value === null || value === undefined || value === "" ? "" : String(value);

const yesNo = (value: boolean): string => (value ? "Yes" : "No");

/**
 * One line per course, padded course id first so they line up, in course order. The map holds
 * only courses the applicant marked, so an empty map reads as blank, like any other unanswered
 * question.
 */
const otherCourses = (interests: Record<string, string> | null): string => {
  const marked = interests ?? {};
  return Object.keys(marked)
    .sort()
    .map((courseId) => `${courseId}  ${courseInterestLabel(marked[courseId])}`)
    .join("\n");
};

/** One line per answered name, in name order, each "name: level / top"; an empty map is blank. */
const levelLines = (
  levels: Record<string, number> | null,
  top: number,
): string => {
  const answered = levels ?? {};
  return Object.keys(answered)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => `${name}: ${answered[name]} / ${top}`)
    .join("\n");
};

/** What the applicant submitted, shown back once the application can no longer be edited. */
export default function ApplicationSummary({
  application,
  type,
  notice = null,
  testIdPrefix = "ApplicationSummary",
}: ApplicationSummaryProps): React.JSX.Element {
  const isTa = type === "TA";

  const rows: { label: string; value: string; mono?: boolean }[] = [
    {
      label: "Name",
      value: [
        application.firstName,
        application.middleName,
        application.lastName,
      ]
        .filter((part) => show(part) !== "")
        .join(" "),
    },
    { label: "Major", value: show(application.major) },
    { label: "GPA in Major", value: show(application.gpaMajor) },
    { label: "Overall GPA", value: show(application.gpaOverall) },
    { label: "Year in Program", value: show(application.yearInProgram) },
    { label: "Expected Graduation", value: show(application.graduationDate) },
  ];

  if (isTa) {
    rows.push(
      {
        label: "Class Level",
        value: CLASS_LEVEL_LABELS[show(application.classLevel)] ?? "",
      },
      {
        label: "Residency Status",
        value: RESIDENCY_LABELS[show(application.residencyStatus)] ?? "",
      },
      {
        label: "TA Language Exam",
        value: LANGUAGE_EXAM_LABELS[show(application.languageExam)] ?? "",
      },
      {
        label: "Quarter and Year Language Exam Passed",
        value: show(application.languageExamDatePassed),
      },
    );
  } else {
    rows.push(
      { label: "Perm Number", value: show(application.permNumber) },
      {
        label: "Quarters Previously Served as a ULA",
        value: show(application.previousServiceAsUla),
      },
      { label: "Video Link", value: show(application.videoLink) },
      { label: "Changing Major", value: yesNoLabel(application.changingMajor) },
      { label: "BS/MS Student", value: yesNoLabel(application.bsMsStudent) },
      {
        label: "Student Status in the Quarter Applied For",
        value: labelOf(
          STUDENT_STATUS_OPTIONS,
          application.studentStatusNextQuarter,
        ),
      },
      {
        label: "Wants TA Eligibility (Fall TA Training)",
        value: yesNoLabel(application.wantsTaEligibility),
      },
      {
        label: "Other Campus Job",
        value: labelOf(OTHER_CAMPUS_JOB_OPTIONS, application.otherCampusJob),
      },
      {
        label: "Prior UCSB Employment",
        value: yesNoLabel(application.priorUcsbEmployment),
      },
      { label: "Employee ID", value: show(application.employeeId) },
      {
        label: "I-9 Verification Agreement",
        value: yesNoLabel(application.i9Appointment),
      },
      {
        label: "Training Commitment",
        value: labelOf(
          TRAINING_COMMITMENT_OPTIONS,
          application.trainingCommitment,
        ),
      },
      {
        label: "Training Commitment Explanation",
        value: show(application.trainingCommitmentExplanation),
      },
    );
  }

  rows.push({
    label: isTa
      ? "Topic Proficiency (1 lowest to 5 highest)"
      : "Topic Proficiency (1 very comfortable to 3 not familiar)",
    value: levelLines(application.topicProficiencies, isTa ? 5 : 3),
    mono: true,
  });
  if (!isTa) {
    rows.push({
      label: "Interests (1 not interested to 5 very interested)",
      value: levelLines(application.interests, 5),
      mono: true,
    });
  }
  // Only the ULA form asks about availability (issue #76).
  const availability = (choice: "First" | "Second") =>
    isTa
      ? []
      : [
          {
            label: `Available for a ${choice} Choice Lecture`,
            value: yesNo(
              choice === "First"
                ? application.availableForLecturesFirstChoice
                : application.availableForLecturesSecondChoice,
            ),
          },
          {
            label: `Available for a ${choice} Choice Discussion`,
            value: yesNo(
              choice === "First"
                ? application.availableForDiscussionFirstChoice
                : application.availableForDiscussionSecondChoice,
            ),
          },
          {
            label: `${choice} Choice Availability Comments`,
            value: show(
              choice === "First"
                ? application.availabilityCommentsFirstChoice
                : application.availabilityCommentsSecondChoice,
            ),
          },
        ];
  rows.push(
    {
      label: "Previous Teaching Experience",
      value: show(application.prevExperience),
    },
    {
      label: "First Choice Course",
      value: show(application.firstChoiceCourse),
      mono: true,
    },
    ...availability("First"),
    {
      label: "Second Choice Course",
      value: show(application.secondChoiceCourse),
      mono: true,
    },
    ...availability("Second"),
    {
      label: "Other Courses of Interest",
      value: otherCourses(application.courseInterests),
      mono: true,
    },
    { label: "Anything Else", value: show(application.comments) },
  );

  return (
    <>
      {/* First, as on the form itself (issue #77). */}
      <NoticeAgreement
        notice={notice}
        agreed={application.noticeVersionId === notice?.id}
        onChange={() => {}}
        readOnly
        testIdPrefix={`${testIdPrefix}-notice`}
      />
      <dl className="row" data-testid={testIdPrefix}>
        {rows.map((row) => (
          <div className="row mb-1" key={row.label}>
            <dt className="col-sm-4">{row.label}</dt>
            <dd
              className="col-sm-8"
              data-testid={`${testIdPrefix}-${row.label}`}
              style={
                row.mono
                  ? { whiteSpace: "pre", fontFamily: "monospace" }
                  : undefined
              }
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      <h3 className="h6 mt-3">Prior Coursework</h3>
      {(application.priorCoursework ?? []).length === 0 ? (
        <p
          className="text-muted small"
          data-testid={`${testIdPrefix}-coursework-none`}
        >
          No courses listed.
        </p>
      ) : (
        <PriorCourseworkTable
          courses={application.priorCoursework}
          onEdit={() => {}}
          onDelete={() => {}}
          readOnly
          testIdPrefix={`${testIdPrefix}-coursework`}
        />
      )}
    </>
  );
}
