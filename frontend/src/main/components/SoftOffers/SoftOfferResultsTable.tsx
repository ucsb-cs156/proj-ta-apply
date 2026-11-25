import type { Cell } from "@tanstack/react-table";
import type { ColumnChoice } from "main/components/Common/ColumnVisibilityControl";
import OurTable from "main/components/Common/OurTable";
import type { LegacyColumn } from "main/components/Common/OurTableUtils";
import { formatStamp, isStaleStatus } from "main/utils/softOffers";
import {
  COMMENTS_COLUMN_ID,
  COMMENTS_DEFAULT_WIDTH,
  COMMENTS_MIN_WIDTH,
  STAMP_COLUMN_ID,
  STATUS_COLUMN_ID,
  commentsMaxWidth,
} from "main/utils/softOfferResultsColumns";

type Props = {
  /** The backend's headings, one per id, in order. */
  headers: string[];
  /** The backend's rows, each a list of cells in the headings' order. */
  rows: string[][];
  /** The ids of the columns, in the headings' order (see softOfferResultsColumns). */
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
};

/** The presentation of one of the backend's text columns: plain text, unless the id says otherwise. */
const presentation = (
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

/**
 * One of the two tables of the Soft Offer Results page (issue #487), built on OurTable (issue
 * #494): every column sortable, the columns in the page's Columns menu hideable from it or from
 * the "hide" link over their headings, and Comments resizable. The table scrolls sideways when
 * Comments is dragged wider than the page.
 */
export default function SoftOfferResultsTable({
  headers,
  rows,
  columnIds,
  hiddenColumns,
  choices,
  onHide,
  testIdPrefix,
}: Props): React.JSX.Element {
  const columns: LegacyColumn[] = columnIds.map((id, i) => ({
    header: headers[i] ?? id,
    id,
    accessorFn: (row: string[]) => row[i],
    ...presentation(id, i),
  }));
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
      />
    </div>
  );
}
