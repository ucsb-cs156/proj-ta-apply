import { Link } from "react-router";
import type { Cell } from "@tanstack/react-table";
import OurTable from "main/components/Common/OurTable";
import type { LegacyColumn } from "main/components/Common/OurTableUtils";
import type { Application } from "main/components/Applications/ApplicationTable";
import {
  adminApplicationEditPath,
  adminApplicationPath,
  submittedText,
} from "main/utils/adminApplications";

type AdminApplicationTableProps = {
  applications: Application[];
  /** TA and ULA applications answer different questions, so the columns differ. */
  type: "TA" | "ULA";
  testIdPrefix?: string;
};

const CLASS_LEVEL_LABELS: Record<string, string> = { PHD: "PhD", MS: "MS" };

/** Blank rather than "null", like the summary. */
const show = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value);

/**
 * A heading on two lines, so the column is no wider than its dates (issue #109). The space before
 * the break keeps the heading's text ("Expected Graduation") whole for screen readers and tests.
 */
const stacked = (top: string, bottom: string): React.JSX.Element => (
  <>
    {top} <br />
    {bottom}
  </>
);

/**
 * An admin's overview of the applications to one recruitment: a few columns per application, with
 * the id and a View button linking to the full read-only application and an Edit button to the
 * admin's edit form. Test applications an admin entered are listed too, marked as such, so the
 * admin can tell them from the real ones.
 */
export default function AdminApplicationTable({
  applications,
  type,
  testIdPrefix = "AdminApplicationTable",
}: AdminApplicationTableProps): React.JSX.Element {
  const shrinkToContent = {
    style: { width: "1%", whiteSpace: "nowrap" as const },
  };

  const typeColumn: LegacyColumn =
    type === "TA"
      ? {
          header: "Level",
          id: "classLevel",
          accessorFn: (application: Application) =>
            CLASS_LEVEL_LABELS[show(application.classLevel)] ?? "",
          meta: shrinkToContent,
        }
      : {
          header: stacked("Expected", "Graduation"),
          id: "graduationDate",
          accessorFn: (application: Application) =>
            show(application.graduationDate),
          meta: shrinkToContent,
        };

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
      header: "Submitted",
      id: "submittedAt",
      accessorKey: "submittedAt",
      meta: shrinkToContent,
      cell: ({ cell }: { cell: Cell<Application, unknown> }) =>
        submittedText(cell.row.original.submittedAt),
    },
    {
      header: "Name",
      id: "name",
      accessorFn: (application: Application) =>
        [application.firstName, application.middleName, application.lastName]
          .filter((part) => show(part) !== "")
          .join(" "),
    },
    {
      header: "Major",
      id: "major",
      accessorFn: (application: Application) => show(application.major),
    },
    typeColumn,
    // The email, in place of the two course choices (issue #109): the choices are on the
    // application itself, while the email is how an admin finds or contacts the applicant.
    {
      header: "Email",
      id: "email",
      accessorFn: (application: Application) => show(application.email),
      meta: shrinkToContent,
    },
    {
      header: "View",
      id: "view",
      enableSorting: false,
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
      accessorKey: "id",
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
  ];

  return (
    <OurTable
      data={Array.isArray(applications) ? applications : []}
      columns={columns}
      testid={testIdPrefix}
    />
  );
}
