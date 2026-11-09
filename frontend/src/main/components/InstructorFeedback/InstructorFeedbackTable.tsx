import type { Cell } from "@tanstack/react-table";
import OurTable from "main/components/Common/OurTable";
import type { LegacyColumn } from "main/components/Common/OurTableUtils";
import { stackedWords } from "main/components/Common/columnStyles";
import { InstructorEmailCell } from "main/components/Recruitments/RecruitmentCourseTable";
import { WIDE_COLUMN_MAX_WIDTH } from "main/utils/columnWidths";
import { formatPacificDateTime } from "main/utils/pacificTime";
import {
  COMMENTS_MIN_WIDTH,
  FEEDBACK_COLUMN_CHOICES,
  NOT_APPLICABLE,
  checkboxMark,
  commentsDefaultWidth,
  courseName,
  instructorText,
  yesNo,
  type InstructorFeedbackRow,
} from "main/utils/instructorFeedbackColumns";

const shrinkToContent = {
  style: { width: "1%", whiteSpace: "nowrap" as const },
};

const numeric = {
  style: { ...shrinkToContent.style, textAlign: "right" as const },
};

/** The class in index.css that sizes the read-only checkbox marks. */
const CHECKMARK_CLASS = "instructor-feedback-checkmark";

/** The class in index.css that draws the two-line headings smaller. */
const STACKED_HEADING_CLASS = "instructor-feedback-stacked-heading";

/**
 * A heading with each word on its own line, in the smaller size (the maintainer's requests on issue
 * #427): every column but Course Name, Instructor and Comments. The Columns menu and the "hide"
 * links keep the one-line labels of FEEDBACK_COLUMN_CHOICES.
 */
const heading = (text: string): React.JSX.Element =>
  stackedWords(text, STACKED_HEADING_CLASS);

type Props = {
  rows: InstructorFeedbackRow[];
  /** Column ids hidden; see FEEDBACK_COLUMN_CHOICES. */
  hiddenColumns: string[];
  /** Hides one column, as unticking it in the Columns menu does. */
  onHide: (columnId: string) => void;
  /** Copies an instructor's email, from the control beside it. */
  onCopyEmail: (email: string) => void;
  testIdPrefix?: string;
};

/**
 * The admin's table of a quarter's instructor feedback (issue #427): one row per feedback record,
 * every column sortable, every column but Course Name hideable. Comments starts at 80% of the
 * window (at least 200px), can be dragged no narrower than 200px, and wraps within its width.
 */
export default function InstructorFeedbackTable({
  rows,
  hiddenColumns,
  onHide,
  onCopyEmail,
  testIdPrefix = "InstructorFeedbackTable",
}: Props): React.JSX.Element {
  const flag = (id: keyof InstructorFeedbackRow, label: string) => ({
    header: heading(label),
    id,
    // Sorted on the answer itself, so checked and unchecked rows group together.
    accessorFn: (row: InstructorFeedbackRow) => row[id] as boolean,
    meta: shrinkToContent,
    cell: ({ cell }: { cell: Cell<InstructorFeedbackRow, unknown> }) => {
      const value = cell.row.original[id] as boolean;
      return (
        <span role="img" aria-label={yesNo(value)} className={CHECKMARK_CLASS}>
          {checkboxMark(value)}
        </span>
      );
    },
  });
  // A missing number has nothing to sort by, so it goes last either way.
  const count = (
    id: keyof InstructorFeedbackRow,
    label: string,
    whenMissing: string,
  ) => ({
    header: heading(label),
    id,
    accessorFn: (row: InstructorFeedbackRow) => row[id] ?? undefined,
    sortUndefined: "last" as const,
    meta: numeric,
    cell: ({ cell }: { cell: Cell<InstructorFeedbackRow, unknown> }) =>
      cell.row.original[id] ?? whenMissing,
  });

  const columns: LegacyColumn[] = [
    {
      header: "Course Name",
      id: "course",
      accessorFn: courseName,
      meta: shrinkToContent,
      cell: ({ cell }: { cell: Cell<InstructorFeedbackRow, unknown> }) => (
        <span className="instructor-feedback-course">
          {courseName(cell.row.original)}
        </span>
      ),
    },
    {
      header: "Instructor",
      id: "instructor",
      accessorFn: instructorText,
      meta: shrinkToContent,
      cell: ({ cell }: { cell: Cell<InstructorFeedbackRow, unknown> }) => {
        const row = cell.row.original;
        return (
          <>
            {row.instructorName && (
              <>
                {row.instructorName}
                <br />
              </>
            )}
            <InstructorEmailCell
              email={row.email}
              index={cell.row.index}
              testIdPrefix={testIdPrefix}
              onCopyEmail={onCopyEmail}
            />
          </>
        );
      },
    },
    flag("allocReasonable", "Alloc Reasonable"),
    flag("differentTACount", "Diff TA Count"),
    count("taAllocation", "TA Allocation", NOT_APPLICABLE),
    count("numTAsPreferred", "Preferred TA Allocation", ""),
    flag("differentULACount", "Diff ULA Count"),
    count("ulaAllocation", "ULA Allocation", NOT_APPLICABLE),
    flag("otherConcerns", "Other Concerns"),
    count("numULAsPreferred", "Preferred ULA Allocation", ""),
    {
      header: "Comments",
      id: "comments",
      accessorFn: (row: InstructorFeedbackRow) => row.comments ?? "",
      size: commentsDefaultWidth(window.innerWidth),
      minSize: COMMENTS_MIN_WIDTH,
      maxSize: WIDE_COLUMN_MAX_WIDTH,
      enableResizing: true,
      meta: {
        style: { whiteSpace: "pre-wrap" as const, overflowWrap: "anywhere" },
      },
    },
    {
      header: heading("Last Updated"),
      id: "lastUpdated",
      accessorFn: (row: InstructorFeedbackRow) => row.lastUpdated ?? "",
      meta: shrinkToContent,
      cell: ({ cell }: { cell: Cell<InstructorFeedbackRow, unknown> }) =>
        formatPacificDateTime(cell.row.original.lastUpdated),
    },
  ];

  return (
    <OurTable
      data={rows}
      columns={columns}
      testid={testIdPrefix}
      fitContent
      columnVisibility={Object.fromEntries(
        hiddenColumns.map((id) => [id, false]),
      )}
      hideLinks={{ choices: FEEDBACK_COLUMN_CHOICES, onHide }}
    />
  );
}
