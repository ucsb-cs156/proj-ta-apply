import { useMemo, type CSSProperties } from "react";
import type { Cell } from "@tanstack/react-table";
import { Form, OverlayTrigger, Tooltip } from "react-bootstrap";
import OurTable from "main/components/Common/OurTable";
import {
  numeric,
  shrinkToContent,
  stacked,
} from "main/components/Common/columnStyles";
import { useAllocationSaves } from "main/components/Recruitments/useAllocationSaves";
import type { RecruitmentCourse } from "main/components/Recruitments/RecruitmentCourseTable";
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
  testIdPrefix?: string;
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

  const columns = [
    {
      header: "Course Number",
      accessorKey: "courseId",
      meta: shrinkToContent,
      cell: ({ cell }: { cell: Cell<CombinedCourse, unknown> }) => (
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
  ];

  // The ASE:Student ratio is part of the data, not computed by its column: TanStack keeps what a
  // column's accessor returned for as long as the data is the same, so a ratio computed there
  // would not follow the conversion factor.
  const rows = useMemo(
    () =>
      courses.map((course) => ({
        ...course,
        aseRatio: aseRatioDisplay(
          course.ta?.allocation,
          course.ula?.allocation,
          course.enrollmentEstimate,
          conversionFactor,
        ),
      })),
    [courses, conversionFactor],
  );

  return (
    <OurTable
      data={rows}
      columns={columns}
      testid={testIdPrefix}
      centerHeaders
    />
  );
}
