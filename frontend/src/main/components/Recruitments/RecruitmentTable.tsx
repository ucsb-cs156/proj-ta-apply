import OurTable from "main/components/Common/OurTable";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import type { Cell } from "@tanstack/react-table";

export type Recruitment = {
  id: number;
  quarter: string;
  type: "TA" | "ULA";
  applicationStatus: "OPEN" | "CLOSED";
  tentativeOpeningDate: string | null;
  primaryConsiderationDate: string | null;
  actualOpeningDate: string | null;
  actualClosingDate: string | null;
  reviewStatus: "NotStarted" | "Open" | "Closed";
  facultyReviewOpeningDate: string | null;
  facultyRankingDeadline: string | null;
  /** When the course list was last filled from the UCSB API (issue #124); null until it has been. */
  lastPopulatedAt?: string | null;
  /** How many TAs or ULAs the recruitment expects to hire in all (issue #174); at least 1. */
  totalHiringTarget?: number;
  /** Whether faculty see the per-course allocations on their pages (issue #178); hidden by default. */
  allocationsVisibleToFaculty?: boolean;
};

/** The applicant-facing recruitment shape deliberately excludes faculty review fields. */
export type StudentRecruitment = Omit<
  Recruitment,
  "reviewStatus" | "facultyReviewOpeningDate" | "facultyRankingDeadline"
>;

/**
 * A heading on two lines, so a column of dates is no wider than its dates. The space before the
 * break keeps the heading's text ("Tentative Opening") whole for screen readers and tests.
 */
const stacked = (top: string, bottom: string): React.JSX.Element => (
  <>
    {top} <br />
    {bottom}
  </>
);

type RecruitmentTableProps = {
  recruitments: Recruitment[];
  testIdPrefix?: string;
};

/**
 * The fields of one or more recruitments, read-only: for repeating a recruitment at the top of
 * its applications page. The Admin > Recruitments page itself shows cards (RecruitmentCards).
 */
export default function RecruitmentTable({
  recruitments,
  testIdPrefix = "RecruitmentTable",
}: RecruitmentTableProps): React.JSX.Element {
  const shrinkToContent = {
    style: { width: "1%", whiteSpace: "nowrap" as const },
  };

  const fieldColumns = [
    {
      header: "Quarter",
      accessorKey: "quarter",
      meta: shrinkToContent,
      // Stored as YYYYQ so it sorts; shown as QYY because that is how people say it.
      cell: ({ cell }: { cell: Cell<Recruitment, unknown> }) =>
        yyyyqToQyy(cell.row.original.quarter),
    },
    { header: "Type", accessorKey: "type", meta: shrinkToContent },
    {
      header: "Status",
      accessorKey: "applicationStatus",
      meta: shrinkToContent,
    },
    {
      header: stacked("Tentative", "Opening"),
      accessorKey: "tentativeOpeningDate",
      meta: shrinkToContent,
    },
    {
      header: stacked("Primary", "Consideration"),
      accessorKey: "primaryConsiderationDate",
      meta: shrinkToContent,
    },
    {
      header: stacked("Actually", "Opened"),
      accessorKey: "actualOpeningDate",
      meta: shrinkToContent,
    },
    {
      header: stacked("Actually", "Closed"),
      accessorKey: "actualClosingDate",
      meta: shrinkToContent,
    },
    {
      header: stacked("Faculty Review", "Status"),
      accessorKey: "reviewStatus",
      meta: shrinkToContent,
    },
    {
      header: stacked("Faculty Reviews", "Opened"),
      accessorKey: "facultyReviewOpeningDate",
      meta: shrinkToContent,
    },
    {
      header: stacked("Faculty Ranking", "Deadline"),
      accessorKey: "facultyRankingDeadline",
      meta: { style: { width: "100%" } },
    },
  ];

  return (
    <OurTable
      data={Array.isArray(recruitments) ? recruitments : []}
      columns={fieldColumns}
      testid={testIdPrefix}
    />
  );
}
