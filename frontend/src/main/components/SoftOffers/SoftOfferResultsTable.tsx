import type { Cell, Row } from "@tanstack/react-table";
import { useState } from "react";
import { Form } from "react-bootstrap";
import type { ColumnChoice } from "main/components/Common/ColumnVisibilityControl";
import OurTable from "main/components/Common/OurTable";
import type { LegacyColumn } from "main/components/Common/OurTableUtils";
import StampedCheckbox from "main/components/Common/StampedCheckbox";
import StampedSelect from "main/components/Common/StampedSelect";
import type { FundingSource } from "main/utils/fundingSources";
import {
  NEW_HIRE_FORM_OPTIONS,
  formatStamp,
  isStaleStatus,
  type HiringChange,
  type HiringRecord,
} from "main/utils/softOffers";
import {
  COMMENTS_COLUMN_ID,
  COMMENTS_DEFAULT_WIDTH,
  COMMENTS_MIN_WIDTH,
  STAMP_COLUMN_ID,
  STATUS_COLUMN_ID,
  commentsMaxWidth,
  compareHiring,
  layoutColumns,
  type HiringColumn,
  type ResultsColumn,
} from "main/utils/softOfferResultsColumns";

/**
 * What the main table needs for its hiring columns (issues #509 and #512): which application each
 * row is, the records to show, the Funding choices, and how to save a change. The second table has
 * no hiring columns and leaves this out.
 */
export type HiringProps = {
  /** The application id of each row, in the rows' order. */
  applicationIds: number[];
  /** The rows' hiring records by application id (a JSON key, so a string); a row without one has nothing saved yet. */
  records: Record<string, HiringRecord>;
  /** The Funding dropdown's choices, in the backend's order. */
  fundingSources: FundingSource[];
  /** Saves one field of one row. */
  onChange: (change: HiringChange) => void;
  /** The change being saved, whose control is disabled meanwhile; null when none is. */
  pending: HiringChange | null;
};

type Props = {
  /** The backend's headings, one per text column, in order. */
  headers: string[];
  /** The backend's rows, each a list of cells in the headings' order. */
  rows: string[][];
  /** The ids of the columns, in order (see softOfferResultsColumns). */
  columnIds: readonly string[];
  /** The ids hidden, shared with the page's Columns menu. */
  hiddenColumns: string[];
  /**
   * The page's Columns menu's choices: a column among them gets a "hide" link over its heading. A
   * column outside them (First name, Last name, and the second table's Course answered for) has
   * none, since the menu could not bring it back.
   */
  choices: ColumnChoice[];
  /** Hides one column, as unticking it in the Columns menu does. */
  onHide: (columnId: string) => void;
  testIdPrefix: string;
  /** The hiring columns' data and handlers; without it a hiring column's cells are empty. */
  hiring?: HiringProps;
};

/**
 * The columns frozen at the left while the table scrolls sideways (issue #510): the two name
 * columns, which both tables have first and never hide, so a wide row is read against its name.
 */
const PINNED_COLUMN_IDS = ["firstName", "lastName"];

/** The narrowest a Staff Comments box is, in pixels. */
export const STAFF_COMMENTS_MIN_WIDTH = 220;

/** The presentation of one of the backend's text columns: plain text, unless the id says otherwise. */
const textPresentation = (
  id: string,
  i: number,
): Omit<LegacyColumn, "header" | "id"> => {
  if (id === STATUS_COLUMN_ID) {
    // An answer given for a lecture the applicant no longer holds reads "Proceed (for CMPSC 8)",
    // muted so the eye picks out the answers that count.
    return {
      cell: ({ cell }: { cell: Cell<string[], unknown> }) => {
        const text = cell.row.original[i];
        return isStaleStatus(text) ? (
          <span className="text-muted fst-italic">{text}</span>
        ) : (
          text
        );
      },
    };
  }
  if (id === STAMP_COLUMN_ID) {
    return {
      cell: ({ cell }: { cell: Cell<string[], unknown> }) =>
        formatStamp(cell.row.original[i]),
    };
  }
  if (id === COMMENTS_COLUMN_ID) {
    // Dragged (or nudged from the keyboard) between 200px and 80% of the window (issue #494);
    // long comments wrap within the width instead of widening the column.
    return {
      size: COMMENTS_DEFAULT_WIDTH,
      minSize: COMMENTS_MIN_WIDTH,
      maxSize: commentsMaxWidth(window.innerWidth),
      enableResizing: true,
      meta: {
        style: { whiteSpace: "pre-wrap" as const, overflowWrap: "anywhere" },
      },
    };
  }
  return {};
};

type StaffCommentsCellProps = {
  id: string;
  label: string;
  /** The stored text, blank for none. */
  stored: string;
  disabled: boolean;
  onSave: (text: string) => void;
  testId: string;
};

/**
 * The Staff Comments box: what is typed stays in the box and is saved when the box loses focus,
 * or on Ctrl+Enter / Cmd+Enter, if it differs from what is stored. The parent keys the box by the
 * stored text, so a new stored value (a save's answer, or a re-read) starts the box afresh.
 */
function StaffCommentsCell({
  id,
  label,
  stored,
  disabled,
  onSave,
  testId,
}: StaffCommentsCellProps): React.JSX.Element {
  const [draft, setDraft] = useState(stored);
  const saveIfChanged = () => {
    if (draft !== stored) {
      onSave(draft);
    }
  };
  return (
    <Form.Control
      as="textarea"
      rows={2}
      size="sm"
      id={id}
      aria-label={label}
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={saveIfChanged}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          // Stryker disable next-line CallExpression : no browser's own Ctrl+Enter is in jsdom, so
          // stopping it (a newline in some) cannot be observed
          e.preventDefault();
          saveIfChanged();
        }
      }}
      style={{ minWidth: STAFF_COMMENTS_MIN_WIDTH }}
      data-testid={testId}
    />
  );
}

type HiringCellProps = {
  column: HiringColumn;
  /** The row's place in the data, as OurTable's cell test ids count it. */
  rowIndex: number;
  hiring: HiringProps;
  testIdPrefix: string;
};

/**
 * What a hiring column's cells need, carried in the column definition's `meta` (beside the style
 * keys OurTable reads) so that the cell renderer can be one module-level function: TanStack
 * renders a cell function as a React component, so a renderer made anew on each render would be
 * a new component type and remount the cell, losing a Staff Comments draft and its focus.
 */
type HiringMeta = {
  hiringColumn: HiringColumn;
  hiring: HiringProps | undefined;
  testIdPrefix: string;
};

const hiringMetaOf = (cell: Cell<string[], unknown>): HiringMeta =>
  cell.column.columnDef.meta as unknown as HiringMeta;

/** A hiring column's cell: its control, or nothing when the table has no hiring data. */
function HiringCellRenderer({
  cell,
}: {
  cell: Cell<string[], unknown>;
}): React.JSX.Element | null {
  const { hiringColumn, hiring, testIdPrefix } = hiringMetaOf(cell);
  return hiring === undefined ? null : (
    <HiringCell
      column={hiringColumn}
      rowIndex={cell.row.index}
      hiring={hiring}
      testIdPrefix={testIdPrefix}
    />
  );
}

/**
 * The control in one hiring cell: a stamped checkbox, the New Hire form dropdown with its stamp,
 * the Staff Comments box, or the Funding dropdown (labelled by abbreviation, the explanation as
 * the tooltip). Each change is saved at once with the row's application id; the control is
 * disabled while its own save is in flight. Test ids: `${testIdPrefix}-hiring-row-${i}-${columnId}`
 * and, for the stamped controls, the StampedCheckbox/StampedSelect suffixes under that.
 */
function HiringCell({
  column,
  rowIndex,
  hiring,
  testIdPrefix,
}: HiringCellProps): React.JSX.Element {
  const applicationId = hiring.applicationIds[rowIndex];
  const record: HiringRecord | undefined =
    hiring.records[String(applicationId)];
  const disabled =
    hiring.pending !== null &&
    hiring.pending.applicationId === applicationId &&
    hiring.pending.field === column.field;
  const save = (value: string) =>
    hiring.onChange({ applicationId, field: column.field, value });
  // The DOM id, which the control's label is tied to: unique per row and field on the page.
  const id = `${testIdPrefix}-${applicationId}-${column.id}`;
  const testId = `${testIdPrefix}-hiring-row-${rowIndex}-${column.id}`;
  switch (column.kind) {
    case "checkbox":
      return (
        <StampedCheckbox
          id={id}
          label={column.heading}
          hideLabel
          stamp={record?.[column.stampKey] ?? null}
          disabled={disabled}
          onChange={(checked) => save(String(checked))}
          testIdPrefix={testId}
        />
      );
    case "select":
      return (
        <StampedSelect
          id={id}
          label={column.heading}
          hideLabel
          options={[...NEW_HIRE_FORM_OPTIONS]}
          value={record?.newHireForm ?? null}
          stamp={record?.[column.stampKey] ?? null}
          disabled={disabled}
          onChange={(value) => save(value ?? "")}
          testIdPrefix={testId}
        />
      );
    case "text": {
      const stored = record?.staffComments ?? "";
      return (
        <StaffCommentsCell
          key={stored}
          id={id}
          label={column.heading}
          stored={stored}
          disabled={disabled}
          onSave={save}
          testId={testId}
        />
      );
    }
    default:
      return (
        <Form.Select
          id={id}
          size="sm"
          aria-label={column.heading}
          // Stryker disable next-line StringLiteral : React selects the first option, the blank
          // one, whenever the value matches no option, so any other literal here renders the same DOM
          value={record?.fundingSource ?? ""}
          disabled={disabled}
          onChange={(e) => save(e.target.value)}
          data-testid={testId}
        >
          <option value=""></option>
          {hiring.fundingSources.map((source) => (
            <option
              key={source.abbreviation}
              value={source.abbreviation}
              title={source.explanation}
            >
              {source.abbreviation}
            </option>
          ))}
        </Form.Select>
      );
  }
}

/**
 * One of the two tables of the Soft Offer Results page (issue #487), built on OurTable (issue
 * #494): every column sortable, the columns in the page's Columns menu hideable from it or from
 * the "hide" link over their headings, and Comments resizable. The table scrolls sideways when
 * Comments is dragged wider than the page, with First name and Last name frozen at the left
 * (issue #510). The main table's hiring columns (issues #509 and #512) hold controls that save
 * each change at once; a hiring column sorts by its stored value and stamp (see compareHiring).
 */
export default function SoftOfferResultsTable({
  headers,
  rows,
  columnIds,
  hiddenColumns,
  choices,
  onHide,
  testIdPrefix,
  hiring,
}: Props): React.JSX.Element {
  const recordOf = (index: number): HiringRecord | null =>
    hiring?.records[String(hiring.applicationIds[index])] ?? null;
  const column = (layout: ResultsColumn): LegacyColumn => {
    if (layout.hiring === null) {
      const i = layout.textIndex;
      return {
        header: layout.heading,
        id: layout.id,
        accessorFn: (row: string[]) => row[i],
        ...textPresentation(layout.id, i),
      };
    }
    const hiringColumn = layout.hiring;
    return {
      header: layout.heading,
      id: layout.id,
      // The row's record (null without one): what the column sorts by, through compareHiring.
      accessorFn: (_row: string[], index: number) => recordOf(index),
      // Ascending first, like a text column: TanStack would sort an object column descending.
      sortDescFirst: false,
      sortingFn: (a: Row<string[]>, b: Row<string[]>, columnId: string) =>
        compareHiring(
          hiringColumn,
          a.getValue<HiringRecord | null>(columnId),
          b.getValue<HiringRecord | null>(columnId),
        ),
      cell: HiringCellRenderer,
      meta: { hiringColumn, hiring, testIdPrefix } satisfies HiringMeta,
    };
  };
  const columns: LegacyColumn[] = layoutColumns(columnIds, headers).map(column);
  return (
    <div className="table-responsive">
      <OurTable
        data={rows}
        columns={columns}
        testid={testIdPrefix}
        fitContent
        columnVisibility={Object.fromEntries(
          hiddenColumns.map((id) => [id, false]),
        )}
        hideLinks={{ choices, onHide }}
        pinnedColumns={PINNED_COLUMN_IDS}
      />
    </div>
  );
}
