import { Link } from "react-router";
import type { Cell } from "@tanstack/react-table";
import OurTable, { type HideLinks } from "main/components/Common/OurTable";
import type { LegacyColumn } from "main/components/Common/OurTableUtils";
import ApplicationOriginBadge from "main/components/Applications/ApplicationOriginBadge";
import {
  adminApplicationEditPath,
  adminApplicationPath,
} from "main/utils/adminApplications";
import {
  applicationColumns,
  show,
  type ApplicationColumn,
  type ApplicationRow,
} from "main/utils/applicationColumns";
import { wideColumnProps } from "main/utils/columnWidths";

type AdminApplicationTableProps = {
  /** Submitted applications, or drafts when `draft` is set. */
  applications: ApplicationRow[];
  /**
   * Whether the rows are drafts (issue #296). The same table serves both, so that a column added
   * or removed shows in both; a draft's differ only in having no Edit button, no origin badge and
   * links that lead to the draft's page.
   */
  draft?: boolean;
  /** TA and ULA applications answer different questions, so the columns differ. */
  type: "TA" | "ULA";
  /** Column ids the admin has hidden (issue #189); see applicationColumns. */
  hiddenColumns?: string[];
  /** The "hide" links over the hideable columns' headings (issue #314). */
  hideLinks?: HideLinks;
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
  // The long text columns are wide and resizable instead (issue #342).
  ...wideColumnProps(column.id),
});

/**
 * An admin's overview of the applications to one recruitment (issue #189): the id, View and Edit
 * buttons and the name first, then the submission time and every answer on the form, each a
 * column the admin can hide or show. The table takes its natural width. Test applications an
 * admin entered are listed too, marked as such, so the admin can tell them from the real ones; an
 * application the applicant cancelled is marked beside its id too (issue #322).
 */
export default function AdminApplicationTable({
  applications,
  type,
  draft = false,
  // Stryker disable next-line all : an id that is no column's hides nothing, like the empty list
  hiddenColumns = [],
  hideLinks,
  testIdPrefix = "AdminApplicationTable",
}: AdminApplicationTableProps): React.JSX.Element {
  const editColumn: LegacyColumn = {
    header: "Edit",
    id: "edit",
    meta: shrinkToContent,
    cell: ({ cell }: { cell: Cell<ApplicationRow, unknown> }) => (
      <Link
        className="btn btn-primary btn-sm"
        to={adminApplicationEditPath(cell.row.original.id)}
        data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-col-edit-button`}
      >
        Edit
      </Link>
    ),
  };
  const columns: LegacyColumn[] = [
    {
      header: "id",
      id: "id",
      accessorKey: "id",
      meta: shrinkToContent,
      cell: ({ cell }: { cell: Cell<ApplicationRow, unknown> }) => {
        const application = cell.row.original;
        return (
          <>
            <Link
              to={adminApplicationPath(application.id, draft)}
              data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-col-id-link`}
            >
              {application.id}
            </Link>
            {application.origin && (
              <ApplicationOriginBadge
                origin={application.origin}
                short
                testId={`${testIdPrefix}-cell-row-${cell.row.index}-col-id-test`}
              />
            )}
            {/* Red, beside the test badge if any, so nobody reads a cancelled application as live (issue #322). */}
            {application.status === "CANCELLED" && (
              <span
                className="badge ms-2 text-bg-danger"
                data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-col-id-cancelled`}
              >
                cancelled
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
      cell: ({ cell }: { cell: Cell<ApplicationRow, unknown> }) => (
        <Link
          className="btn btn-outline-primary btn-sm"
          to={adminApplicationPath(cell.row.original.id, draft)}
          data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-col-view-button`}
        >
          View
        </Link>
      ),
    },
    // An admin comments on a draft but never edits it (issue #296).
    ...(draft ? [] : [editColumn]),
    {
      header: "Name",
      id: "name",
      meta: shrinkToContent,
      accessorFn: (application: ApplicationRow) =>
        [application.firstName, application.middleName, application.lastName]
          .filter((part) => show(part) !== "")
          .join(" "),
    },
    ...applicationColumns(type, draft).map(toLegacyColumn),
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
      hideLinks={hideLinks}
    />
  );
}
