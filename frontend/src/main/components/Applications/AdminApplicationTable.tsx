import { Link } from "react-router";
import type { Cell } from "@tanstack/react-table";
import OurTable from "main/components/Common/OurTable";
import type { LegacyColumn } from "main/components/Common/OurTableUtils";
import type { Application } from "main/components/Applications/ApplicationTable";
import { submittedText } from "main/utils/adminApplications";

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
 * An admin's overview of the applications to one recruitment: a few columns per application, with
 * the id linking to the full read-only application. Test applications an admin entered are listed
 * too, marked as such, so the admin can tell them from the real ones.
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
          header: "Expected Graduation",
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
              to={`/admin/applications/${application.id}`}
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
    {
      header: "First Choice",
      id: "firstChoiceCourse",
      accessorFn: (application: Application) =>
        show(application.firstChoiceCourse),
      meta: shrinkToContent,
    },
    {
      header: "Second Choice",
      id: "secondChoiceCourse",
      accessorFn: (application: Application) =>
        show(application.secondChoiceCourse),
      meta: shrinkToContent,
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
