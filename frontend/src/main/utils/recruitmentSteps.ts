/**
 * The Recruitment Steps diagram (docs/design/AdminUserInterfaceDesign.md): the nine steps an admin
 * runs a recruitment through, their hard and soft prerequisites, and the layout that draws them.
 * The layout is a port of docs/design/recruitment-steps/make_steps_svg.py, whose output is the
 * agreed specification; the geometry here must match it.
 */

export type RecruitmentType = "TA" | "ULA";

/** A card modal the diagram can ask the card to open (issue #233 wires these). */
export type RecruitmentStepAction =
  | "openApplications"
  | "closeApplications"
  | "allocationVisibility"
  | "openReviews"
  | "closeReviews"
  | "publishAssignments";

export type StepLink = { text: string; href: string };

/** One step's live status, as GET /api/admin/recruitments/{id}/steps will return it (#231). */
export type RecruitmentStepStatus = {
  number: number;
  done: boolean;
  /** The line along the bottom of the box, e.g. "Opened: 2026-01-07". */
  label: string;
  /** The page the title links to. */
  href?: string;
  /** The card modal the title opens instead of a page. */
  action?: RecruitmentStepAction;
  /** Step 4: the words of the title that link to different pages ("Budget", "Allocations"). */
  titleLinks?: StepLink[];
  /** Steps 7 and 9: "(see rankings)" / "(see assignments)". */
  secondaryLink?: StepLink;
};

export type RecruitmentStepsData = {
  recruitmentId: number;
  type: RecruitmentType;
  steps: RecruitmentStepStatus[];
};

export const STEP_COUNT = 9;

/** The lines of each box's title, for a TA or ULA recruitment. */
export const stepLines = (type: RecruitmentType): Record<number, string[]> => ({
  1: [`Create ${type}`, "Recruitment"],
  2: [`Open ${type}`, "Applications"],
  3: [`Close ${type}`, "Applications"],
  4: ["Budget /", "Allocations"],
  5: ["Release", "Allocations", "to Faculty *"],
  6: ["Open", "Faculty", "Ranking"],
  7: ["Close", "Faculty", "Ranking"],
  8: ["Assign", "Candidates", "to Slots"],
  9: ["Release", "Hiring", "Decisions"],
});

/** The title as one line, for summaries ("Step 6 of 9: Open Faculty Ranking"). */
export const stepTitle = (type: RecruitmentType, number: number): string =>
  stepLines(type)[number].join(" ").replace(" *", "");

export type EdgeKind = "hard" | "soft";

/** The prerequisites, from -> to. Hard ones must happen first; soft ones are the preferred order. */
export const STEP_EDGES: { from: number; to: number; kind: EdgeKind }[] = [
  { from: 1, to: 2, kind: "hard" },
  { from: 2, to: 3, kind: "hard" },
  { from: 1, to: 4, kind: "hard" },
  { from: 4, to: 5, kind: "hard" },
  { from: 5, to: 6, kind: "soft" },
  { from: 6, to: 7, kind: "hard" },
  { from: 6, to: 8, kind: "hard" },
  { from: 7, to: 8, kind: "soft" },
  { from: 8, to: 9, kind: "hard" },
  { from: 3, to: 6, kind: "soft" },
  { from: 3, to: 9, kind: "hard" },
];

export const LEGEND_HARD = "hard prerequisite: must happen first";
export const LEGEND_SOFT =
  "soft prerequisite: the preferred order, not enforced";
export const FOOTNOTE_LINE_1 =
  "Allocation visibility has three settings: admins only (the default), each faculty member sees the allocations for the courses they teach,";
export const FOOTNOTE_LINE_2 =
  'or all faculty see all allocations. Step 5 means moving off "admins only".';

// The generator's constants.
export const FONT_SIZE = 13;
export const LINE_HEIGHT = 16;
const CHAR_WIDTH = 5.9;
export const BOX_HEIGHT = 62;
/** Live boxes are taller: the bottom 16 units hold the status label. */
export const LIVE_BOX_HEIGHT = 78;
const MARGIN = 20;
const GAP = 40;
const WIDE_GAP = 95;
const PAD_LEFT = 8;
const NUMBER_WIDTH = 17;
const PAD_RIGHT = 5;
const ROW_TOP = 45;
const ROW_BOTTOM = 175;
const ROW_MIDDLE = 110;
const STATIC_HEIGHT = 392;
export const FONT_FAMILY =
  "'Arial Narrow', 'Liberation Sans Narrow', Arial, Helvetica, sans-serif";

export type BoxGeometry = {
  number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
  lines: string[];
  /** The baseline of the first title line. */
  firstBaseline: number;
  /** Where the number starts, and where the title lines start (the hanging indent). */
  numberX: number;
  labelX: number;
};

export type EdgeGeometry = {
  from: number;
  to: number;
  kind: EdgeKind;
  /** The SVG path data. */
  d: string;
};

export type DiagramLayout = {
  width: number;
  height: number;
  boxes: BoxGeometry[];
  edges: EdgeGeometry[];
  legend: { hardY: number; softY: number };
  footnote: { y1: number; y2: number };
};

const f = (n: number): string => n.toFixed(1);

/**
 * Lays the nine steps out exactly as the generator does. Columns are (1), (2 over 4), (3 over 5),
 * (6), (8), (9), with 7 centred above the wide gap between 6 and 8; steps 2, 3 and 7 are on the top
 * row and 4, 5, 6, 8 and 9 on the bottom row, with 1 at the left between the rows. In live mode
 * every box is taller, to hold the status label, and the legend moves down by the difference.
 */
export const layoutRecruitmentSteps = (
  type: RecruitmentType,
  live = false,
): DiagramLayout => {
  const lines = stepLines(type);
  const height = live ? LIVE_BOX_HEIGHT : BOX_HEIGHT;
  const width = (n: number): number =>
    Math.round(
      PAD_LEFT +
        NUMBER_WIDTH +
        Math.max(...lines[n].map((l) => l.length)) * CHAR_WIDTH +
        PAD_RIGHT,
    );
  const columns: number[][] = [[1], [2, 4], [3, 5], [6], [8], [9]];
  const columnWidths = columns.map((c) => Math.max(...c.map(width)));
  const gaps = [GAP, GAP, GAP, WIDE_GAP, GAP];
  const columnX: number[] = [];
  let x = MARGIN;
  columnWidths.forEach((cw, i) => {
    columnX.push(x);
    x += cw + (i < gaps.length ? gaps[i] : 0);
  });
  const total = Math.round(x + MARGIN);
  const rowOf: Record<number, number> = {
    1: ROW_MIDDLE,
    2: ROW_TOP,
    3: ROW_TOP,
    4: ROW_BOTTOM,
    5: ROW_BOTTOM,
    6: ROW_BOTTOM,
    8: ROW_BOTTOM,
    9: ROW_BOTTOM,
  };
  const columnOf: Record<number, number> = {
    1: 0,
    2: 1,
    4: 1,
    3: 2,
    5: 2,
    6: 3,
    8: 4,
    9: 5,
  };
  const box = (n: number, bx: number, top: number): BoxGeometry => {
    const w = width(n);
    // The title block is centred in the top BOX_HEIGHT units; a live box's extra height is below.
    const titleCy = top + BOX_HEIGHT / 2;
    const k = lines[n].length;
    return {
      number: n,
      x: bx,
      y: top,
      width: w,
      height,
      cx: bx + w / 2,
      cy: top + height / 2,
      lines: lines[n],
      firstBaseline: titleCy - (LINE_HEIGHT * (k - 1)) / 2 + FONT_SIZE * 0.35,
      numberX: bx + PAD_LEFT,
      labelX: bx + PAD_LEFT + NUMBER_WIDTH,
    };
  };
  const boxes: Record<number, BoxGeometry> = {};
  [1, 2, 3, 4, 5, 6, 8, 9].forEach((n) => {
    const col = columnOf[n];
    const bx = columnX[col] + (columnWidths[col] - width(n)) / 2;
    boxes[n] = box(n, bx, rowOf[n]);
  });
  const mid68 = (columnX[3] + columnWidths[3] + columnX[4]) / 2;
  boxes[7] = box(7, mid68 - width(7) / 2, ROW_TOP);

  const right = (n: number) => boxes[n].x + boxes[n].width;
  const left = (n: number) => boxes[n].x;
  const top = (n: number) => boxes[n].y;
  const bottom = (n: number) => boxes[n].y + boxes[n].height;
  const cy = (n: number) => boxes[n].cy;
  const cx = (n: number) => boxes[n].cx;

  const paths: Record<string, string> = {};
  // 1 -> 2 and 1 -> 4: an S-curve with horizontal tangents at both ends, finishing with a
  // straight run so the line meets the arrowhead squarely.
  (
    [
      [2, -10],
      [4, 10],
    ] as const
  ).forEach(([target, dy]) => {
    const x0 = right(1);
    const y0 = cy(1) + dy;
    const x1 = left(target) - 1;
    const y1 = cy(target);
    const xe = x1 - 16;
    const mx = (x0 + xe) / 2;
    paths[`1-${target}`] =
      `M ${f(x0)} ${f(y0)} C ${f(mx)} ${f(y0)}, ${f(mx)} ${f(y1)}, ${f(xe)} ${f(y1)} H ${f(x1)}`;
  });
  (
    [
      [2, 3],
      [4, 5],
      [5, 6],
      [6, 8],
      [8, 9],
    ] as const
  ).forEach(([a, b]) => {
    paths[`${a}-${b}`] = `M ${f(right(a))} ${f(cy(a))} H ${f(left(b) - 1)}`;
  });
  {
    // 6 (bottom) -> 7 (top): out of 6 horizontally, up into 7's underside with a straight run.
    const x0 = right(6);
    const y0 = cy(6) - 16;
    const x1 = cx(7);
    const y1 = bottom(7) + 1;
    const ye = y1 + 16;
    paths["6-7"] =
      `M ${f(x0)} ${f(y0)} C ${f(x1)} ${f(y0)}, ${f(x1)} ${f((y0 + ye) / 2)}, ${f(x1)} ${f(ye)} V ${f(y1)}`;
  }
  paths["7-8"] =
    `M ${f(right(7))} ${f(cy(7))} H ${f(cx(8))} V ${f(top(8) - 1)}`;
  paths["3-6"] =
    `M ${f(right(3))} ${f(cy(3))} H ${f(cx(6))} V ${f(top(6) - 1)}`;
  paths["3-9"] =
    `M ${f(cx(3))} ${f(top(3))} V 22 H ${f(cx(9))} V ${f(top(9) - 1)}`;

  const edges: EdgeGeometry[] = STEP_EDGES.map((e) => ({
    ...e,
    d: paths[`${e.from}-${e.to}`],
  }));
  const shift = height - BOX_HEIGHT;
  return {
    width: total,
    height: STATIC_HEIGHT + shift,
    boxes: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => boxes[n]),
    edges,
    legend: { hardY: 290 + shift, softY: 316 + shift },
    footnote: { y1: 352 + shift, y2: 370 + shift },
  };
};

/**
 * The one-line summary of where a recruitment is: the first step not yet done, in numerical
 * order, or "All 9 steps done".
 */
export const stepsSummary = (data: RecruitmentStepsData): string => {
  const next = [...data.steps]
    .sort((a, b) => a.number - b.number)
    .find((s) => !s.done);
  return next === undefined
    ? `All ${STEP_COUNT} steps done`
    : `Step ${next.number} of ${STEP_COUNT}: ${stepTitle(data.type, next.number)}`;
};
