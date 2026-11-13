import OurTable from "main/components/Common/OurTable";
import { useState } from "react";
import { useBackendMutation } from "main/utils/useBackend";
import CourseDeleteModal from "main/components/Courses/CourseDeleteModal";
import { Button, Form } from "react-bootstrap";
import type { Cell } from "@tanstack/react-table";
import type { AxiosRequestConfig } from "axios";

export type Course = {
  courseId: string;
  title: string;
  needsTa: boolean;
  needsUla: boolean;
};

type CourseTableProps = {
  courses: Course[];
  testIdPrefix?: string;
};

type Flag = "needsTa" | "needsUla";

/** What a flag column's checkboxes need, handed to them through the column's meta. */
type FlagMeta = {
  style: { width: string; whiteSpace: "nowrap" };
  field: Flag;
  shortName: string;
  testIdPrefix: string;
  onToggle: (course: Course, field: Flag) => void;
};

/** What the Delete column's buttons need, handed to them through the column's meta. */
type DeleteMeta = {
  style: { width: string; whiteSpace: "nowrap" };
  testIdPrefix: string;
  onDelete: (courseId: string) => void;
};

/*
 * The cells are module-level components (issue #437). A cell function written inside the table is
 * a new component on every render, so React made every checkbox and button anew each time the
 * page re-read the courses in the background, and a keyboard user lost the focus. What changes
 * from render to render (the handlers) comes through the column's meta instead.
 */

/** One course's TA or ULA checkbox; ticking it saves at once. */
function FlagCell({
  cell,
}: {
  cell: Cell<Course, unknown>;
}): React.JSX.Element {
  const meta = cell.column.columnDef.meta as FlagMeta;
  const course = cell.row.original;
  return (
    <Form.Check
      type="checkbox"
      checked={course[meta.field]}
      onChange={() => meta.onToggle(course, meta.field)}
      aria-label={`${meta.shortName} for ${course.courseId}`}
      data-testid={`${meta.testIdPrefix}-cell-row-${cell.row.index}-col-${meta.field}-checkbox`}
    />
  );
}

/**
 * The course number. Course ids keep the API's fixed-width padding so they sort numerically. HTML
 * collapses runs of spaces by default, so they are shown preformatted and monospaced to keep the
 * numbers aligned. The field is at most 13 characters: an 8-character subject code, then a course
 * number of up to 3 digits and 2 letters.
 */
function CourseNumberCell({
  cell,
}: {
  cell: Cell<Course, unknown>;
}): React.JSX.Element {
  return (
    <span style={{ whiteSpace: "pre", fontFamily: "monospace" }}>
      {cell.row.original.courseId}
    </span>
  );
}

/** One course's Delete button; it asks first, in the confirmation modal. */
function DeleteCell({
  cell,
}: {
  cell: Cell<Course, unknown>;
}): React.JSX.Element {
  const meta = cell.column.columnDef.meta as DeleteMeta;
  return (
    <Button
      variant="danger"
      onClick={() => meta.onDelete(cell.row.original.courseId)}
      data-testid={`${meta.testIdPrefix}-cell-row-${cell.row.index}-col-delete-button`}
    >
      Delete
    </Button>
  );
}

export default function CourseTable({
  courses,
  testIdPrefix = "CourseTable",
}: CourseTableProps): React.JSX.Element {
  // Both flags go in one idempotent call, so a click saves immediately without needing a
  // separate endpoint per flag or any unsaved state to manage.
  const objectToAxiosParams = (course: Course): AxiosRequestConfig => ({
    url: "/api/courses/flags",
    method: "PUT",
    params: {
      courseId: course.courseId,
      needsTa: course.needsTa,
      needsUla: course.needsUla,
    },
  });

  const mutation = useBackendMutation<Course, Course>(objectToAxiosParams, {}, [
    "/api/courses/all",
  ]);

  // Which course the confirmation modal is open for; null means closed.
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const deleteMutation = useBackendMutation<string, unknown>(
    (courseId) => ({
      url: "/api/courses/delete",
      method: "DELETE",
      params: { courseId },
    }),
    { onSuccess: () => setPendingDelete(null) },
    ["/api/courses/all"],
  );

  const toggle = (course: Course, field: Flag) => {
    mutation.mutate({ ...course, [field]: !course[field] });
  };

  // Widths: everything shrinks to its content except Title, which is given 100% so it absorbs
  // the slack from Bootstrap's full-width table. Without that, the narrow columns get stretched.
  const shrinkToContent = {
    style: { width: "1%", whiteSpace: "nowrap" as const },
  };

  const flagColumn = (header: string, field: Flag, shortName: string) => ({
    header,
    id: field,
    accessorKey: field,
    meta: {
      ...shrinkToContent,
      field,
      shortName,
      testIdPrefix,
      onToggle: toggle,
    } satisfies FlagMeta,
    cell: FlagCell,
  });

  const columns = [
    flagColumn("TA", "needsTa", "TA"),
    flagColumn("ULA", "needsUla", "ULA"),
    {
      header: "Course Number",
      accessorKey: "courseId",
      meta: shrinkToContent,
      cell: CourseNumberCell,
    },
    {
      header: "Title",
      accessorKey: "title",
      meta: { style: { width: "100%" } },
    },
    {
      header: "Delete",
      id: "delete",
      accessorKey: "courseId",
      meta: {
        ...shrinkToContent,
        testIdPrefix,
        onDelete: setPendingDelete,
      } satisfies DeleteMeta,
      cell: DeleteCell,
    },
  ];

  return (
    <>
      <OurTable
        data={Array.isArray(courses) ? courses : []}
        columns={columns}
        testid={testIdPrefix}
        // A row is its course (issue #437): now that the cells keep the focus across a re-read,
        // a course added or removed before the focused one must not hand that focus, and the
        // next key press, to another course (the #435 bug).
        getRowId={(row) => row.courseId}
      />
      <CourseDeleteModal
        courseId={pendingDelete}
        onConfirm={() => deleteMutation.mutate(pendingDelete as string)}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
