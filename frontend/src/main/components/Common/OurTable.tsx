import { useMemo } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type Cell,
  type ColumnDef,
} from "@tanstack/react-table";
import { Button } from "react-bootstrap";
import SortCaret from "main/components/Common/SortCaret";
import {
  convertOldStyleColumnsToNewStyle,
  type LegacyColumn,
} from "main/components/Common/OurTableUtils";

type OurTableProps<T extends object> = {
  data: T[];
  columns: LegacyColumn[];
  testid?: string;
  enableSorting?: boolean;
};

export default function OurTable<T extends object>({
  data,
  columns,
  testid = "testid",
  enableSorting = true,
}: OurTableProps<T>): React.JSX.Element {
  const newColumns = convertOldStyleColumnsToNewStyle(columns);
  const memoizedData = useMemo(() => data, [data]);
  const memoizedColumns = useMemo(
    () => newColumns as ColumnDef<T>[],
    [newColumns],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns new function references each render; React Compiler correctly skips memoizing this component
  const table = useReactTable({
    data: memoizedData,
    columns: memoizedColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSorting,
  });

  return (
    <table className="table table-striped table-bordered" data-testid={testid}>
      <thead>
        {table.getHeaderGroups().map((headerGroup, i) => (
          <tr
            data-testid={`${testid}-header-group-${i}`}
            // Stryker disable next-line StringLiteral : React key property not exposed in dom
            key={`${testid}-header-group-${i}`}
          >
            {headerGroup.headers.map((header) => (
              <th
                data-testid={`${testid}-header-${header.column.id}`}
                key={`${testid}-header-${header.column.id}`}
                colSpan={header.colSpan}
              >
                {header.isPlaceholder ? null : (
                  <div
                    // Add onClick handler for sorting if the column is sortable
                    {...(header.column.getCanSort() && {
                      onClick: header.column.getToggleSortingHandler(),
                      style: { cursor: "pointer" }, // Add cursor style for visual cue
                    })}
                    data-testid={`${testid}-header-${header.column.id}-sort-header`}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                    <SortCaret header={header} testId={testid} />
                  </div>
                )}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => {
          const rowTestId = `${testid}-row-${row.index}`;
          return (
            <tr
              data-testid={rowTestId}
              // Stryker disable next-line StringLiteral : React key property not exposed in dom
              key={rowTestId}
            >
              {row.getVisibleCells().map((cell) => {
                const testId = `${testid}-cell-row-${cell.row.index}-col-${cell.column.id}`;
                return (
                  <td
                    data-testid={testId}
                    // Stryker disable next-line StringLiteral : React key property not exposed in dom
                    key={testId}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function ButtonColumn<T extends object>(
  label: string,
  variant: string,
  callback: (cell: Cell<T, unknown>) => void,
  testid: string,
): ColumnDef<T> {
  const columnHelper = createColumnHelper<T>();

  return columnHelper.display({
    id: label, // Unique ID for display columns
    header: label,
    cell: ({ cell }) => (
      <Button
        variant={variant}
        onClick={() => callback(cell)}
        data-testid={`${testid}-cell-row-${cell.row.index}-col-${cell.column.id}-button`}
      >
        {label}
      </Button>
    ),
  });
}
