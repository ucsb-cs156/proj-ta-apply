import { useState } from "react";
import { Button, Modal } from "react-bootstrap";
import type { Cell } from "@tanstack/react-table";
import OurTable from "main/components/Common/OurTable";
import type { LegacyColumn } from "main/components/Common/OurTableUtils";
import { abbreviate, isLong } from "main/utils/auditTrail";

/** One change an admin made to one field of an application. */
export type AuditTrailRow = {
  id: number;
  editedAt: string | null;
  ulaApplicationId: number | null;
  taApplicationId: number | null;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
};

type AuditTrailTableProps = {
  rows: AuditTrailRow[];
  testIdPrefix?: string;
};

/** Blank rather than "null". */
const show = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value);

/**
 * The audit trail as a table. A long old or new value is cut to its first characters with a
 * "[See value]" link that opens the whole value in a modal, so the table stays readable while
 * a JSON row or a long comment is still a click away.
 */
export default function AuditTrailTable({
  rows,
  testIdPrefix = "AuditTrailTable",
}: AuditTrailTableProps): React.JSX.Element {
  // The value being looked at in the modal, with which row and column it came from for the title.
  const [shown, setShown] = useState<{ label: string; value: string } | null>(
    null,
  );

  const shrinkToContent = {
    style: { width: "1%", whiteSpace: "nowrap" as const },
  };

  const valueColumn = (
    header: string,
    id: "oldValue" | "newValue",
  ): LegacyColumn => ({
    header,
    id,
    accessorKey: id,
    cell: ({ cell }: { cell: Cell<AuditTrailRow, unknown> }) => {
      const value = show(cell.row.original[id]);
      if (!isLong(value)) {
        return value;
      }
      return (
        <>
          {abbreviate(value)}{" "}
          <Button
            variant="link"
            size="sm"
            className="p-0 align-baseline"
            onClick={() =>
              setShown({
                label: `${header} of ${cell.row.original.fieldName} (audit trail row ${cell.row.original.id})`,
                value,
              })
            }
            data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-col-${id}-see`}
          >
            [See value]
          </Button>
        </>
      );
    },
  });

  const columns: LegacyColumn[] = [
    { header: "id", id: "id", accessorKey: "id", meta: shrinkToContent },
    {
      header: "Edited",
      id: "editedAt",
      accessorKey: "editedAt",
      meta: shrinkToContent,
      cell: ({ cell }: { cell: Cell<AuditTrailRow, unknown> }) =>
        cell.row.original.editedAt
          ? new Date(cell.row.original.editedAt).toLocaleString()
          : "",
    },
    {
      header: "ULA Application",
      id: "ulaApplicationId",
      accessorKey: "ulaApplicationId",
      meta: shrinkToContent,
      cell: ({ cell }: { cell: Cell<AuditTrailRow, unknown> }) =>
        show(cell.row.original.ulaApplicationId),
    },
    {
      header: "TA Application",
      id: "taApplicationId",
      accessorKey: "taApplicationId",
      meta: shrinkToContent,
      cell: ({ cell }: { cell: Cell<AuditTrailRow, unknown> }) =>
        show(cell.row.original.taApplicationId),
    },
    {
      header: "Field",
      id: "fieldName",
      accessorKey: "fieldName",
      meta: shrinkToContent,
    },
    valueColumn("Old Value", "oldValue"),
    valueColumn("New Value", "newValue"),
  ];

  return (
    <>
      <OurTable
        data={Array.isArray(rows) ? rows : []}
        columns={columns}
        testid={testIdPrefix}
        enableSorting={false}
      />
      <Modal
        show={shown !== null}
        onHide={() => setShown(null)}
        centered={true}
        data-testid={`${testIdPrefix}-value-modal`}
      >
        <Modal.Header closeButton>{shown?.label}</Modal.Header>
        <Modal.Body>
          <pre
            className="mb-0"
            style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
            data-testid={`${testIdPrefix}-value-modal-body`}
          >
            {shown?.value}
          </pre>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShown(null)}
            data-testid={`${testIdPrefix}-value-modal-close`}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
