import type { Cell } from "@tanstack/react-table";
import { Link } from "react-router";
import OurTable from "main/components/Common/OurTable";
import type { LegacyColumn } from "main/components/Common/OurTableUtils";
import type { Application } from "main/components/Applications/ApplicationTable";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import { applicationFor } from "main/utils/studentRecruitments";

type PastRecruitmentsTableProps = {
  /** Only recruitments the student applied to belong here; the caller filters. */
  recruitments: Recruitment[];
  applications: Application[];
  testIdPrefix?: string;
};

/**
 * Recruitments that closed more than six months ago and that the student applied to (issue #107):
 * the quarter, type and four dates, and a link to the read-only application.
 */
export default function PastRecruitmentsTable({
  recruitments,
  applications,
  testIdPrefix = "PastRecruitmentsTable",
}: PastRecruitmentsTableProps): React.JSX.Element {
  const shrink = { style: { width: "1%", whiteSpace: "nowrap" as const } };
  const applicationList = Array.isArray(applications) ? applications : [];

  const columns: LegacyColumn[] = [
    {
      header: "Quarter",
      accessorKey: "quarter",
      meta: shrink,
      cell: ({ cell }: { cell: Cell<Recruitment, unknown> }) =>
        yyyyqToQyy(cell.row.original.quarter),
    },
    { header: "Type", accessorKey: "type", meta: shrink },
    {
      header: "Tentative Opening",
      accessorKey: "tentativeOpeningDate",
      meta: shrink,
    },
    {
      header: "Primary Consideration",
      accessorKey: "primaryConsiderationDate",
      meta: shrink,
    },
    {
      header: "Actually Opened",
      accessorKey: "actualOpeningDate",
      meta: shrink,
    },
    {
      header: "Actually Closed",
      accessorKey: "actualClosingDate",
      meta: { style: { width: "100%" } },
    },
    {
      header: "",
      id: "view",
      enableSorting: false,
      meta: shrink,
      cell: ({ cell }: { cell: Cell<Recruitment, unknown> }) => {
        const application = applicationFor(
          applicationList,
          cell.row.original.id,
        );
        return application ? (
          <Link
            to={`/applications/${application.id}`}
            className="btn btn-outline-primary btn-sm"
            data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-col-view-link`}
          >
            View Application
          </Link>
        ) : null;
      },
    },
  ];

  return (
    <OurTable
      data={Array.isArray(recruitments) ? recruitments : []}
      columns={columns}
      testid={testIdPrefix}
    />
  );
}
