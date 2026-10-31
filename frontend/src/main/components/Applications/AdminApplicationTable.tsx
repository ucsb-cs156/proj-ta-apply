import { Link } from "react-router";
import type { Cell } from "@tanstack/react-table";
import OurTable from "main/components/Common/OurTable";
import type { LegacyColumn } from "main/components/Common/OurTableUtils";
import type { Application } from "main/components/Applications/ApplicationTable";
import {
  adminApplicationEditPath,
  adminApplicationPath,
} from "main/utils/adminApplications";
import {
  applicationColumns,
  show,
  type ApplicationColumn,
} from "main/utils/applicationColumns";

type AdminApplicationTableProps = {
  applications: Application[];
  /** TA and ULA applications answer different questions, so the columns differ. */
  type: "TA" | "ULA";
  /** Column ids the admin has hidden (issue #189); see applicationColumns. */
  hiddenColumns?: string[];
  testIdPrefix?: string;
};

/**
 * A heading on two lines, so the column is no wider than its values (issue #109). The space before
 * the break keeps the heading's text ("Expected Graduation") whole for screen readers and tests.
 */
const stacked = (top: string, bottom: string): React.JSX.Element => (
  <>
    {top} <br />
    {bottom}
  </>
);

const shrinkToContent = {
  style: { width: "1%", whiteSpace: "nowrap" as const },
};

/** A column from the catalogue: its heading, its value and whether it shrinks to its content. */
const toLegacyColumn = (column: ApplicationColumn): LegacyColumn => ({
  header: column.stacked ? stacked(...column.stacked) : column.label,
  id: column.id,
  accessorFn: column.value,
  ...(column.shrink ? { meta: shrinkToContent } : {}),
});

/**
 * An admin's overview of the applications to one recruitment (issue #189): the id, View and Edit
 * buttons and the name first, then the submission time and every answer on the form, each a
 * column the admin can hide or show. The table takes its natural width. Test applications an
 * admin entered are listed too, marked as such, so the admin can tell them from the real ones.
 */
export default function AdminApplicationTable({
  applications,
  type,
  // Stryker disable next-line all : an id that is no column's hides nothing, like the empty list
  hiddenColumns = [],
  testIdPrefix = "AdminApplicationTable",
}: AdminApplicationTableProps): React.JSX.Element {
  const columns: LegacyColumn[] = [
    {
      header: "id",
      id: "id",
      accessorKey: "id",
      meta: shrinkToContent,
      cell: ({ cell }: { cell: Cell<Application, unknown> }) => {
        const application = cell.row.original;
        return (
          <>
            <Link
              to={adminApplicationPath(application.id)}
              data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-col-id-link`}
            >
              {application.id}
            </Link>
            {application.testApplication && (
              <span
                className="badge text-bg-secondary ms-2"
                data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-col-id-test`}
              >
                test
              </span>
            )}
          </>
        );
      },
    },
    {
      // No accessor, so TanStack never offers to sort View or Edit.
      header: "View",
      id: "view",
      meta: shrinkToContent,
      cell: ({ cell }: { cell: Cell<Application, unknown> }) => (
        <Link
          className="btn btn-outline-primary btn-sm"
          to={adminApplicationPath(cell.row.original.id)}
          data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-col-view-button`}
        >
          View
        </Link>
      ),
    },
    {
      header: "Edit",
      id: "edit",
      meta: shrinkToContent,
      cell: ({ cell }: { cell: Cell<Application, unknown> }) => (
        <Link
          className="btn btn-primary btn-sm"
          to={adminApplicationEditPath(cell.row.original.id)}
          data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-col-edit-button`}
        >
          Edit
        </Link>
      ),
    },
    {
      header: "Name",
      id: "name",
      meta: shrinkToContent,
      accessorFn: (application: Application) =>
        [application.firstName, application.middleName, application.lastName]
          .filter((part) => show(part) !== "")
          .join(" "),
    },
    ...applicationColumns(type).map(toLegacyColumn),
  ];

  return (
    <OurTable
      data={Array.isArray(applications) ? applications : []}
      columns={columns}
      testid={testIdPrefix}
      fitContent
      columnVisibility={Object.fromEntries(
        hiddenColumns.map((id) => [id, false]),
      )}
    />
  );
}
