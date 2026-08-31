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

  const toggle = (course: Course, field: "needsTa" | "needsUla") => {
    mutation.mutate({ ...course, [field]: !course[field] });
  };

  const flagColumn = (
    header: string,
    field: "needsTa" | "needsUla",
    shortName: string,
  ) => ({
    header,
    id: field,
    accessorKey: field,
    meta: { style: { width: "1%", whiteSpace: "nowrap" as const } },
    cell: ({ cell }: { cell: Cell<Course, unknown> }) => {
      const course = cell.row.original;
      return (
        <Form.Check
          type="checkbox"
          checked={course[field]}
          onChange={() => toggle(course, field)}
          aria-label={`${shortName} for ${course.courseId}`}
          data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-col-${field}-checkbox`}
        />
      );
    },
  });

  // Widths: everything shrinks to its content except Title, which is given 100% so it absorbs
  // the slack from Bootstrap's full-width table. Without that, the narrow columns get stretched.
  const shrinkToContent = {
    style: { width: "1%", whiteSpace: "nowrap" as const },
  };

  const columns = [
    flagColumn("TA", "needsTa", "TA"),
    flagColumn("ULA", "needsUla", "ULA"),
    {
      header: "Course Number",
      accessorKey: "courseId",
      meta: shrinkToContent,
      // Course ids keep the API's fixed-width padding so they sort numerically. HTML collapses
      // runs of spaces by default, so render them preformatted and monospaced to keep the
      // numbers aligned. The field is at most 13 characters: an 8-character subject code, then a
      // course number of up to 3 digits and 2 letters.
      cell: ({ cell }: { cell: Cell<Course, unknown> }) => (
        <span style={{ whiteSpace: "pre", fontFamily: "monospace" }}>
          {cell.row.original.courseId}
        </span>
      ),
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
      meta: shrinkToContent,
      cell: ({ cell }: { cell: Cell<Course, unknown> }) => (
        <Button
          variant="danger"
          onClick={() => setPendingDelete(cell.row.original.courseId)}
          data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-col-delete-button`}
        >
          Delete
        </Button>
      ),
    },
  ];

  return (
    <>
      <OurTable
        data={Array.isArray(courses) ? courses : []}
        columns={columns}
        testid={testIdPrefix}
      />
      <CourseDeleteModal
        courseId={pendingDelete}
        onConfirm={() => deleteMutation.mutate(pendingDelete as string)}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
