import { Button } from "react-bootstrap";
import type { Cell } from "@tanstack/react-table";
import OurTable from "main/components/Common/OurTable";
import type { LegacyColumn } from "main/components/Common/OurTableUtils";
import { schoolOf, type PriorCourse } from "main/utils/priorCoursework";

type PriorCourseworkTableProps = {
  courses: PriorCourse[];
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  /** Read-only, e.g. on a summary: no Edit / Delete column. */
  readOnly?: boolean;
  testIdPrefix?: string;
};

/**
 * The courses an applicant has listed, sortable by every column (OurTable sorts on header click).
 * Rows are addressed by position, since a row added in the browser has no id yet.
 */
export default function PriorCourseworkTable({
  courses,
  onEdit,
  onDelete,
  readOnly = false,
  testIdPrefix = "PriorCourseworkTable",
}: PriorCourseworkTableProps): React.JSX.Element {
  const shrink = { style: { width: "1%", whiteSpace: "nowrap" as const } };

  const columns: LegacyColumn[] = [
    {
      header: "School",
      id: "school",
      accessorFn: (course: PriorCourse) => schoolOf(course),
      meta: shrink,
    },
    { header: "Course Number", accessorKey: "courseNumber", meta: shrink },
    {
      header: "Course Title",
      accessorKey: "courseTitle",
      meta: { style: { width: "100%" } },
    },
    { header: "Term", accessorKey: "term", meta: shrink },
    { header: "Grade", accessorKey: "grade", meta: shrink },
  ];

  if (!readOnly) {
    columns.push({
      header: "",
      id: "actions",
      enableSorting: false,
      meta: shrink,
      cell: ({ cell }: { cell: Cell<PriorCourse, unknown> }) => (
        <>
          <Button
            size="sm"
            variant="outline-primary"
            className="me-1"
            data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-col-edit-button`}
            onClick={() => onEdit(cell.row.index)}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="danger"
            data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-col-delete-button`}
            onClick={() => onDelete(cell.row.index)}
          >
            Delete
          </Button>
        </>
      ),
    });
  }

  return (
    <OurTable
      // Stryker disable next-line all : don't test default value of empty list
      data={Array.isArray(courses) ? courses : []}
      columns={columns}
      testid={testIdPrefix}
    />
  );
}
