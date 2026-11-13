import type { Cell } from "@tanstack/react-table";
import { Link } from "react-router";
import OurTable from "main/components/Common/OurTable";
import type { LegacyColumn } from "main/components/Common/OurTableUtils";
import type { Application } from "main/components/Applications/ApplicationTable";
import type { StudentRecruitment } from "main/components/Recruitments/RecruitmentTable";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import { applicationFor } from "main/utils/studentRecruitments";

type PastRecruitmentsTableProps = {
  /** Only recruitments the student applied to belong here; the caller filters. */
  recruitments: StudentRecruitment[];
  applications: Application[];
  testIdPrefix?: string;
};

/** What the View Application cells need, handed to them through the column's meta. */
type ViewMeta = {
  style: { width: string; whiteSpace: "nowrap" };
  applications: Application[];
  testIdPrefix: string;
};

/**
 * One row's View Application link, when the student has an application for it. A module-level
 * component (issue #437): a cell function written inside the table is a new component on every
 * render, so the home page's background re-read made the link anew and a keyboard user lost the
 * focus.
 */
function ViewApplicationCell({
  cell,
}: {
  cell: Cell<StudentRecruitment, unknown>;
}): React.JSX.Element | null {
  const meta = cell.column.columnDef.meta as ViewMeta;
  const application = applicationFor(meta.applications, cell.row.original.id);
  return application ? (
    <Link
      to={`/applications/${application.id}`}
      className="btn btn-outline-primary btn-sm"
      data-testid={`${meta.testIdPrefix}-cell-row-${cell.row.index}-col-view-link`}
    >
      View Application
    </Link>
  ) : null;
}

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
      cell: ({ cell }: { cell: Cell<StudentRecruitment, unknown> }) =>
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
      meta: {
        ...shrink,
        applications: applicationList,
        testIdPrefix,
      } satisfies ViewMeta,
      cell: ViewApplicationCell,
    },
  ];

  return (
    <OurTable
      data={Array.isArray(recruitments) ? recruitments : []}
      columns={columns}
      testid={testIdPrefix}
      // A row is its recruitment (issues #435, #437), so a focused link stays its recruitment's
      // when a re-read adds or removes one before it.
      getRowId={(row) => String(row.id)}
    />
  );
}
