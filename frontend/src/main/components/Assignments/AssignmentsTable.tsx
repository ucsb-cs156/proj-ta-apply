import { Badge, Form } from "react-bootstrap";
import type { Cell, Row } from "@tanstack/react-table";
import OurTable, { type HideLinks } from "main/components/Common/OurTable";
import InterestMark from "main/components/Common/InterestMark";
import { shrinkToContent, stacked } from "main/components/Common/columnStyles";
import { compareByRankThenPreference } from "main/utils/candidateOrder";
import { interestDisplay } from "main/utils/interestDisplay";
import { wideColumnProps } from "main/utils/columnWidths";
import type { LegacyColumn } from "main/components/Common/OurTableUtils";
import {
  compareTentativeAssignments,
  courseColumnId,
  TENTATIVE_COLUMN_ID,
} from "main/utils/assignmentColumns";
import {
  assignedCourse,
  COURSE_LABEL_WIDTH,
  courseOptionLabel,
  identityLabel,
  labelCourses,
  preferenceFor,
  rankFor,
  type AssignmentCourse,
  type AssignmentRow,
  type Assignments,
  type LabelledCourse,
} from "main/utils/assignments";

/** A lecture of the page with the label the page shows for it. */
type Course = LabelledCourse<AssignmentCourse>;

/**
 * A lecture's name in a monospace font with its spaces kept, so the padded labels line up (issue
 * #355): the `course-label` class in index.css (issue #415).
 */
const COURSE_LABEL_CLASS = "course-label";

/**
 * The dropdown's width: the longest label, plus its two 1px borders, the small select's left
 * padding (0.5rem) and the room Bootstrap keeps on the right for the arrow (2.25rem). The `ch` is
 * the dropdown's own monospace font, so the longest label fits exactly (issue #355). Inline, not in
 * index.css, because it is derived from LONGEST_COURSE_LABEL and must not drift from it.
 */
const TENTATIVE_SELECT_WIDTH = `calc(${COURSE_LABEL_WIDTH} + 2px + 2.75rem)`;

/** What the Tentative Assignment column's cells need, handed to them through the column's meta. */
type TentativeColumnMeta = {
  testIdPrefix: string;
  courses: Course[];
  onAssign: (applicationId: number, recruitmentCourseId: number | null) => void;
  /** No wider than its dropdown (issue #355): the slack goes to the applicant's columns. */
  style: { width: string; whiteSpace: "nowrap" };
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
      className={COURSE_LABEL_CLASS}
      style={{ width: TENTATIVE_SELECT_WIDTH }}
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

/** The widest of the three count labels; the other two are padded to it so the counts line up. */
const COUNT_LABEL_WIDTH = "Allocation".length;

/** " To Assign 1": a count line of a lecture's heading, its label right-aligned under "Allocation". */
const countLine = (label: string, count: number): string =>
  `${label.padStart(COUNT_LABEL_WIDTH)} ${count}`;

/** The classes of a count line (issue #415): a size smaller than `small`, and not bold. */
const COUNT_LINE_CLASSES = "course-heading-count fw-normal";

/**
 * A lecture's column heading: its name, then three lines that stay put whatever the sort order:
 * the allocation, how many applicants are pencilled into it, and how many places are still to
 * assign (in red when more are assigned than allocated). Monospace with the spaces kept (issue
 * #355), so the counts line up under the name; the column itself is a fixed 100px (issue #415,
 * `course-column` in index.css), so every lecture column is the same width.
 */
function CourseHeader({
  course,
  testIdPrefix,
}: {
  course: Course;
  testIdPrefix: string;
}): React.JSX.Element {
  const id = `${testIdPrefix}-course-${course.id}`;
  return (
    <div className={COURSE_LABEL_CLASS} data-testid={`${id}-header`}>
      <div className="course-heading-label" data-testid={`${id}-label`}>
        {course.label}
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
      <div className={COUNT_LINE_CLASSES} data-testid={`${id}-allocation`}>
        {countLine("Allocation", course.allocation)}
      </div>
      <div className={COUNT_LINE_CLASSES} data-testid={`${id}-assigned`}>
        {countLine("Assigned", course.assigned)}
      </div>
      <div
        className={`${COUNT_LINE_CLASSES}${course.left < 0 ? " text-danger" : ""}`}
        data-testid={`${id}-left`}
      >
        {countLine("To Assign", course.left)}
      </div>
    </div>
  );
}

/** What a lecture column's cells need, handed to them through the column's meta. */
type CourseColumnMeta = {
  course: Course;
  testIdPrefix: string;
  /** On the heading and every cell (OurTable): 100px wide, right-aligned ranks (issue #415). */
  className: "course-column";
};

/**
 * One lecture's cell for one applicant (issue #199): the rank, right-aligned, on a pastel
 * background that says how interested the applicant is in the course, with a symbol at the left
 * for readers who cannot tell the colours apart. The cell of the lecture the applicant is
 * pencilled into has a thick black outline (issue #415). A module-level component so TanStack does
 * not remount it on every render.
 */
function CourseRankCell({
  cell,
}: {
  cell: Cell<AssignmentRow, unknown>;
}): React.JSX.Element {
  const meta = cell.column.columnDef.meta as CourseColumnMeta;
  const row = cell.row.original;
  const preference = preferenceFor(row, meta.course);
  const rank = rankFor(row, meta.course);
  const selected = row.tentativeAssignment === meta.course.id;
  const id = `${meta.testIdPrefix}-cell-row-${cell.row.index}-course-${meta.course.id}`;
  return (
    <div
      className={`d-flex justify-content-between align-items-center px-1 ${interestDisplay(preference).className}${selected ? " selected-course-assignment-cell" : ""}`}
      data-testid={id}
    >
      <InterestMark preference={preference} testId={`${id}-mark`} />
      <span data-testid={`${id}-rank`}>{rank ?? ""}</span>
    </div>
  );
}

type AssignmentsTableProps = {
  data: Assignments;
  onAssign: (applicationId: number, recruitmentCourseId: number | null) => void;
  /** Column ids the admin has hidden (issue #314); see assignmentColumns. */
  hiddenColumns?: string[];
  /** The "hide" links over the hideable columns' headings (issue #314). */
  hideLinks?: HideLinks;
  testIdPrefix?: string;
};

/**
 * The admin Assignments table (issue #179): the rankings CSV's identity columns, a Tentative
 * Assignment dropdown, then one column per lecture with that lecture's rank for each applicant.
 * Every column sorts; a lecture column sorts like the faculty ranking page's default order: the
 * ranked applicants by rank, then the unranked by the student's preference (issue #345).
 */
export default function AssignmentsTable({
  data,
  onAssign,
  // Stryker disable next-line all : an id that is no column's hides nothing, like the empty list
  hiddenColumns = [],
  hideLinks,
  testIdPrefix = "AssignmentsTable",
}: AssignmentsTableProps): React.JSX.Element {
  const courses = labelCourses(data.courses);
  const tentativeMeta: TentativeColumnMeta = {
    testIdPrefix,
    courses,
    onAssign,
    style: shrinkToContent.style,
  };
  const columns: LegacyColumn[] = [
    ...data.identityHeaders.map((header): LegacyColumn => ({
      id: header,
      header: identityLabel(header),
      accessorFn: (row: AssignmentRow) => row.identity[header],
      // A long free-text answer, should the rankings CSV carry one, is wide (issue #342).
      ...wideColumnProps(header),
    })),
    {
      id: TENTATIVE_COLUMN_ID,
      header: stacked("Tentative", "Assignment"),
      accessorFn: (row: AssignmentRow) => {
        const course = assignedCourse(row, courses);
        // Stryker disable next-line StringLiteral : the value is only ever sorted, by the comparison
        // below, where any other text would also come after every label (they start with a space
        // or a digit) and tie with itself, so no test can tell a blank from other text
        return course === null ? "" : course.label;
      },
      // Blank rows last ascending, first descending (issue #348).
      sortingFn: (a: Row<AssignmentRow>, b: Row<AssignmentRow>) =>
        compareTentativeAssignments(
          a.getValue<string>(TENTATIVE_COLUMN_ID),
          b.getValue<string>(TENTATIVE_COLUMN_ID),
        ),
      cell: TentativeAssignmentCell,
      meta: tentativeMeta,
    },
    ...courses.map((course): LegacyColumn => ({
      id: courseColumnId(course.id),
      header: <CourseHeader course={course} testIdPrefix={testIdPrefix} />,
      // Stryker disable next-line all : the cell and the sortingFn below read the row, not this
      accessorFn: (row: AssignmentRow) => rankFor(row, course),
      // The faculty ranking page's default order (issue #345): ranked applicants first, rank 1
      // down, then the unranked by the student's preference. Applicants who tie keep the order
      // they applied in (rows arrive by application id, and TanStack's sort is stable). The first
      // click gives that order; the second reverses it.
      sortingFn: (a: Row<AssignmentRow>, b: Row<AssignmentRow>) =>
        compareByRankThenPreference(
          {
            rank: rankFor(a.original, course),
            preference: preferenceFor(a.original, course),
          },
          {
            rank: rankFor(b.original, course),
            preference: preferenceFor(b.original, course),
          },
        ),
      sortDescFirst: false,
      cell: CourseRankCell,
      meta: {
        course,
        testIdPrefix,
        className: "course-column",
      } satisfies CourseColumnMeta,
    })),
  ];
  return (
    <OurTable
      data={data.rows}
      columns={columns}
      testid={testIdPrefix}
      columnVisibility={Object.fromEntries(
        hiddenColumns.map((id) => [id, false]),
      )}
      hideLinks={hideLinks}
    />
  );
}
