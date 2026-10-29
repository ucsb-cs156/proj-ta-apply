import OurTable from "main/components/Common/OurTable";
import { Link } from "react-router";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import { phaseOf } from "main/utils/applicationAccess";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import type { Cell } from "@tanstack/react-table";
import type { PriorCourse } from "main/utils/priorCoursework";

export type Application = {
  id: number;
  recruitmentId: number;
  email: string;
  status: "PENDING" | "HIRED" | "NOT_HIRED";
  postApplicationComments: string | null;
  /** True when an admin entered it to preview the form; see TestApplicationPage. */
  testApplication: boolean;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  major: string | null;
  gpaMajor: number | null;
  gpaOverall: number | null;
  yearInProgram: string | null;
  graduationDate: string | null;
  /** The courses listed as relevant background, with their ids. */
  priorCoursework: PriorCourse[];
  /** Topic name to self-rated proficiency (1..5 TA, 1..3 ULA); only rated topics appear. */
  topicProficiencies: Record<string, number> | null;
  /** ULA only: interest area to level 1..5; only answered areas appear. Empty for a TA. */
  interests: Record<string, number> | null;
  prevExperience: string | null;
  comments: string | null;
  firstChoiceCourse: string | null;
  secondChoiceCourse: string | null;
  availableForLecturesFirstChoice: boolean;
  availableForLecturesSecondChoice: boolean;
  availableForDiscussionFirstChoice: boolean;
  availableForDiscussionSecondChoice: boolean;
  availabilityCommentsFirstChoice: string | null;
  availabilityCommentsSecondChoice: string | null;
  /** Course id to ENTHUSIASTIC or WOULD_CONSIDER; a course not listed is not of interest. */
  courseInterests: Record<string, string>;
  residencyStatus: string | null;
  languageExam: string | null;
  languageExamDatePassed: string | null;
  classLevel: string | null;
  videoLink: string | null;
  previousServiceAsUla: number | null;
  /** ULA only (issue #72); all null on a TA application. */
  permNumber: string | null;
  bsMsStudent: boolean | null;
  studentStatusNextQuarter: string | null;
  wantsTaEligibility: boolean | null;
  otherCampusJob: string | null;
  priorUcsbEmployment: boolean | null;
  employeeId: string | null;
  i9Appointment: boolean | null;
  trainingCommitment: string | null;
  trainingCommitmentExplanation: string | null;
  changingMajor: boolean | null;
  /** When the application was first submitted, as an ISO date-time; null for rows older than it. */
  submittedAt: string | null;
  /** An admin's free-text notes; null until an admin writes some. */
  adminComments: string | null;
  /** The notice version the applicant agreed to; null for applications older than any notice. */
  noticeVersionId: number | null;
};

type ApplicationTableProps = {
  applications: Application[];
  /** Every recruitment the user could have applied to, so each row can name its quarter. */
  recruitments: Recruitment[];
  testIdPrefix?: string;
};

/** What the applicant may still do, which is the useful thing to show next to a status. */
const actionLabels = {
  EDITABLE: "Edit",
  COMMENTS_ONLY: "Add comments",
  VIEW_ONLY: "View",
};

export default function ApplicationTable({
  applications,
  recruitments,
  testIdPrefix = "ApplicationTable",
}: ApplicationTableProps): React.JSX.Element {
  const byId = new Map(
    (Array.isArray(recruitments) ? recruitments : []).map((r) => [r.id, r]),
  );

  const shrinkToContent = {
    style: { width: "1%", whiteSpace: "nowrap" as const },
  };

  const columns = [
    {
      header: "Quarter",
      id: "quarter",
      accessorFn: (application: Application) =>
        byId.get(application.recruitmentId)?.quarter ?? "",
      meta: shrinkToContent,
      cell: ({ cell }: { cell: Cell<Application, unknown> }) => {
        const quarter = byId.get(cell.row.original.recruitmentId)?.quarter;
        return quarter ? yyyyqToQyy(quarter) : "";
      },
    },
    {
      header: "Type",
      id: "type",
      accessorFn: (application: Application) =>
        byId.get(application.recruitmentId)?.type ?? "",
      meta: shrinkToContent,
    },
    { header: "Status", accessorKey: "status", meta: shrinkToContent },
    {
      header: "Test",
      accessorKey: "testApplication",
      meta: shrinkToContent,
      // Shown as the words true/false: a boolean renders as nothing at all.
      cell: ({ cell }: { cell: Cell<Application, unknown> }) =>
        String(Boolean(cell.row.original.testApplication)),
    },
    {
      header: "First Choice",
      accessorKey: "firstChoiceCourse",
      meta: shrinkToContent,
      cell: ({ cell }: { cell: Cell<Application, unknown> }) => (
        <span style={{ whiteSpace: "pre", fontFamily: "monospace" }}>
          {cell.row.original.firstChoiceCourse}
        </span>
      ),
    },
    {
      header: "Second Choice",
      accessorKey: "secondChoiceCourse",
      meta: { style: { width: "100%" } },
      cell: ({ cell }: { cell: Cell<Application, unknown> }) => (
        <span style={{ whiteSpace: "pre", fontFamily: "monospace" }}>
          {cell.row.original.secondChoiceCourse}
        </span>
      ),
    },
    {
      header: "",
      id: "action",
      meta: shrinkToContent,
      cell: ({ cell }: { cell: Cell<Application, unknown> }) => {
        const application = cell.row.original;
        const phase = phaseOf(byId.get(application.recruitmentId));
        return (
          <Link
            to={`/applications/${application.id}`}
            data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-col-action-link`}
          >
            {actionLabels[phase]}
          </Link>
        );
      },
    },
  ];

  return (
    <OurTable
      data={Array.isArray(applications) ? applications : []}
      columns={columns}
      testid={testIdPrefix}
    />
  );
}
