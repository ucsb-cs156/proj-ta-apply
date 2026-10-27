import type { Application } from "main/components/Applications/ApplicationTable";

type ApplicationSummaryProps = {
  application: Application;
  /** TA and ULA ask different questions, so only the relevant ones are shown back. */
  type: "TA" | "ULA";
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
  PASSED: "Passed",
  FAILED: "Failed",
  EXEMPT: "Exempt",
};

const CLASS_LEVEL_LABELS: Record<string, string> = { PHD: "PhD", MS: "MS" };

/** Blank rather than "null"; an unanswered question should read as unanswered. */
const show = (value: unknown): string =>
  value === null || value === undefined || value === "" ? "" : String(value);

const yesNo = (value: boolean): string => (value ? "Yes" : "No");

/** What the applicant submitted, shown back once the application can no longer be edited. */
export default function ApplicationSummary({
  application,
  type,
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
        label: "Language Exam",
        value: LANGUAGE_EXAM_LABELS[show(application.languageExam)] ?? "",
      },
      {
        label: "Language Exam Date Passed",
        value: show(application.languageExamDatePassed),
      },
    );
  } else {
    rows.push(
      {
        label: "Quarters Previously Served as a ULA",
        value: show(application.previousServiceAsUla),
      },
      { label: "Video Link", value: show(application.videoLink) },
    );
  }

  rows.push({
    label: "Relevant Coursework at UCSB",
    value: show(application.courseworkUcsb),
  });

  if (isTa) {
    rows.push(
      {
        label: "Relevant Coursework Elsewhere",
        value: show(application.courseworkOther),
      },
      { label: "290-Level Coursework", value: show(application.coursework290) },
    );
  }

  rows.push(
    {
      label: "Languages, Tools and Technologies",
      value: show(application.knowledge),
    },
    {
      label: "Previous Teaching Experience",
      value: show(application.prevExperience),
    },
    {
      label: "First Choice Course",
      value: show(application.firstChoiceCourse),
      mono: true,
    },
    {
      label: "Available for a First Choice Lecture",
      value: yesNo(application.availableForLecturesFirstChoice),
    },
    {
      label: "Available for a First Choice Discussion",
      value: yesNo(application.availableForDiscussionFirstChoice),
    },
    {
      label: "Second Choice Course",
      value: show(application.secondChoiceCourse),
      mono: true,
    },
    {
      label: "Available for a Second Choice Lecture",
      value: yesNo(application.availableForLecturesSecondChoice),
    },
    {
      label: "Available for a Second Choice Discussion",
      value: yesNo(application.availableForDiscussionSecondChoice),
    },
    { label: "Other Courses", value: show(application.desiredCourses) },
    { label: "Anything Else", value: show(application.comments) },
  );

  return (
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
  );
}
