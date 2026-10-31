import OurTable from "main/components/Common/OurTable";
import { useBackendMutation } from "main/utils/useBackend";
import { Badge, Button } from "react-bootstrap";
import type { Cell } from "@tanstack/react-table";
import type { AxiosRequestConfig } from "axios";
import { Link } from "react-router";

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
  /** Added by an admin by enroll code rather than by Populate (issue #125). */
  manuallyAdded?: boolean;
};

export type RecruitmentCourseRankingSummary = {
  recruitmentCourseId: number;
  rankingCount: number;
  instructorEmail: string | null;
};

// eslint-disable-next-line react-refresh/only-export-components -- shared by the table and its reminder action
export const isValidEmail = (
  email: string | null | undefined,
): email is string =>
  email !== null &&
  email !== undefined &&
  /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email.trim());

/** On the badge of a stale row. */
export const STALE_LABEL = "Stale / not in API";

/** The status the UCSB API reports for a cancelled section; applicants are not offered it. */
export const CANCELLED = "cancelled";

type RecruitmentCourseTableProps = {
  courses: RecruitmentCourse[];
  rankingSummaries?: RecruitmentCourseRankingSummary[];
  showRankings?: boolean;
  onCopyEmail?: (email: string) => void;
  /** Part of the query key to invalidate, so the table reflects the current toggle. */
  includeRemoved: boolean;
  testIdPrefix?: string;
};

export default function RecruitmentCourseTable({
  courses,
  rankingSummaries = [],
  showRankings = false,
  onCopyEmail = () => {},
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
    [
      "/api/recruitmentcourses/all",
      includeRemoved,
      "/api/instructor/recruitments/admin-course-rankings",
    ],
  );

  const shrinkToContent = {
    style: { width: "1%", whiteSpace: "nowrap" as const },
  };
  const rankingSummaryByCourse = new Map(
    rankingSummaries.map((summary) => [summary.recruitmentCourseId, summary]),
  );
  const rows = (Array.isArray(courses) ? courses : []).map((course) => ({
    ...course,
    rankingCount: rankingSummaryByCourse.get(course.id)?.rankingCount ?? null,
    instructorEmail:
      rankingSummaryByCourse.get(course.id)?.instructorEmail ?? null,
  }));

  const columns = [
    ...(showRankings
      ? [
          {
            header: "Rankings",
            accessorKey: "rankingCount",
            meta: shrinkToContent,
            cell: ({
              cell,
            }: {
              cell: Cell<
                RecruitmentCourse & {
                  rankingCount: number | null;
                  instructorEmail: string | null;
                },
                unknown
              >;
            }) => {
              const course = cell.row.original;
              if (course.rankingCount === null) {
                return <span aria-label="Ranking count unavailable">—</span>;
              }
              return (
                <Link
                  to={`/recruitments/${course.recruitmentId}/courses/${course.id}/ranking`}
                  data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-ranking-link`}
                >
                  {course.rankingCount}
                </Link>
              );
            },
          },
        ]
      : []),
    {
      header: "Course Number",
      accessorKey: "courseId",
      meta: shrinkToContent,
      // Padded and monospaced, exactly as Admin/Courses renders it, so the sort order is legible.
      cell: ({ cell }: { cell: Cell<RecruitmentCourse, unknown> }) => (
        <>
          <span style={{ whiteSpace: "pre", fontFamily: "monospace" }}>
            {cell.row.original.courseId}
          </span>
          {cell.row.original.manuallyAdded && (
            <Badge
              bg="info"
              text="dark"
              className="ms-2"
              title="Added by an admin by enroll code"
              data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-manual`}
            >
              manual
            </Badge>
          )}
        </>
      ),
    },
    { header: "Section", accessorKey: "section", meta: shrinkToContent },
    {
      header: "Title",
      accessorKey: "title",
      meta: { style: { width: "100%" } },
    },
    { header: "Instructor", accessorKey: "instructor", meta: shrinkToContent },
    {
      header: "Email",
      accessorKey: "instructorEmail",
      meta: shrinkToContent,
      cell: ({
        cell,
      }: {
        cell: Cell<
          RecruitmentCourse & {
            rankingCount: number | null;
            instructorEmail: string | null;
          },
          unknown
        >;
      }) => {
        const email = cell.row.original.instructorEmail;
        if (!isValidEmail(email)) {
          return (
            <span
              data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-unmapped`}
            >
              Not mapped
            </span>
          );
        }
        return (
          <>
            <span>{email}</span>
            <Button
              variant="link"
              size="sm"
              className="p-0 ms-2"
              aria-label={`Copy ${email}`}
              onClick={() => onCopyEmail(email)}
              data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-copy-email`}
            >
              Copy
            </Button>
          </>
        );
      },
    },
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
      data={Array.isArray(courses) ? rows : []}
      columns={columns}
      testid={testIdPrefix}
    />
  );
}
