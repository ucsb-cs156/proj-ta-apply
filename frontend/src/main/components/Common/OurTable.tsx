import { useMemo, type CSSProperties } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type Cell,
  type Column,
  type ColumnDef,
  type VisibilityState,
} from "@tanstack/react-table";
import { Button } from "react-bootstrap";
import type { ColumnChoice } from "main/components/Common/ColumnVisibilityControl";
import SortCaret from "main/components/Common/SortCaret";
import {
  convertOldStyleColumnsToNewStyle,
  type LegacyColumn,
} from "main/components/Common/OurTableUtils";

/** Optional per-column presentation, passed through a column's `meta` key. */
type ColumnStyleMeta = { style?: CSSProperties };

const styleOf = (meta: unknown): CSSProperties | undefined =>
  (meta as ColumnStyleMeta | undefined)?.style;

/** How far an arrow key moves a column's edge, in pixels. */
const KEYBOARD_RESIZE_CHANGE: Record<string, number> = {
  ArrowRight: 20,
  ArrowLeft: -20,
};

/**
 * A column marked `enableResizing: true`, with a `size`, has a set width and a drag handle (issue
 * #342). TanStack gives every column a default size of 150, so the size alone does not say.
 */
const isSized = <T,>(column: Column<T, unknown>): boolean =>
  column.columnDef.enableResizing === true;

/** The width a sized column is shown at: its size now, and never less than its minimum. */
const sizedStyle = <T,>(column: Column<T, unknown>): CSSProperties => ({
  width: column.getSize(),
  minWidth: column.getSize(),
});

/**
 * Small "hide" links over the headings of the columns that can be hidden (issue #314): `choices`
 * are the columns in the Columns menu, so a column outside it (an id, View or Edit column) gets no
 * link, and `onHide` does what unticking the column in the menu does.
 */
export type HideLinks = {
  choices: ColumnChoice[];
  onHide: (columnId: string) => void;
};

type OurTableProps<T extends object> = {
  data: T[];
  columns: LegacyColumn[];
  testid?: string;
  enableSorting?: boolean;
  /**
   * Size the table to its content (Bootstrap `w-auto`) instead of the full width of the page,
   * so each column has its natural width and the slack is left on the right (issue #84).
   */
  fitContent?: boolean;
  /**
   * Columns to leave out, by id, as TanStack's visibility state: `{ room: false }` hides the
   * Room column, cells, footer and all (issue #185). Columns not named are shown.
   */
  columnVisibility?: VisibilityState;
  /** Centre every heading in its cell (issue #185); cells keep their own alignment. */
  centerHeaders?: boolean;
  /** A "hide" link over each hideable column's heading (issue #314); none when absent. */
  hideLinks?: HideLinks;
};

export default function OurTable<T extends object>({
  data,
  columns,
  testid = "testid",
  enableSorting = true,
  fitContent = false,
  columnVisibility = {},
  centerHeaders = false,
  hideLinks,
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
    // Only columns marked enableResizing get a handle (issue #342); the rest keep their width.
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    state: { columnVisibility },
  });

  /** Nudge a column by the keyboard, the alternative to dragging its handle. */
  const resizeFromKeyboard = (
    column: Column<T, unknown>,
    event: React.KeyboardEvent,
  ) => {
    const change = KEYBOARD_RESIZE_CHANGE[event.key];
    if (change === undefined) return;
    event.preventDefault();
    // getSize never goes below the column's minimum, so neither does a nudge from it.
    const size = column.getSize() + change;
    table.setColumnSizing((sizes) => ({ ...sizes, [column.id]: size }));
  };

  return (
    <table
      className={`table table-striped table-bordered${fitContent ? " w-auto" : ""}`}
      data-testid={testid}
    >
      <thead>
        {table.getHeaderGroups().map((headerGroup, i) => (
          <tr
            data-testid={`${testid}-header-group-${i}`}
            // Stryker disable next-line StringLiteral : React key property not exposed in dom
            key={`${testid}-header-group-${i}`}
          >
            {headerGroup.headers.map((header) => {
              const hideChoice = hideLinks?.choices.find(
                (choice) => choice.id === header.column.id,
              );
              const resizable =
                isSized(header.column) && header.column.getCanResize();
              const thStyle = centerHeaders
                ? {
                    ...styleOf(header.column.columnDef.meta),
                    textAlign: "center" as const,
                  }
                : styleOf(header.column.columnDef.meta);
              const columnLabel =
                typeof header.column.columnDef.header === "string"
                  ? header.column.columnDef.header
                  : header.column.id;
              return (
                <th
                  data-testid={`${testid}-header-${header.column.id}`}
                  key={`${testid}-header-${header.column.id}`}
                  colSpan={header.colSpan}
                  style={{
                    ...thStyle,
                    ...(isSized(header.column) && sizedStyle(header.column)),
                    ...((hideChoice || resizable) && { position: "relative" }),
                  }}
                >
                  {hideChoice && hideLinks && (
                    <button
                      type="button"
                      className="btn btn-link p-0 border-0 text-secondary"
                      // Tucked into the cell's top-right corner so the row is no taller and the
                      // heading and its sort caret keep their place. A resizable column keeps
                      // its right edge, where the drag handle is, clear of the link.
                      style={{
                        position: "absolute",
                        top: 0,
                        right: resizable ? "0.6rem" : "0.25rem",
                        fontSize: "0.6rem",
                        lineHeight: 1.2,
                      }}
                      aria-label={`Hide ${hideChoice.label} column`}
                      onClick={() => hideLinks.onHide(hideChoice.id)}
                      data-testid={`${testid}-header-${header.column.id}-hide`}
                    >
                      hide
                    </button>
                  )}
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
                  {resizable && (
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize ${columnLabel} column`}
                      aria-valuenow={header.column.getSize()}
                      aria-valuemin={header.column.columnDef.minSize}
                      tabIndex={0}
                      // A strip down the cell's right edge: drag it, or focus it and press the
                      // left and right arrow keys. It sits beside the sort header, not in it,
                      // so grabbing it never sorts.
                      style={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        bottom: 0,
                        width: "6px",
                        cursor: "col-resize",
                        userSelect: "none",
                        touchAction: "none",
                        borderRight: header.column.getIsResizing()
                          ? "3px solid #0d6efd"
                          : "3px solid rgba(0, 0, 0, 0.15)",
                      }}
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) =>
                        resizeFromKeyboard(header.column, event)
                      }
                      data-testid={`${testid}-header-${header.column.id}-resize`}
                    />
                  )}
                </th>
              );
            })}
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
                    style={{
                      ...styleOf(cell.column.columnDef.meta),
                      ...(isSized(cell.column) && sizedStyle(cell.column)),
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
      {/* A totals row, only when some column defines a footer (issue #176). */}
      {memoizedColumns.some((column) => column.footer !== undefined) && (
        <tfoot>
          {table.getFooterGroups().map((footerGroup, i) => (
            <tr
              data-testid={`${testid}-footer-group-${i}`}
              // Stryker disable next-line StringLiteral : React key property not exposed in dom
              key={`${testid}-footer-group-${i}`}
            >
              {footerGroup.headers.map((header) => (
                <th
                  data-testid={`${testid}-footer-${header.column.id}`}
                  // Stryker disable next-line StringLiteral : React key property not exposed in dom
                  key={`${testid}-footer-${header.column.id}`}
                  colSpan={header.colSpan}
                  style={styleOf(header.column.columnDef.meta)}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.footer,
                        header.getContext(),
                      )}
                </th>
              ))}
            </tr>
          ))}
        </tfoot>
      )}
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
