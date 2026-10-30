import OurTable from "main/components/Common/OurTable";
import { useBackendMutation } from "main/utils/useBackend";
import { Badge, Button } from "react-bootstrap";
import type { Cell } from "@tanstack/react-table";
import type { AxiosRequestConfig } from "axios";

export type RecruitmentCourse = {
  id: number;
  recruitmentId: number;
  courseId: string;
  enrollCode: string;
  section: string | null;
  title: string | null;
  instructor: string | null;
  days: string | null;
  time: string | null;
  room: string | null;
  enrollment: number | null;
  maxEnroll: number | null;
  status: string | null;
  summerSession: string | null;
  removed: boolean;
  /** Set by the last Populate when it did not find the row (issue #122); admins still see it. */
  stale?: boolean;
};

/** On the badge of a stale row. */
export const STALE_LABEL = "Stale / not in API";

/** The status the UCSB API reports for a cancelled section; applicants are not offered it. */
export const CANCELLED = "cancelled";

type RecruitmentCourseTableProps = {
  courses: RecruitmentCourse[];
  /** Part of the query key to invalidate, so the table reflects the current toggle. */
  includeRemoved: boolean;
  testIdPrefix?: string;
};

export default function RecruitmentCourseTable({
  courses,
  includeRemoved,
  testIdPrefix = "RecruitmentCourseTable",
}: RecruitmentCourseTableProps): React.JSX.Element {
  const objectToAxiosParams = (
    course: RecruitmentCourse,
  ): AxiosRequestConfig => ({
    url: "/api/recruitmentcourses/removed",
    method: "PUT",
    // Flip it: the button always moves the row to the other state.
    params: { id: course.id, removed: !course.removed },
  });

  const mutation = useBackendMutation<RecruitmentCourse, unknown>(
    objectToAxiosParams,
    {},
    ["/api/recruitmentcourses/all", includeRemoved],
  );

  const shrinkToContent = {
    style: { width: "1%", whiteSpace: "nowrap" as const },
  };

  const columns = [
    {
      header: "Course Number",
      accessorKey: "courseId",
      meta: shrinkToContent,
      // Padded and monospaced, exactly as Admin/Courses renders it, so the sort order is legible.
      cell: ({ cell }: { cell: Cell<RecruitmentCourse, unknown> }) => (
        <span style={{ whiteSpace: "pre", fontFamily: "monospace" }}>
          {cell.row.original.courseId}
        </span>
      ),
    },
    { header: "Section", accessorKey: "section", meta: shrinkToContent },
    {
      header: "Title",
      accessorKey: "title",
      meta: { style: { width: "100%" } },
    },
    { header: "Instructor", accessorKey: "instructor", meta: shrinkToContent },
    { header: "Days", accessorKey: "days", meta: shrinkToContent },
    { header: "Time", accessorKey: "time", meta: shrinkToContent },
    { header: "Room", accessorKey: "room", meta: shrinkToContent },
    { header: "Enrolled", accessorKey: "enrollment", meta: shrinkToContent },
    { header: "Max", accessorKey: "maxEnroll", meta: shrinkToContent },
    {
      header: "Status",
      accessorKey: "status",
      meta: shrinkToContent,
      // A cancelled lecture is shown as a red badge, since applicants no longer see it (issue
      // #123); a stale row keeps its last known status, with a warning beside it so the admin can
      // decide whether to Remove it (issue #122).
      cell: ({ cell }: { cell: Cell<RecruitmentCourse, unknown> }) => (
        <>
          {cell.row.original.status === CANCELLED ? (
            <Badge
              bg="danger"
              data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-cancelled`}
            >
              Cancelled
            </Badge>
          ) : (
            cell.row.original.status
          )}
          {cell.row.original.stale && (
            <Badge
              bg="warning"
              text="dark"
              className="ms-2"
              data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-stale`}
            >
              {STALE_LABEL}
            </Badge>
          )}
        </>
      ),
    },
    // Always present, though only summer offerings carry a value.
    {
      header: "Summer Session",
      accessorKey: "summerSession",
      meta: shrinkToContent,
    },
    {
      header: "",
      id: "removed",
      accessorKey: "removed",
      meta: shrinkToContent,
      // The button's own label and colour say whether the row is removed, so no separate
      // status column is needed. Removed rows only appear when "show removed" is on.
      cell: ({ cell }: { cell: Cell<RecruitmentCourse, unknown> }) => {
        const course = cell.row.original;
        return (
          <Button
            variant={course.removed ? "success" : "danger"}
            onClick={() => mutation.mutate(course)}
            data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-col-removed-button`}
          >
            {course.removed ? "Unremove" : "Remove"}
          </Button>
        );
      },
    },
  ];

  return (
    <OurTable
      data={Array.isArray(courses) ? courses : []}
      columns={columns}
      testid={testIdPrefix}
    />
  );
}
