import OurTable from "main/components/Common/OurTable";
import { useBackendMutation } from "main/utils/useBackend";
import { Form } from "react-bootstrap";
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

  const columns = [
    {
      header: "Course Number",
      accessorKey: "courseId",
    },
    {
      header: "Title",
      accessorKey: "title",
    },
    flagColumn("TA", "needsTa", "TA"),
    flagColumn("ULA", "needsUla", "ULA"),
  ];

  return (
    <OurTable
      data={Array.isArray(courses) ? courses : []}
      columns={columns}
      testid={testIdPrefix}
    />
  );
}
