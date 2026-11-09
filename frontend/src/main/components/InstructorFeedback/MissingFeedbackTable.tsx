import type { Cell } from "@tanstack/react-table";
import OurTable from "main/components/Common/OurTable";
import type { LegacyColumn } from "main/components/Common/OurTableUtils";
import { InstructorEmailCell } from "main/components/Recruitments/RecruitmentCourseTable";
import {
  NO_EMAIL_ON_FILE,
  courseName,
  type MissingFeedbackRow,
} from "main/utils/instructorFeedbackColumns";

type Props = {
  rows: MissingFeedbackRow[];
  /** Copies one instructor's email, from the control beside it. */
  onCopyEmail: (email: string) => void;
  testIdPrefix?: string;
};

/**
 * The instructors of the quarter's courses who have not checked any box of the feedback form
 * (issue #427): Course and Email, both sortable. An instructor with no email on file is listed
 * with their catalog name instead, and has no copy control.
 */
export default function MissingFeedbackTable({
  rows,
  onCopyEmail,
  testIdPrefix = "MissingFeedbackTable",
}: Props): React.JSX.Element {
  const columns: LegacyColumn[] = [
    {
      header: "Course",
      id: "course",
      accessorFn: courseName,
      cell: ({ cell }: { cell: Cell<MissingFeedbackRow, unknown> }) => (
        <span className="instructor-feedback-course">
          {courseName(cell.row.original)}
        </span>
      ),
    },
    {
      header: "Email",
      id: "email",
      // An instructor with no email sorts last either way.
      accessorFn: (row: MissingFeedbackRow) => row.email ?? undefined,
      sortUndefined: "last" as const,
      cell: ({ cell }: { cell: Cell<MissingFeedbackRow, unknown> }) => {
        const row = cell.row.original;
        return row.email === null ? (
          <span className="text-muted">
            {NO_EMAIL_ON_FILE} ({row.instructorName})
          </span>
        ) : (
          <InstructorEmailCell
            email={row.email}
            index={cell.row.index}
            testIdPrefix={testIdPrefix}
            onCopyEmail={onCopyEmail}
          />
        );
      },
    },
  ];

  return (
    <OurTable data={rows} columns={columns} testid={testIdPrefix} fitContent />
  );
}
