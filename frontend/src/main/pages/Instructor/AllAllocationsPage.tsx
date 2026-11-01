import { Link, useParams } from "react-router";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import OurTable from "main/components/Common/OurTable";
import { useBackend } from "main/utils/useBackend";
import { apiErrorMessage } from "main/utils/apiError";
import type { Cell } from "@tanstack/react-table";

/** One row of /api/instructor/recruitments/{id}/allocations (issue #224). */
export type AllocationRow = {
  id: number;
  courseId: string;
  section: string | null;
  instructor: string | null;
  allocation: number | null;
};

/**
 * Every course's allocation for one recruitment, read-only, for faculty and admins:
 * /recruitments/:recruitmentId/allocations (issue #224). The backend serves it to instructors only
 * while the admin shows all allocations to all faculty; otherwise it answers 403 and the page says
 * so.
 */
export default function AllAllocationsPage(): React.JSX.Element {
  const { recruitmentId } = useParams();
  const url = `/api/instructor/recruitments/${recruitmentId}/allocations`;
  const { data, isError, error, isFetching } = useBackend<
    AllocationRow[] | null
  >(
    // Stryker disable next-line all : the key is only observable through invalidation, and nothing here invalidates
    [url],
    // Stryker disable next-line all : GET is axios's default method
    { method: "GET", url },
    null,
    true,
  );

  const columns = [
    {
      header: "Course",
      accessorKey: "courseId",
      meta: { style: { width: "1%", whiteSpace: "nowrap" as const } },
      sortingFn: "textCaseSensitive" as const,
      cell: ({ cell }: { cell: Cell<AllocationRow, unknown> }) => (
        <span style={{ whiteSpace: "pre", fontFamily: "monospace" }}>
          {cell.row.original.courseId}
        </span>
      ),
    },
    {
      header: "Section",
      accessorKey: "section",
      meta: { style: { width: "1%", whiteSpace: "nowrap" as const } },
    },
    { header: "Instructor", accessorKey: "instructor" },
    {
      header: "Allocation",
      accessorKey: "allocation",
      meta: {
        style: {
          width: "1%",
          whiteSpace: "nowrap" as const,
          textAlign: "right" as const,
        },
      },
    },
  ];

  return (
    <BasicLayout>
      <div className="pt-2" data-testid="AllAllocationsPage">
        <h1>All Allocations</h1>
        <p>
          How many TAs or ULAs the admin has allocated to each course of this
          recruitment. The admin may change these numbers; your own courses'
          targets are on your <Link to="/">home page</Link>.
        </p>
        {isError ? (
          <p role="alert" data-testid="AllAllocationsPage-error">
            Unable to load the allocations: {apiErrorMessage(error)}
          </p>
        ) : data == null ? (
          <p role="status">
            {isFetching
              ? "Loading allocations..."
              : "No allocations were returned."}
          </p>
        ) : (
          <OurTable
            data={data}
            columns={columns}
            testid="AllAllocationsPage-table"
            fitContent
          />
        )}
      </div>
    </BasicLayout>
  );
}
