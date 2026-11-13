import type { Application } from "main/components/Applications/ApplicationTable";
import type { DraftApplication } from "main/utils/draftApplications";
import NoticeAgreement from "main/components/Notices/NoticeAgreement";
import PriorCourseworkTable from "main/components/PriorCoursework/PriorCourseworkTable";
import { submittedText } from "main/utils/adminApplications";
import {
  CourseInterestTable,
  LevelTable,
} from "main/components/Applications/SelectionTables";
import {
  DEFAULT_COURSE_INTEREST,
  INTEREST_LEVELS,
  gpaText,
  proficiencyLevels,
} from "main/utils/applicationFields";
import { rowSlug } from "main/utils/formTableLayout";
import {
  CLASS_LEVEL_LABELS,
  LANGUAGE_EXAM_LABELS,
  RESIDENCY_LABELS,
} from "main/utils/applicationLabels";
import type { NoticeVersion } from "main/utils/notices";
import type { NoticeFillIn } from "main/utils/noticeFields";
import {
  OTHER_CAMPUS_JOB_OPTIONS,
  STUDENT_STATUS_OPTIONS,
  TRAINING_COMMITMENT_OPTIONS,
  labelOf,
  yesNoLabel,
} from "main/utils/ulaQuestions";

export type ApplicationSummaryData = Omit<
  Application,
  | "adminComments"
  | "postApplicationComments"
  | "origin"
  | "status"
  | "cancelledAt"
  | "cancellationReason"
> &
  Partial<Pick<Application, "status" | "cancelledAt" | "cancellationReason">>;

type ApplicationSummaryProps = {
  /** A submitted application or, with `draft`, a draft (issue #296). */
  application: ApplicationSummaryData | DraftApplication;
  /**
   * Whether this is a draft, which the applicant has not finished. The same summary serves both so
   * that a question added to or removed from it shows for both. A draft differs in one way: a
   * yes/no question the applicant has not answered reads as blank rather than as "No".
   */
  draft?: boolean;
  /** TA and ULA ask different questions, so only the relevant ones are shown back. */
  type: "TA" | "ULA";
  /** The notice version the applicant agreed to, if the caller has it; shown back ticked. */
  notice?: NoticeVersion | null;
  /** The recruitment's quarter and deadline, filled into the notice's fields (issue #150). */
  noticeFillIn?: NoticeFillIn | null;
  testIdPrefix?: string;
};

/** Blank rather than "null"; an unanswered question should read as unanswered. */
const show = (value: unknown): string =>
  value === null || value === undefined || value === "" ? "" : String(value);

const yesNo = (value: boolean | null | undefined, draft: boolean): string =>
  draft ? yesNoLabel(value) : value ? "Yes" : "No";

/** The names an applicant rated, in name order; none means the question reads as blank. */
const ratedNames = (levels: Record<string, number> | null | undefined) =>
  Object.keys(levels ?? {}).sort((a, b) => a.localeCompare(b));

/**
 * The courses the applicant said something about, in course order: the two choices and every
 * course they marked. The courses they left at the default are not stored, so they are not shown.
 */
const coursesOfInterest = (
  application: ApplicationSummaryProps["application"],
): string[] =>
  [
    ...new Set(
      [
        application.firstChoiceCourse,
        application.secondChoiceCourse,
        ...Object.keys(application.courseInterests ?? {}),
      ].filter((courseId): courseId is string => !!courseId),
    ),
  ].sort();

/** What the applicant submitted, shown back once the application can no longer be edited. */
export default function ApplicationSummary({
  application,
  type,
  draft = false,
  notice = null,
  noticeFillIn = null,
  testIdPrefix = "ApplicationSummary",
}: ApplicationSummaryProps): React.JSX.Element {
  const isTa = type === "TA";

  const id = (name: string) => `${testIdPrefix}-${name}`;
  const rows: { label: string; value: React.ReactNode; mono?: boolean }[] = [
    // First, so nobody reads a cancelled application without knowing (issue #107).
    ...(application.status === "CANCELLED"
      ? [
          {
            label: "Cancelled",
            value: `${submittedText(application.cancelledAt ?? null)}: ${show(application.cancellationReason)}`,
          },
        ]
      : []),
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
    {
      label: "GPA in Major",
      value: gpaText(application, application.gpaMajor),
    },
    {
      label: "Overall GPA",
      value: gpaText(application, application.gpaOverall),
    },
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

  // Issue #443: the ratings and the other courses are shown in the form's own tables, read-only,
  // so each scale reads the way the applicant saw it.
  const topics = ratedNames(application.topicProficiencies);
  rows.push({
    label: "Topic Proficiency",
    value: topics.length > 0 && (
      <LevelTable
        heading="Topic"
        names={topics}
        levels={proficiencyLevels(type)}
        values={application.topicProficiencies ?? {}}
        rowTestId={(topic) => id(`topic-${rowSlug(topic)}`)}
      />
    ),
  });
  if (!isTa) {
    const interests = ratedNames(application.interests);
    rows.push({
      label: "Interests",
      value: interests.length > 0 && (
        <LevelTable
          heading="Interest"
          names={interests}
          levels={INTEREST_LEVELS}
          values={application.interests ?? {}}
          rowTestId={(interest) => id(`interest-${rowSlug(interest)}`)}
        />
      ),
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
              draft,
            ),
          },
          {
            label: `Available for a ${choice} Choice Discussion`,
            value: yesNo(
              choice === "First"
                ? application.availableForDiscussionFirstChoice
                : application.availableForDiscussionSecondChoice,
              draft,
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
  const courseInterests = application.courseInterests ?? {};
  const courses = coursesOfInterest(application);
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
      value: courses.length > 0 && (
        <CourseInterestTable
          courses={courses}
          rankOf={(courseId) =>
            courseId === application.firstChoiceCourse
              ? "1st choice"
              : courseId === application.secondChoiceCourse
                ? "2nd choice"
                : null
          }
          interestIn={(courseId) =>
            courseInterests[courseId] ?? DEFAULT_COURSE_INTEREST
          }
          rowTestId={(courseId) => id(`courseInterest-${rowSlug(courseId)}`)}
        />
      ),
    },
    { label: "Anything Else", value: show(application.comments) },
  );

  const coursework = application.priorCoursework ?? [];

  return (
    <>
      {/* First, as on the form itself (issue #77). */}
      <NoticeAgreement
        notice={notice}
        fillIn={noticeFillIn}
        agreed={application.noticeVersionId === notice?.id}
        onChange={() => {}}
        readOnly
        type={type}
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
      {coursework.length === 0 ? (
        <p
          className="text-muted small"
          data-testid={`${testIdPrefix}-coursework-none`}
        >
          No courses listed.
        </p>
      ) : (
        <PriorCourseworkTable
          courses={coursework}
          onEdit={() => {}}
          onDelete={() => {}}
          readOnly
          testIdPrefix={`${testIdPrefix}-coursework`}
        />
      )}
    </>
  );
}
