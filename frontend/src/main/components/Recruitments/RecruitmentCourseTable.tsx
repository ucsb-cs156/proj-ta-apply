import OurTable, { type HideLinks } from "main/components/Common/OurTable";
import { useBackendMutation } from "main/utils/useBackend";
import {
  allocationDelta,
  deltaDisplay,
  oneDecimal,
  ratioDisplay,
  unroundedTooltip,
} from "main/utils/allocations";
import { Badge, Button, OverlayTrigger, Tooltip } from "react-bootstrap";
import type { Cell } from "@tanstack/react-table";
import type { AxiosRequestConfig } from "axios";
import { Link } from "react-router";
import { isSummerQuarter } from "main/utils/courseColumns";
import { COURSE_NUMBER_WIDTH } from "main/utils/columnWidths";
import {
  numeric,
  shrinkToContent,
  stacked,
} from "main/components/Common/columnStyles";

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
  /**
   * How many TAs or ULAs the admin has allocated to this section (issue #174); 0 until set. Null
   * in the rows an instructor gets while the admin hides allocations from faculty (issue #178).
   */
  allocation?: number | null;
  /** The admin's estimate of the section's enrollment (issue #175); null until entered. */
  enrollmentEstimate?: number | null;
  /** Its fractional share of the hiring target by estimate (issue #176); null until computed. */
  unroundedAllocation?: number | null;
  /** Counts the changes to the allocation (issue #278); an edit carries it to prove it is current. */
  allocationVersion?: number;
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

/**
 * The Allocation and Enrollment Estimate columns are figures here, never boxes. Since issue #358 an
 * admin edits them on the Combined Allocation page (/admin/allocations/QXX), through
 * useAllocationSaves and useEstimateSaves; the admin's Recruitment Courses pages omit these
 * columns altogether, and the only table that still shows them is the faculty Courses page (issue
 * #300), which is read-only.
 */

/** Bootstrap's clipboard icon, for the copy control beside an email (issue #185). */
const CopyIcon = (): React.JSX.Element => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    fill="currentColor"
    viewBox="0 0 16 16"
    aria-hidden="true"
    data-testid="copy-icon"
  >
    <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1z" />
    <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0z" />
  </svg>
);

/**
 * One row's ranking count, linking to the course's ranking page; a dash when the count is not
 * known. Shared by the Recruitment Courses table and the Combined Allocation table (issue #358).
 */
export function RankingCountCell({
  course,
  rankingCount,
  index,
  testIdPrefix,
}: {
  course: Pick<RecruitmentCourse, "id" | "recruitmentId">;
  rankingCount: number | null;
  index: number;
  testIdPrefix: string;
}): React.JSX.Element {
  if (rankingCount === null) {
    return <span aria-label="Ranking count unavailable">—</span>;
  }
  return (
    <Link
      to={`/recruitments/${course.recruitmentId}/courses/${course.id}/ranking`}
      data-testid={`${testIdPrefix}-cell-row-${index}-ranking-link`}
    >
      {rankingCount}
    </Link>
  );
}

/**
 * One row's instructor email with its copy control, or the link to where the instructor's catalog
 * name is mapped to one (issue #185). Shared with the Combined Allocation table (issue #358).
 */
export function InstructorEmailCell({
  email,
  index,
  testIdPrefix,
  onCopyEmail,
}: {
  email: string | null | undefined;
  index: number;
  testIdPrefix: string;
  onCopyEmail: (email: string) => void;
}): React.JSX.Element {
  if (!isValidEmail(email)) {
    // Straight to where the mapping is made, in a new tab so the table is not lost (#185).
    return (
      <a
        href="/admin/instructors"
        target="_blank"
        rel="noreferrer"
        title="Map this instructor's catalog name to an email on the Instructors page"
        data-testid={`${testIdPrefix}-cell-row-${index}-unmapped`}
      >
        Not mapped
      </a>
    );
  }
  return (
    <>
      <span>{email}</span>
      <Button
        variant="link"
        size="sm"
        className="p-0 ms-2"
        title="Copy"
        aria-label={`Copy ${email}`}
        onClick={() => onCopyEmail(email)}
        data-testid={`${testIdPrefix}-cell-row-${index}-copy-email`}
      >
        <CopyIcon />
      </Button>
    </>
  );
}

/**
 * One row's status. A cancelled lecture is shown as a red badge, since applicants no longer see it
 * (issue #123); a stale row keeps its last known status, with a warning beside it so the admin can
 * decide whether to Remove it (issue #122). Shared with the Combined Allocation table (#358).
 */
export function StatusCell({
  course,
  index,
  testIdPrefix,
}: {
  course: Pick<RecruitmentCourse, "status" | "stale">;
  index: number;
  testIdPrefix: string;
}): React.JSX.Element {
  return (
    <>
      {course.status === CANCELLED ? (
        <Badge
          bg="danger"
          data-testid={`${testIdPrefix}-cell-row-${index}-cancelled`}
        >
          Cancelled
        </Badge>
      ) : (
        course.status
      )}
      {course.stale && (
        <Badge
          bg="warning"
          text="dark"
          className="ms-2"
          data-testid={`${testIdPrefix}-cell-row-${index}-stale`}
        >
          {STALE_LABEL}
        </Badge>
      )}
    </>
  );
}

type RecruitmentCourseTableProps = {
  courses: RecruitmentCourse[];
  /** The recruitment's type, for the headings and tooltips that name it (issue #176). */
  type?: "TA" | "ULA";
  rankingSummaries?: RecruitmentCourseRankingSummary[];
  showRankings?: boolean;
  onCopyEmail?: (email: string) => void;
  /** Part of the query key to invalidate, so the table reflects the current toggle. */
  includeRemoved: boolean;
  /** The recruitment's quarter (YYYYQ); the Summer Session column exists only for a summer one. */
  quarter?: string | null;
  /** Column ids the admin has hidden (issue #185); see {@link columnChoices}. */
  hiddenColumns?: string[];
  /** The "hide" links over the hideable columns' headings (issue #314). */
  hideLinks?: HideLinks;
  /**
   * Column ids left out of the table altogether (issue #300), as opposed to hidden: an instructor's
   * table has no allocation columns unless the admin shows them to all faculty. The page does not
   * list them in its Columns menu either, so nothing can bring them back.
   */
  omitColumns?: readonly string[];
  testIdPrefix?: string;
  /** The view-only page (issue #278) and the faculty page: there is no Remove button. */
  readOnly?: boolean;
};

export default function RecruitmentCourseTable({
  courses,
  type = "TA",
  // Stryker disable next-line all : a summary that is no course's is never looked up, like the empty list
  rankingSummaries = [],
  showRankings = false,
  onCopyEmail = () => {},
  includeRemoved,
  quarter = null,
  // Stryker disable next-line all : an id that is no column's hides nothing, like the empty list
  hiddenColumns = [],
  hideLinks,
  // Stryker disable next-line all : an id that is no column's omits nothing, like the empty list
  omitColumns = [],
  testIdPrefix = "RecruitmentCourseTable",
  readOnly = false,
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

  const rankingSummaryByCourse = new Map(
    rankingSummaries.map((summary) => [summary.recruitmentCourseId, summary]),
  );
  // Anything but a list of courses (a failed read's answer, say) is shown as no courses.
  const list = Array.isArray(courses) ? courses : [];
  // The totals row (issue #176) adds up the rows that count: removed ones are left out even
  // when the toggle shows them, as they are everywhere else on the page.
  const counted = list.filter((course) => !course.removed);
  const sumOf = (
    pick: (course: RecruitmentCourse) => number | null | undefined,
  ) => counted.reduce((sum, course) => sum + (pick(course) ?? 0), 0);

  const rows = list.map((course) => ({
    ...course,
    rankingCount: rankingSummaryByCourse.get(course.id)?.rankingCount ?? null,
    instructorEmail:
      rankingSummaryByCourse.get(course.id)?.instructorEmail ?? null,
  }));

  const columns = [
    ...(showRankings
      ? [
          {
            // Two lines in the smaller heading font (issue #386), so the column is no wider than
            // its counts.
            header: stacked("Faculty", "Rankings"),
            accessorKey: "rankingCount",
            meta: numeric,
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
            }) => (
              <RankingCountCell
                course={cell.row.original}
                rankingCount={cell.row.original.rankingCount}
                index={cell.row.index}
                testIdPrefix={testIdPrefix}
              />
            ),
          },
        ]
      : []),
    {
      // Issue #386: the column is about a fifth narrower than it was. Its width is set by the
      // widest thing in it, which was the one-line totals footer, not the heading or a course
      // number; so the heading and the footer are both on two lines in the smaller font, and the
      // cell is exactly as wide as the widest course number, as on the Combined Allocation page.
      header: stacked("Course", "Number"),
      accessorKey: "courseId",
      meta: shrinkToContent,
      // Sort the padded id exactly as stored and shown, code unit by code unit, so "CMPSC     5A"
      // comes before "CMPSC   130A"; TanStack's default would split digits from letters (#185).
      sortingFn: "textCaseSensitive" as const,
      footer: stacked("Total Course Count:", String(counted.length)),
      // Padded and monospaced, exactly as Admin/Courses renders it, so the sort order is legible.
      cell: ({ cell }: { cell: Cell<RecruitmentCourse, unknown> }) => (
        <>
          <span
            style={{
              display: "inline-block",
              minWidth: COURSE_NUMBER_WIDTH,
              whiteSpace: "pre",
              fontFamily: "monospace",
            }}
          >
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
        return (
          <InstructorEmailCell
            email={cell.row.original.instructorEmail}
            index={cell.row.index}
            testIdPrefix={testIdPrefix}
            onCopyEmail={onCopyEmail}
          />
        );
      },
    },
    { header: "Days", accessorKey: "days", meta: shrinkToContent },
    { header: "Time", accessorKey: "time", meta: shrinkToContent },
    { header: "Room", accessorKey: "room", meta: shrinkToContent },
    {
      header: "Enrolled",
      accessorKey: "enrollment",
      meta: numeric,
      footer: String(sumOf((course) => course.enrollment)),
    },
    {
      header: "Max",
      accessorKey: "maxEnroll",
      meta: numeric,
      footer: String(sumOf((course) => course.maxEnroll)),
    },
    {
      header: stacked("Enrollment", "Estimate"),
      accessorKey: "enrollmentEstimate",
      footer: String(sumOf((course) => course.enrollmentEstimate)),
      meta: numeric,
      // No estimate yet shows as nothing, not a zero (issue #175).
      cell: ({ cell }: { cell: Cell<RecruitmentCourse, unknown> }) => (
        <span
          data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-enrollmentEstimate`}
        >
          {cell.row.original.enrollmentEstimate ?? ""}
        </span>
      ),
    },
    {
      header: "Allocation",
      accessorKey: "allocation",
      meta: numeric,
      // A course that was never allocated has 0 positions (issue #174).
      cell: ({ cell }: { cell: Cell<RecruitmentCourse, unknown> }) => (
        <span
          data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-allocation`}
        >
          {cell.row.original.allocation ?? 0}
        </span>
      ),
    },
    {
      header: (
        <OverlayTrigger
          placement="top"
          overlay={
            <Tooltip id={`${testIdPrefix}-unrounded-tooltip`}>
              {unroundedTooltip(type)}
            </Tooltip>
          }
        >
          <span
            style={{ textDecoration: "underline dotted" }}
            data-testid={`${testIdPrefix}-unrounded-heading`}
          >
            {stacked("Unrounded", "Allocation")}
          </span>
        </OverlayTrigger>
      ),
      accessorKey: "unroundedAllocation",
      meta: numeric,
      // Always one decimal place (issue #176); a dash until the backend has computed it.
      cell: ({ cell }: { cell: Cell<RecruitmentCourse, unknown> }) =>
        cell.row.original.unroundedAllocation == null
          ? "\u2014"
          : oneDecimal(cell.row.original.unroundedAllocation),
    },
    {
      header: "Delta",
      id: "delta",
      accessorFn: (course: RecruitmentCourse) => allocationDelta(course),
      meta: numeric,
      // Share minus allocation: green with a plus sign when the course is owed positions, red
      // when it has more than its share, black 0.0 when it is about right (issue #176).
      cell: ({ cell }: { cell: Cell<RecruitmentCourse, unknown> }) => {
        const { text, className } = deltaDisplay(
          allocationDelta(cell.row.original),
        );
        return (
          <span
            className={className}
            data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-delta`}
          >
            {text}
          </span>
        );
      },
    },
    {
      header: stacked(`${type}:student`, "ratio"),
      id: "ratio",
      accessorFn: (course: RecruitmentCourse) => ratioDisplay(course),
      meta: shrinkToContent,
    },
    {
      header: "Status",
      accessorKey: "status",
      meta: shrinkToContent,
      // A cancelled lecture is shown as a red badge, since applicants no longer see it (issue
      // #123); a stale row keeps its last known status, with a warning beside it so the admin can
      // decide whether to Remove it (issue #122).
      cell: ({ cell }: { cell: Cell<RecruitmentCourse, unknown> }) => (
        <StatusCell
          course={cell.row.original}
          index={cell.row.index}
          testIdPrefix={testIdPrefix}
        />
      ),
    },
    // Only a summer quarter's offerings carry a value, so the column exists only then (#185).
    ...(isSummerQuarter(quarter)
      ? [
          {
            header: stacked("Summer", "Session"),
            accessorKey: "summerSession",
            meta: shrinkToContent,
          },
        ]
      : []),
    ...(readOnly
      ? []
      : [
          {
            // No heading: the button's own label says what it does. The cell reads the row itself,
            // so the column needs no accessor.
            header: "",
            id: "removed",
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
        ]),
  ];

  return (
    <OurTable
      data={rows}
      columns={columns}
      testid={testIdPrefix}
      centerHeaders
      // Omitted columns are switched off the same way, but nothing offers to bring them back.
      columnVisibility={Object.fromEntries(
        [...hiddenColumns, ...omitColumns].map((id) => [id, false]),
      )}
      hideLinks={hideLinks}
    />
  );
}
