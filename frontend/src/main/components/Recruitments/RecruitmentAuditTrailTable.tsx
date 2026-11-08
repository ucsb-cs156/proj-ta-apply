import { formatPacificDateTime } from "main/utils/pacificTime";
import type { Cell } from "@tanstack/react-table";
import OurTable from "main/components/Common/OurTable";
import type { LegacyColumn } from "main/components/Common/OurTableUtils";

/**
 * One change to a recruitment itself (issue #139): its creation or deletion, or one field going
 * from one value to another. Not to be confused with AuditTrailRow, a change to an application.
 * The editor's email (issue #337) is null on rows written before it was recorded. The type of the
 * recruitment (TA or ULA) is only served with the hiring-target changes of a whole quarter, for the
 * Budget page's Audit Trail card (issue #391).
 */
export type RecruitmentAuditTrailRow = {
  id: number;
  changedAt: string | null;
  recruitmentId: number;
  whatChanged: string;
  oldValue: string | null;
  newValue: string | null;
  editorEmail?: string | null;
  type?: "TA" | "ULA";
};

/** One page of rows, in the shape the backend's paged endpoints all use. */
export type RecruitmentAuditTrailPage = {
  content: RecruitmentAuditTrailRow[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

type RecruitmentAuditTrailTableProps = {
  rows: RecruitmentAuditTrailRow[];
  testIdPrefix?: string;
  /** Adds a Type column (TA or ULA) when the rows are from more than one recruitment (issue #391). */
  showType?: boolean;
};

/** Blank rather than "null": a created or deleted row has no values. */
const show = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value);

/**
 * The changes to one recruitment, as served: the page decides the order and the paging. The table
 * is sized to its content (issue #201), so Old Value and New Value are only as wide as their
 * values and any slack is left on the right.
 */
export default function RecruitmentAuditTrailTable({
  rows,
  testIdPrefix = "RecruitmentAuditTrailTable",
  showType = false,
}: RecruitmentAuditTrailTableProps): React.JSX.Element {
  const shrinkToContent = {
    style: { width: "1%", whiteSpace: "nowrap" as const },
  };

  const typeColumn: LegacyColumn[] = showType
    ? [
        {
          header: "Type",
          id: "type",
          accessorKey: "type",
          meta: shrinkToContent,
          cell: ({ cell }: { cell: Cell<RecruitmentAuditTrailRow, unknown> }) =>
            show(cell.getValue()),
        },
      ]
    : [];

  const columns: LegacyColumn[] = [
    { header: "id", id: "id", accessorKey: "id", meta: shrinkToContent },
    {
      header: "Changed",
      id: "changedAt",
      accessorKey: "changedAt",
      meta: shrinkToContent,
      cell: ({ cell }: { cell: Cell<RecruitmentAuditTrailRow, unknown> }) =>
        formatPacificDateTime(cell.getValue<string | null>()),
    },
    {
      // Issue #337: who made the change; blank on rows from before it was recorded.
      header: "Changed By",
      id: "editorEmail",
      accessorKey: "editorEmail",
      meta: shrinkToContent,
      cell: ({ cell }: { cell: Cell<RecruitmentAuditTrailRow, unknown> }) =>
        show(cell.getValue()),
    },
    ...typeColumn,
    {
      header: "What Changed",
      id: "whatChanged",
      accessorKey: "whatChanged",
      meta: shrinkToContent,
    },
    {
      header: "Old Value",
      id: "oldValue",
      accessorKey: "oldValue",
      cell: ({ cell }: { cell: Cell<RecruitmentAuditTrailRow, unknown> }) =>
        show(cell.getValue()),
    },
    {
      header: "New Value",
      id: "newValue",
      accessorKey: "newValue",
      cell: ({ cell }: { cell: Cell<RecruitmentAuditTrailRow, unknown> }) =>
        show(cell.getValue()),
    },
  ];

  return (
    <OurTable
      data={Array.isArray(rows) ? rows : []}
      columns={columns}
      testid={testIdPrefix}
      enableSorting={false}
      fitContent
    />
  );
}
