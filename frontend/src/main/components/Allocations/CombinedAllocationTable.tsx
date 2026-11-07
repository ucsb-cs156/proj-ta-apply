import { useMemo, type CSSProperties } from "react";
import type { Cell } from "@tanstack/react-table";
import { Form, OverlayTrigger, Tooltip } from "react-bootstrap";
import OurTable, { type HideLinks } from "main/components/Common/OurTable";
import {
  numeric,
  shrinkToContent,
  stacked,
} from "main/components/Common/columnStyles";
import { useAllocationSaves } from "main/components/Recruitments/useAllocationSaves";
import {
  InstructorEmailCell,
  RankingCountCell,
  StatusCell,
  type RecruitmentCourse,
  type RecruitmentCourseRankingSummary,
} from "main/components/Recruitments/RecruitmentCourseTable";
import { COURSE_NUMBER_WIDTH } from "main/utils/columnWidths";
import { typeColumnId } from "main/utils/combinedColumns";
import {
  allocationDelta,
  deltaDisplay,
  isValidAllocation,
  oneDecimal,
  ratioDisplay,
  unroundedTooltip,
} from "main/utils/allocations";
import {
  aseRatioDisplay,
  type CombinedCourse,
} from "main/utils/combinedAllocations";

type Type = "TA" | "ULA";

/** What a type's Allocation cells need, handed to them through the column's meta. */
type AllocationMeta = {
  style: CSSProperties;
  type: Type;
  testIdPrefix: string;
  drafts: Record<number, string>;
  onChange: (course: RecruitmentCourse, value: string) => void;
  onBlur: () => void;
};

const rowOf = (row: CombinedCourse, type: Type) =>
  type === "TA" ? row.ta : row.ula;

/**
 * One row's Allocation box for one type: the same box as on the Recruitment Courses page, saving
 * against that type's recruitment. Blank when the section is not in that recruitment. A module
 * level component, for the same reason as the one on that page (a focused box must not be
 * remounted on every keystroke).
 */
function AllocationCell({
  cell,
}: {
  cell: Cell<CombinedCourse, unknown>;
}): React.JSX.Element | null {
  const meta = cell.column.columnDef.meta as AllocationMeta;
  const course = rowOf(cell.row.original, meta.type);
  if (course === undefined) {
    return null;
  }
  const draft = meta.drafts[course.id];
  return (
    <Form.Control
      type="number"
      min={0}
      step={1}
      size="sm"
      style={{ width: "5em" }}
      className="text-end"
      aria-label={`${meta.type} allocation for ${course.courseId} section ${course.section ?? ""}`}
      value={draft ?? String(course.allocation ?? 0)}
      isInvalid={draft !== undefined && !isValidAllocation(draft)}
      disabled={course.removed}
      onChange={(e) => meta.onChange(course, e.target.value)}
      onBlur={meta.onBlur}
      data-testid={`${meta.testIdPrefix}-cell-row-${cell.row.index}-${meta.type}-allocation`}
    />
  );
}

type CombinedAllocationTableProps = {
  courses: CombinedCourse[];
  hasTa: boolean;
  hasUla: boolean;
  /** How many ULAs count as one TA; the ASE:Student Ratio column exists only with both types. */
  conversionFactor: number;
  taBulkVersion?: number;
  ulaBulkVersion?: number;
  /** Each type's ranking counts and instructor emails, by course; they come with the review. */
  taRankingSummaries?: RecruitmentCourseRankingSummary[];
  ulaRankingSummaries?: RecruitmentCourseRankingSummary[];
  /** Whether that type's faculty rankings have been opened; its Rankings column exists only then. */
  showTaRankings?: boolean;
  showUlaRankings?: boolean;
  onCopyEmail?: (email: string) => void;
  /** Column ids the admin has hidden; the Course Number column can never be hidden. */
  hiddenColumns?: string[];
  /** The "hide" links over the hideable columns' headings. */
  hideLinks?: HideLinks;
  testIdPrefix?: string;
};

/** What one row of the table holds besides the course: its figures that come from elsewhere. */
type Row = CombinedCourse & {
  aseRatio: string;
  taRankingCount: number | null;
  ulaRankingCount: number | null;
  instructorEmail: string | null;
};

/**
 * The courses of one quarter's TA and ULA recruitments side by side (issue #358): for each type
 * that has a recruitment its Allocation, Unrounded Allocation, Delta and ratio columns, and, when
 * both do, the ASE:Student Ratio. The figures are the ones the Recruitment Courses page shows,
 * computed with the one Enrollment Estimate shown here (the higher of the two recruitments').
 */
export default function CombinedAllocationTable({
  courses,
  hasTa,
  hasUla,
  conversionFactor,
  taBulkVersion,
  ulaBulkVersion,
  taRankingSummaries = [],
  ulaRankingSummaries = [],
  showTaRankings = false,
  showUlaRankings = false,
  onCopyEmail = () => {},
  // Stryker disable next-line all : an id that is no column's hides nothing, like the empty list
  hiddenColumns = [],
  hideLinks,
  testIdPrefix = "CombinedAllocationTable",
}: CombinedAllocationTableProps): React.JSX.Element {
  // Stryker disable BooleanLiteral : the saves refresh the lists by each part of this key on its own, so whether removed courses are included makes no difference here
  const taSaves = useAllocationSaves(undefined, taBulkVersion, false);
  const ulaSaves = useAllocationSaves(undefined, ulaBulkVersion, false);
  // Stryker restore BooleanLiteral

  const typeColumns = (type: Type) => {
    const saves = type === "TA" ? taSaves : ulaSaves;
    const key = type.toLowerCase();
    return [
      {
        header: `${type} Allocation`,
        id: `${key}Allocation`,
        accessorFn: (row: CombinedCourse) => rowOf(row, type)?.allocation,
        // A section the type does not have has nothing to sort by, so it goes last either way
        sortUndefined: "last" as const,
        meta: {
          ...numeric,
          type,
          testIdPrefix,
          drafts: saves.allocationDrafts,
          onChange: saves.onAllocationChange,
          onBlur: saves.onAllocationBlur,
        } satisfies AllocationMeta,
        cell: AllocationCell,
      },
      {
        header: (
          <OverlayTrigger
            placement="top"
            overlay={
              <Tooltip id={`${testIdPrefix}-${key}-unrounded-tooltip`}>
                {unroundedTooltip(type)}
              </Tooltip>
            }
          >
            <span
              style={{ textDecoration: "underline dotted" }}
              data-testid={`${testIdPrefix}-${key}-unrounded-heading`}
            >
              {stacked(`${type} Unrounded`, "Allocation")}
            </span>
          </OverlayTrigger>
        ),
        id: `${key}UnroundedAllocation`,
        accessorFn: (row: CombinedCourse) =>
          rowOf(row, type)?.unroundedAllocation,
        // A section the type does not have has nothing to sort by, so it goes last either way
        sortUndefined: "last" as const,
        meta: numeric,
        cell: ({ cell }: { cell: Cell<CombinedCourse, unknown> }) => {
          const course = rowOf(cell.row.original, type);
          if (course === undefined) {
            return null;
          }
          return course.unroundedAllocation == null
            ? "—"
            : oneDecimal(course.unroundedAllocation);
        },
      },
      {
        header: `${type} Delta`,
        id: `${key}Delta`,
        accessorFn: (row: CombinedCourse) => {
          const course = rowOf(row, type);
          return course === undefined ? undefined : allocationDelta(course);
        },
        sortUndefined: "last" as const,
        meta: numeric,
        cell: ({ cell }: { cell: Cell<CombinedCourse, unknown> }) => {
          const course = rowOf(cell.row.original, type);
          if (course === undefined) {
            return null;
          }
          const { text, className } = deltaDisplay(allocationDelta(course));
          return (
            <span
              className={className}
              data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-${type}-delta`}
            >
              {text}
            </span>
          );
        },
      },
      {
        header: stacked(`${type}:student`, "ratio"),
        id: `${key}Ratio`,
        accessorFn: (row: CombinedCourse) => {
          const course = rowOf(row, type);
          return course === undefined
            ? ""
            : ratioDisplay({
                allocation: course.allocation,
                enrollmentEstimate: row.enrollmentEstimate,
              });
        },
        meta: shrinkToContent,
      },
    ];
  };

  const rankingColumn = (type: Type) => ({
    header: `${type} Rankings`,
    id: typeColumnId(type, "rankingCount"),
    // A section the type does not have has nothing to sort by, so it goes last either way
    accessorFn: (row: Row) =>
      rowOf(row, type) === undefined
        ? undefined
        : type === "TA"
          ? row.taRankingCount
          : row.ulaRankingCount,
    sortUndefined: "last" as const,
    meta: numeric,
    cell: ({ cell }: { cell: Cell<Row, unknown> }) => {
      const course = rowOf(cell.row.original, type);
      if (course === undefined) {
        return null;
      }
      return (
        <RankingCountCell
          course={course}
          rankingCount={
            type === "TA"
              ? cell.row.original.taRankingCount
              : cell.row.original.ulaRankingCount
          }
          index={cell.row.index}
          testIdPrefix={`${testIdPrefix}-${type.toLowerCase()}`}
        />
      );
    },
  });

  const columns = [
    ...(hasTa && showTaRankings ? [rankingColumn("TA")] : []),
    ...(hasUla && showUlaRankings ? [rankingColumn("ULA")] : []),
    {
      header: stacked("Course", "Number"),
      accessorKey: "courseId",
      meta: shrinkToContent,
      // The cell is as wide as the widest course number, "XXXXXXX 999XX", in its monospaced font.
      cell: ({ cell }: { cell: Cell<Row, unknown> }) => (
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
      cell: ({ cell }: { cell: Cell<Row, unknown> }) => (
        <InstructorEmailCell
          email={cell.row.original.instructorEmail}
          index={cell.row.index}
          testIdPrefix={testIdPrefix}
          onCopyEmail={onCopyEmail}
        />
      ),
    },
    { header: "Days", accessorKey: "days", meta: shrinkToContent },
    { header: "Time", accessorKey: "time", meta: shrinkToContent },
    { header: "Room", accessorKey: "room", meta: shrinkToContent },
    { header: "Enrolled", accessorKey: "enrollment", meta: numeric },
    { header: "Max", accessorKey: "maxEnroll", meta: numeric },
    {
      header: stacked("Enrollment", "Estimate"),
      accessorKey: "enrollmentEstimate",
      meta: numeric,
    },
    ...(hasTa ? typeColumns("TA") : []),
    ...(hasUla ? typeColumns("ULA") : []),
    ...(hasTa && hasUla
      ? [
          {
            header: stacked("ASE:Student", "Ratio"),
            accessorKey: "aseRatio",
            meta: shrinkToContent,
          },
        ]
      : []),
    {
      header: "Status",
      accessorKey: "status",
      meta: shrinkToContent,
      cell: ({ cell }: { cell: Cell<Row, unknown> }) => (
        <StatusCell
          course={cell.row.original}
          index={cell.row.index}
          testIdPrefix={testIdPrefix}
        />
      ),
    },
  ];

  // The ASE:Student ratio is part of the data, not computed by its column: TanStack keeps what a
  // column's accessor returned for as long as the data is the same, so a ratio computed there
  // would not follow the conversion factor.
  const rows: Row[] = useMemo(() => {
    const summaryOf = (
      summaries: RecruitmentCourseRankingSummary[],
      course: RecruitmentCourse | undefined,
    ) => summaries.find((s) => s.recruitmentCourseId === course?.id);
    return courses.map((course) => {
      const taSummary = summaryOf(taRankingSummaries, course.ta);
      const ulaSummary = summaryOf(ulaRankingSummaries, course.ula);
      return {
        ...course,
        aseRatio: aseRatioDisplay(
          course.ta?.allocation,
          course.ula?.allocation,
          course.enrollmentEstimate,
          conversionFactor,
        ),
        taRankingCount: taSummary?.rankingCount ?? null,
        ulaRankingCount: ulaSummary?.rankingCount ?? null,
        // As for the other details of a section in both recruitments: the TA row's first.
        instructorEmail:
          taSummary?.instructorEmail ?? ulaSummary?.instructorEmail ?? null,
      };
    });
  }, [courses, conversionFactor, taRankingSummaries, ulaRankingSummaries]);

  return (
    <OurTable
      data={rows}
      columns={columns}
      testid={testIdPrefix}
      centerHeaders
      columnVisibility={Object.fromEntries(
        hiddenColumns.map((id) => [id, false]),
      )}
      hideLinks={hideLinks}
    />
  );
}
