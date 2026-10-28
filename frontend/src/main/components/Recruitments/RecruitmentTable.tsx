import OurTable from "main/components/Common/OurTable";
import { useBackendMutation } from "main/utils/useBackend";
import { Button } from "react-bootstrap";
import { Link } from "react-router";
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
};

type RecruitmentTableProps = {
  recruitments: Recruitment[];
  /** Not needed when readOnly: the Delete column is not shown then. */
  onDeleteRequested?: (recruitment: Recruitment) => void;
  /** Just the fields, without the buttons: for repeating one recruitment at the top of a page. */
  readOnly?: boolean;
  testIdPrefix?: string;
};

export default function RecruitmentTable({
  recruitments,
  onDeleteRequested = () => {},
  readOnly = false,
  testIdPrefix = "RecruitmentTable",
}: RecruitmentTableProps): React.JSX.Element {
  const statusMutation = useBackendMutation<Recruitment, unknown>(
    (recruitment) => ({
      url: "/api/admin/recruitments/status",
      method: "PUT",
      params: {
        id: recruitment.id,
        // The button always moves it to the other state.
        status: recruitment.applicationStatus === "OPEN" ? "CLOSED" : "OPEN",
      },
    }),
    {},
    ["/api/admin/recruitments/all"],
  );

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
      header: "Tentative Opening",
      accessorKey: "tentativeOpeningDate",
      meta: shrinkToContent,
    },
    {
      header: "Primary Consideration",
      accessorKey: "primaryConsiderationDate",
      meta: shrinkToContent,
    },
    {
      header: "Actually Opened",
      accessorKey: "actualOpeningDate",
      meta: shrinkToContent,
    },
    {
      header: "Actually Closed",
      accessorKey: "actualClosingDate",
      meta: { style: { width: "100%" } },
    },
  ];

  const buttonColumns = [
    {
      header: "Applications",
      id: "status",
      accessorKey: "applicationStatus",
      meta: shrinkToContent,
      cell: ({ cell }: { cell: Cell<Recruitment, unknown> }) => {
        const recruitment = cell.row.original;
        const open = recruitment.applicationStatus === "OPEN";
        return (
          <Button
            variant={open ? "warning" : "success"}
            onClick={() => statusMutation.mutate(recruitment)}
            data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-col-status-button`}
          >
            {open ? "Close" : "Open"}
          </Button>
        );
      },
    },
    {
      header: "Courses",
      id: "courses",
      accessorKey: "id",
      meta: shrinkToContent,
      cell: ({ cell }: { cell: Cell<Recruitment, unknown> }) => (
        <Link
          className="btn btn-primary"
          to={`/admin/recruitments/${cell.row.original.id}/courses`}
          data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-col-courses-button`}
        >
          Courses
        </Link>
      ),
    },
    {
      header: "Test",
      id: "test",
      accessorKey: "id",
      meta: shrinkToContent,
      cell: ({ cell }: { cell: Cell<Recruitment, unknown> }) => (
        <Link
          className="btn btn-secondary"
          to={`/admin/recruitments/${cell.row.original.id}/test-application`}
          data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-col-test-button`}
        >
          Test Application
        </Link>
      ),
    },
    {
      header: "Review",
      id: "review",
      accessorKey: "id",
      meta: shrinkToContent,
      cell: ({ cell }: { cell: Cell<Recruitment, unknown> }) => (
        <Link
          className="btn btn-info"
          to={`/admin/recruitments/${cell.row.original.id}/applications`}
          data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-col-review-button`}
        >
          Applications
        </Link>
      ),
    },
    {
      header: "Delete",
      id: "delete",
      accessorKey: "id",
      meta: shrinkToContent,
      cell: ({ cell }: { cell: Cell<Recruitment, unknown> }) => (
        <Button
          variant="danger"
          onClick={() => onDeleteRequested(cell.row.original)}
          data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-col-delete-button`}
        >
          Delete
        </Button>
      ),
    },
  ];

  const columns = readOnly ? fieldColumns : [...fieldColumns, ...buttonColumns];

  return (
    <OurTable
      data={Array.isArray(recruitments) ? recruitments : []}
      columns={columns}
      testid={testIdPrefix}
    />
  );
}
