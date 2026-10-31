import { Badge, Form } from "react-bootstrap";
import type { Cell } from "@tanstack/react-table";
import OurTable from "main/components/Common/OurTable";
import type { LegacyColumn } from "main/components/Common/OurTableUtils";
import {
  assignedCourse,
  courseLabel,
  courseOptionLabel,
  identityLabel,
  rankFor,
  type AssignmentCourse,
  type AssignmentRow,
  type Assignments,
} from "main/utils/assignments";

/** What the Tentative Assignment column's cells need, handed to them through the column's meta. */
type TentativeColumnMeta = {
  testIdPrefix: string;
  courses: AssignmentCourse[];
  onAssign: (applicationId: number, recruitmentCourseId: number | null) => void;
};

/**
 * One row's Tentative Assignment dropdown (issue #179): blank, then every lecture of the
 * recruitment. A module-level component, like the boxes of the course table, so that TanStack does
 * not remount it on every render. Choosing an entry saves at once.
 */
function TentativeAssignmentCell({
  cell,
}: {
  cell: Cell<AssignmentRow, unknown>;
}): React.JSX.Element {
  const meta = cell.column.columnDef.meta as TentativeColumnMeta;
  const row = cell.row.original;
  return (
    <Form.Select
      size="sm"
      aria-label={`Tentative assignment for ${row.identity.email}`}
      // Stryker disable all : a select shows a value with no matching option as blank anyway
      value={
        row.tentativeAssignment === null ? "" : String(row.tentativeAssignment)
      }
      // Stryker restore all
      onChange={(e) =>
        meta.onAssign(
          row.applicationId,
          e.target.value === "" ? null : Number(e.target.value),
        )
      }
      data-testid={`${meta.testIdPrefix}-cell-row-${cell.row.index}-tentative-select`}
    >
      <option value=""></option>
      {meta.courses.map((course) => (
        <option key={course.id} value={String(course.id)}>
          {courseOptionLabel(course)}
        </option>
      ))}
    </Form.Select>
  );
}

/**
 * A lecture's column heading: its name, then three lines that stay put whatever the sort order:
 * the allocation, how many applicants are pencilled into it, and how many places are left (in red
 * when more are assigned than allocated).
 */
function CourseHeader({
  course,
  testIdPrefix,
}: {
  course: AssignmentCourse;
  testIdPrefix: string;
}): React.JSX.Element {
  const id = `${testIdPrefix}-course-${course.id}`;
  return (
    <div style={{ minWidth: "9em" }} data-testid={`${id}-header`}>
      <div data-testid={`${id}-label`}>
        {courseLabel(course)}
        {course.historical && (
          <Badge
            bg="secondary"
            className="ms-1"
            data-testid={`${id}-historical`}
          >
            not offered
          </Badge>
        )}
      </div>
      <div className="small fw-normal" data-testid={`${id}-allocation`}>
        Allocation {course.allocation}
      </div>
      <div className="small fw-normal" data-testid={`${id}-assigned`}>
        Assigned {course.assigned}
      </div>
      <div
        className={`small fw-normal${course.left < 0 ? " text-danger" : ""}`}
        data-testid={`${id}-left`}
      >
        Left {course.left}
      </div>
    </div>
  );
}

type AssignmentsTableProps = {
  data: Assignments;
  onAssign: (applicationId: number, recruitmentCourseId: number | null) => void;
  testIdPrefix?: string;
};

/**
 * The admin Assignments table (issue #179): the rankings CSV's identity columns, a Tentative
 * Assignment dropdown, then one column per lecture with that lecture's rank for each applicant.
 * Every column sorts; a lecture column keeps the unranked applicants after the ranked ones in
 * either direction.
 */
export default function AssignmentsTable({
  data,
  onAssign,
  testIdPrefix = "AssignmentsTable",
}: AssignmentsTableProps): React.JSX.Element {
  const tentativeMeta: TentativeColumnMeta = {
    testIdPrefix,
    courses: data.courses,
    onAssign,
  };
  const columns: LegacyColumn[] = [
    ...data.identityHeaders.map((header): LegacyColumn => ({
      id: header,
      header: identityLabel(header),
      accessorFn: (row: AssignmentRow) => row.identity[header],
    })),
    {
      id: "tentativeAssignment",
      header: "Tentative Assignment",
      accessorFn: (row: AssignmentRow) => {
        const course = assignedCourse(row, data.courses);
        return course === null ? "" : courseLabel(course);
      },
      cell: TentativeAssignmentCell,
      meta: tentativeMeta,
    },
    ...data.courses.map((course): LegacyColumn => ({
      id: `course-${course.id}`,
      header: <CourseHeader course={course} testIdPrefix={testIdPrefix} />,
      accessorFn: (row: AssignmentRow) => rankFor(row, course),
      // An unranked applicant sorts after every ranked one, ascending or descending. Rank 1 is
      // the top choice, so the first click lists the ranked applicants best first, not the
      // descending order TanStack would give a number column.
      sortUndefined: "last",
      sortingFn: "basic",
      sortDescFirst: false,
      meta: { style: { textAlign: "center" } },
    })),
  ];
  return <OurTable data={data.rows} columns={columns} testid={testIdPrefix} />;
}
