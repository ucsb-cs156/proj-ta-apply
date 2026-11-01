import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import OurTable from "main/components/Common/OurTable";
import { useBackendMutation } from "main/utils/useBackend";
import {
  allocationDelta,
  deltaDisplay,
  ESTIMATE_SAVE_DELAY_MS,
  isValidAllocation,
  isValidEnrollmentEstimate,
  oneDecimal,
  ratioDisplay,
  unroundedTooltip,
} from "main/utils/allocations";
import { Badge, Button, Form, OverlayTrigger, Tooltip } from "react-bootstrap";
import type { Cell } from "@tanstack/react-table";
import type { AxiosRequestConfig } from "axios";
import { Link } from "react-router";
import { isSummerQuarter } from "main/utils/courseColumns";

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

/** What the Allocation column's cells need, handed to them through the column's meta. */
type AllocationColumnMeta = {
  style: CSSProperties;
  testIdPrefix: string;
  /** What is in each row's box while it has focus, by row id; an absent row shows its value. */
  drafts: Record<number, string>;
  onChange: (course: RecruitmentCourse, value: string) => void;
  onBlur: () => void;
};

/**
 * One row's Allocation box (issue #174). Defined once, at module level, rather than inline in the
 * column list: TanStack renders a function cell as a component, so an inline closure would be a
 * new component type on every render and the box would be remounted, losing focus, each time a
 * keystroke updated the drafts. Saved as soon as a valid number is typed. A removed row keeps its
 * number but cannot be edited, and it is left out of the totals above the table.
 */
function AllocationCell({
  cell,
}: {
  cell: Cell<RecruitmentCourse, unknown>;
}): React.JSX.Element {
  const meta = cell.column.columnDef.meta as AllocationColumnMeta;
  const course = cell.row.original;
  const draft = meta.drafts[course.id];
  const value = draft ?? String(course.allocation ?? 0);
  return (
    <Form.Control
      type="number"
      min={0}
      step={1}
      size="sm"
      style={{ width: "5em" }}
      className="text-end"
      aria-label={`Allocation for ${course.courseId} section ${course.section ?? ""}`}
      value={value}
      isInvalid={draft !== undefined && !isValidAllocation(draft)}
      disabled={course.removed}
      onChange={(e) => meta.onChange(course, e.target.value)}
      onBlur={meta.onBlur}
      data-testid={`${meta.testIdPrefix}-cell-row-${cell.row.index}-allocation`}
    />
  );
}

/** What the Enrollment Estimate column's cells need, handed to them through the column's meta. */
type EstimateColumnMeta = {
  style: CSSProperties;
  testIdPrefix: string;
  drafts: Record<number, string>;
  onChange: (course: RecruitmentCourse, value: string) => void;
  onBlur: (course: RecruitmentCourse) => void;
};

/**
 * One row's Enrollment Estimate box (issue #175), a module-level component for the same reason as
 * AllocationCell. Saved a second after the last keystroke, or at once when the box is left; an
 * empty box clears the estimate.
 */
function EnrollmentEstimateCell({
  cell,
}: {
  cell: Cell<RecruitmentCourse, unknown>;
}): React.JSX.Element {
  const meta = cell.column.columnDef.meta as EstimateColumnMeta;
  const course = cell.row.original;
  const draft = meta.drafts[course.id];
  // Stryker disable next-line StringLiteral : a number box shows any non-number as empty anyway
  const value = draft ?? String(course.enrollmentEstimate ?? "");
  return (
    <Form.Control
      type="number"
      min={0}
      step={1}
      size="sm"
      style={{ width: "6em" }}
      className="text-end"
      aria-label={`Enrollment estimate for ${course.courseId} section ${course.section ?? ""}`}
      value={value}
      isInvalid={draft !== undefined && !isValidEnrollmentEstimate(draft)}
      disabled={course.removed}
      onChange={(e) => meta.onChange(course, e.target.value)}
      onBlur={() => meta.onBlur(course)}
      data-testid={`${meta.testIdPrefix}-cell-row-${cell.row.index}-enrollmentEstimate`}
    />
  );
}

/** The request that saves one estimate; shared by the debounced save and the unmount flush. */
const estimateRequest = (id: number, value: string) => ({
  url: "/api/recruitmentcourses/enrollmentEstimate",
  method: "PUT",
  // Leaving the parameter out clears the estimate.
  params: value === "" ? { id } : { id, enrollmentEstimate: Number(value) },
});

/**
 * A heading on two lines in a smaller font (80% of the other headings), so a column is no wider
 * than its values (issue #185). The space before the break keeps the heading's text whole for
 * screen readers and tests.
 */
const stacked = (top: string, bottom: string): React.JSX.Element => (
  <span style={{ fontSize: "80%" }}>
    {top} <br />
    {bottom}
  </span>
);

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
  testIdPrefix?: string;
};

export default function RecruitmentCourseTable({
  courses,
  type = "TA",
  rankingSummaries = [],
  showRankings = false,
  onCopyEmail = () => {},
  includeRemoved,
  quarter = null,
  // Stryker disable next-line all : an id that is no column's hides nothing, like the empty list
  hiddenColumns = [],
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

  // What is in each row's Allocation box while it has focus, by row id (issue #174); a row that
  // is absent shows its stored value. Cleared on blur, so an invalid entry reverts and a saved
  // one is simply the stored value again.
  const [allocationDrafts, setAllocationDrafts] = useState<
    Record<number, string>
  >({});
  // Put a saved row into every cached course list as soon as the backend answers, so the stored
  // value is right the moment a box is left, not only after the refetch that follows.
  const queryClient = useQueryClient();
  const replaceInCache = (saved: RecruitmentCourse) =>
    queryClient.setQueriesData<RecruitmentCourse[]>(
      { queryKey: ["/api/recruitmentcourses/all"] },
      // Stryker disable next-line all : the query's initial data is an empty list, never undefined
      (old) => (old ?? []).map((c) => (c.id === saved.id ? saved : c)),
    );
  const allocationMutation = useBackendMutation<
    { id: number; allocation: number },
    RecruitmentCourse
  >(
    ({ id, allocation }) => ({
      url: "/api/recruitmentcourses/allocation",
      method: "PUT",
      params: { id, allocation },
    }),
    { onSuccess: replaceInCache },
    ["/api/recruitmentcourses/all", includeRemoved],
  );
  const onAllocationChange = (course: RecruitmentCourse, value: string) => {
    setAllocationDrafts((previous) => ({ ...previous, [course.id]: value }));
    if (isValidAllocation(value)) {
      allocationMutation.mutate({ id: course.id, allocation: Number(value) });
    }
  };
  // Only the focused box can have a draft, since leaving a box clears it, so clearing them all
  // on blur is the same as clearing the one.
  const onAllocationBlur = () => setAllocationDrafts({});

  // The Enrollment Estimate boxes (issue #175) save a second after the last keystroke rather than
  // on each one, since an estimate is usually several digits. A pending save is keyed by row id
  // with the value it will send, so leaving the box, or the page, can send it at once instead.
  const [estimateDrafts, setEstimateDrafts] = useState<Record<number, string>>(
    {},
  );
  const pendingEstimates = useRef<
    Record<number, { timer: ReturnType<typeof setTimeout>; value: string }>
  >({});
  const estimateMutation = useBackendMutation<
    { id: number; value: string },
    RecruitmentCourse
  >(
    ({ id, value }) => estimateRequest(id, value),
    { onSuccess: replaceInCache },
    ["/api/recruitmentcourses/all", includeRemoved],
  );
  const cancelPendingEstimate = (id: number) => {
    const pending = pendingEstimates.current[id];
    if (pending !== undefined) {
      clearTimeout(pending.timer);
      delete pendingEstimates.current[id];
    }
    return pending;
  };
  const onEstimateChange = (course: RecruitmentCourse, value: string) => {
    setEstimateDrafts((previous) => ({ ...previous, [course.id]: value }));
    cancelPendingEstimate(course.id);
    if (isValidEnrollmentEstimate(value)) {
      pendingEstimates.current[course.id] = {
        value,
        timer: setTimeout(() => {
          delete pendingEstimates.current[course.id];
          estimateMutation.mutate({ id: course.id, value });
        }, ESTIMATE_SAVE_DELAY_MS),
      };
    }
  };
  const onEstimateBlur = (course: RecruitmentCourse) => {
    const pending = cancelPendingEstimate(course.id);
    if (pending !== undefined) {
      estimateMutation.mutate({ id: course.id, value: pending.value });
    }
    setEstimateDrafts({});
  };
  // Leaving the page within the second still saves: the pending requests are sent directly, since
  // the component's mutation is gone with it. The ref's contents are mutated in place, never
  // replaced, so the object captured here is the live one.
  // Stryker disable all : any constant dependency list registers the flush once; the flush
  // itself is tested
  useEffect(() => {
    const pending = pendingEstimates.current;
    return () => {
      Object.entries(pending).forEach(([id, { timer, value }]) => {
        clearTimeout(timer);
        delete pending[Number(id)];
        void axios(estimateRequest(Number(id), value));
      });
    };
  }, []);
  // Stryker restore all

  const shrinkToContent = {
    style: { width: "1%", whiteSpace: "nowrap" as const },
  };
  // Numbers line up on the right (issue #185); the ratio column stays left-aligned.
  const numeric = {
    style: { ...shrinkToContent.style, textAlign: "right" as const },
  };
  const rankingSummaryByCourse = new Map(
    rankingSummaries.map((summary) => [summary.recruitmentCourseId, summary]),
  );
  // The totals row (issue #176) adds up the rows that count: removed ones are left out even
  // when the toggle shows them, as they are everywhere else on the page.
  const counted = (Array.isArray(courses) ? courses : []).filter(
    (course) => !course.removed,
  );
  const sumOf = (
    pick: (course: RecruitmentCourse) => number | null | undefined,
  ) => counted.reduce((sum, course) => sum + (pick(course) ?? 0), 0);

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
      // Sort the padded id exactly as stored and shown, code unit by code unit, so "CMPSC     5A"
      // comes before "CMPSC   130A"; TanStack's default would split digits from letters (#185).
      sortingFn: "textCaseSensitive" as const,
      footer: `Total Course Count: ${counted.length}`,
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
          // Straight to where the mapping is made, in a new tab so the table is not lost (#185).
          return (
            <a
              href="/admin/instructors"
              target="_blank"
              rel="noreferrer"
              title="Map this instructor's catalog name to an email on the Instructors page"
              data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-unmapped`}
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
              data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-copy-email`}
            >
              <CopyIcon />
            </Button>
          </>
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
      meta: {
        ...numeric,
        testIdPrefix,
        drafts: estimateDrafts,
        onChange: onEstimateChange,
        onBlur: onEstimateBlur,
      } satisfies EstimateColumnMeta,
      cell: EnrollmentEstimateCell,
    },
    {
      header: "Allocation",
      accessorKey: "allocation",
      meta: {
        ...numeric,
        testIdPrefix,
        drafts: allocationDrafts,
        onChange: onAllocationChange,
        onBlur: onAllocationBlur,
      } satisfies AllocationColumnMeta,
      cell: AllocationCell,
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
      centerHeaders
      columnVisibility={Object.fromEntries(
        hiddenColumns.map((id) => [id, false]),
      )}
    />
  );
}
