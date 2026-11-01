import { describe, expect, test } from "vitest";
import {
  FOOTNOTE_LINE_1,
  FOOTNOTE_LINE_2,
  LEGEND_HARD,
  LEGEND_SOFT,
  STEP_COUNT,
  STEP_EDGES,
  layoutRecruitmentSteps,
  stepLines,
  stepTitle,
  stepsSummary,
  type RecruitmentStepsData,
} from "main/utils/recruitmentSteps";
import recruitmentStepsFixtures from "fixtures/recruitmentStepsFixtures";

const boxOf = (layout: ReturnType<typeof layoutRecruitmentSteps>, n: number) =>
  layout.boxes.find((b) => b.number === n)!;
const edgeOf = (
  layout: ReturnType<typeof layoutRecruitmentSteps>,
  from: number,
  to: number,
) => layout.edges.find((e) => e.from === from && e.to === to)!;

describe("recruitmentSteps", () => {
  test("the nine titles, with TA or ULA in the first three", () => {
    expect(STEP_COUNT).toBe(9);
    expect(stepLines("TA")[1]).toEqual(["Create TA", "Recruitment"]);
    expect(stepLines("ULA")[2]).toEqual(["Open ULA", "Applications"]);
    expect(stepLines("ULA")[4]).toEqual(["Close ULA", "Applications"]);
    expect(stepLines("TA")[3]).toEqual(["Budget /", "Allocations"]);
    expect(stepLines("TA")[5]).toEqual([
      "Release",
      "Allocations",
      "to Faculty *",
    ]);
    expect(stepLines("TA")[6]).toEqual(["Open", "Faculty", "Ranking"]);
    expect(stepLines("TA")[7]).toEqual(["Close", "Faculty", "Ranking"]);
    expect(stepLines("TA")[9]).toEqual(["Release", "Hiring", "Decisions"]);
    expect(stepTitle("TA", 5)).toBe("Release Allocations to Faculty");
    expect(stepTitle("ULA", 1)).toBe("Create ULA Recruitment");
    expect(stepTitle("TA", 3)).toBe("Budget / Allocations");
    expect(stepTitle("TA", 4)).toBe("Close TA Applications");
    expect(stepTitle("TA", 6)).toBe("Open Faculty Ranking");
    expect(stepTitle("TA", 8)).toBe("Assign Candidates to Slots");
  });

  test("the eleven prerequisites, eight hard and three soft", () => {
    expect(STEP_EDGES).toHaveLength(11);
    expect(
      STEP_EDGES.filter((e) => e.kind === "soft").map(
        (e) => `${e.from}-${e.to}`,
      ),
    ).toEqual(["5-6", "7-8", "4-6"]);
    expect(
      STEP_EDGES.filter((e) => e.kind === "hard").map(
        (e) => `${e.from}-${e.to}`,
      ),
    ).toEqual(["1-2", "2-4", "1-3", "3-5", "6-7", "6-8", "8-9", "4-9"]);
  });

  test("the static layout matches the agreed diagram's geometry", () => {
    const layout = layoutRecruitmentSteps("TA");
    expect(layout.width).toBe(835);
    expect(layout.height).toBe(392);
    // Widths come from the longest title line: 95 for 11 characters, 101 for 12, 71 for 7.
    expect(
      layout.boxes.map((b) => [b.number, b.x, b.y, b.width, b.height]),
    ).toEqual([
      [1, 20, 110, 95, 62],
      [2, 155, 45, 101, 62],
      [3, 158, 175, 95, 62],
      [4, 296, 45, 101, 62],
      [5, 296, 175, 101, 62],
      [6, 437, 175, 71, 62],
      [7, 520, 45, 71, 62],
      [8, 603, 175, 89, 62],
      [9, 732, 175, 83, 62],
    ]);
    // Step 7 is centred over the gap between 6 and 8.
    expect(boxOf(layout, 7).cx).toBe((437 + 71 + 603) / 2);
    // The hanging indent: the number at 8 units in, the title 17 further.
    expect(boxOf(layout, 2).numberX).toBe(163);
    expect(boxOf(layout, 2).labelX).toBe(180);
    // Two lines centre on the box; three lines start one line higher.
    expect(boxOf(layout, 2).firstBaseline).toBeCloseTo(72.55, 5);
    expect(boxOf(layout, 7).firstBaseline).toBeCloseTo(64.55, 5);
    expect(boxOf(layout, 5).firstBaseline).toBeCloseTo(194.55, 5);
    expect(layout.legend).toEqual({ hardY: 290, softY: 316 });
    expect(layout.footnote).toEqual({ y1: 352, y2: 370 });
  });

  test("the ULA layout has the same geometry as the TA one", () => {
    const ta = layoutRecruitmentSteps("TA");
    const ula = layoutRecruitmentSteps("ULA");
    expect(ula.boxes.map((b) => [b.x, b.y, b.width])).toEqual(
      ta.boxes.map((b) => [b.x, b.y, b.width]),
    );
    expect(ula.edges.map((e) => e.d)).toEqual(ta.edges.map((e) => e.d));
    expect(boxOf(ula, 1).lines[0]).toBe("Create ULA");
  });

  test("the edge paths are the generator's", () => {
    const layout = layoutRecruitmentSteps("TA");
    expect(edgeOf(layout, 1, 2).d).toBe(
      "M 115.0 131.0 C 126.5 131.0, 126.5 76.0, 138.0 76.0 H 154.0",
    );
    expect(edgeOf(layout, 1, 3).d).toBe(
      "M 115.0 151.0 C 128.0 151.0, 128.0 206.0, 141.0 206.0 H 157.0",
    );
    expect(edgeOf(layout, 2, 4).d).toBe("M 256.0 76.0 H 295.0");
    expect(edgeOf(layout, 3, 5).d).toBe("M 253.0 206.0 H 295.0");
    expect(edgeOf(layout, 5, 6).d).toBe("M 397.0 206.0 H 436.0");
    expect(edgeOf(layout, 6, 8).d).toBe("M 508.0 206.0 H 602.0");
    expect(edgeOf(layout, 8, 9).d).toBe("M 692.0 206.0 H 731.0");
    expect(edgeOf(layout, 6, 7).d).toBe(
      "M 508.0 190.0 C 555.5 190.0, 555.5 157.0, 555.5 124.0 V 108.0",
    );
    expect(edgeOf(layout, 7, 8).d).toBe("M 591.0 76.0 H 647.5 V 174.0");
    expect(edgeOf(layout, 4, 6).d).toBe("M 397.0 76.0 H 472.5 V 174.0");
    expect(edgeOf(layout, 4, 9).d).toBe("M 346.5 45.0 V 22 H 773.5 V 174.0");
    expect(edgeOf(layout, 5, 6).kind).toBe("soft");
    expect(edgeOf(layout, 6, 8).kind).toBe("hard");
  });

  test("the live layout makes every box 16 taller (7 and 9 a further 16), widens 6 and 7, and moves the legend down", () => {
    const layout = layoutRecruitmentSteps("TA", true);
    const staticLayout = layoutRecruitmentSteps("TA");
    expect(layout.width).toBe(868);
    expect(layout.height).toBe(424);
    expect(layout.boxes.map((b) => [b.number, b.height])).toEqual([
      [1, 78],
      [2, 78],
      [3, 78],
      [4, 78],
      [5, 78],
      [6, 78],
      [7, 94],
      [8, 78],
      [9, 94],
    ]);
    // Only 6 and 7 are wider than their titles need, so the status line fits inside them.
    expect(boxOf(layout, 6).width).toBe(104);
    expect(boxOf(layout, 7).width).toBe(112);
    expect(boxOf(staticLayout, 6).width).toBe(71);
    expect(boxOf(staticLayout, 7).width).toBe(71);
    // Step 4's status line ("Prim. Consid: 2026-01-20") is wider than its column, so it extends to
    // the right: same left edge, wider box, and nothing else moves.
    expect(boxOf(layout, 4).width).toBe(128);
    expect(boxOf(layout, 4).x).toBe(boxOf(staticLayout, 4).x);
    expect(boxOf(layout, 5).x).toBe(boxOf(staticLayout, 5).x);
    expect(boxOf(layout, 5).width).toBe(boxOf(staticLayout, 5).width);
    expect(boxOf(staticLayout, 4).width).toBe(101);
    expect(boxOf(layout, 8).width).toBe(boxOf(staticLayout, 8).width);
    expect(boxOf(layout, 9).width).toBe(boxOf(staticLayout, 9).width);
    // No box's top moves: the extra height is all below.
    expect(layout.boxes.map((b) => [b.number, b.y])).toEqual(
      staticLayout.boxes.map((b) => [b.number, b.y]),
    );
    // The title block stays where it was; the extra height is under it.
    expect(boxOf(layout, 2).firstBaseline).toBeCloseTo(72.55, 5);
    expect(boxOf(layout, 1).cy).toBe(149);
    expect(layout.legend).toEqual({ hardY: 322, softY: 348 });
    expect(layout.footnote).toEqual({ y1: 384, y2: 402 });
    // Edges follow the taller boxes: 1 leaves from its new centre, 6 -> 7 ends at 7's new bottom.
    expect(edgeOf(layout, 1, 2).d).toBe(
      "M 115.0 139.0 C 126.5 139.0, 126.5 84.0, 138.0 84.0 H 154.0",
    );
    expect(edgeOf(layout, 6, 7).d).toBe(
      "M 541.0 198.0 C 624.5 198.0, 624.5 177.0, 624.5 156.0 V 140.0",
    );
  });

  test("the legend and footnote wording", () => {
    expect(LEGEND_HARD).toBe("hard prerequisite: must happen first");
    expect(LEGEND_SOFT).toBe(
      "soft prerequisite: the preferred order, not enforced",
    );
    expect(FOOTNOTE_LINE_1).toBe(
      "Allocation visibility has three settings: admins only (the default), each faculty member sees the allocations for the courses they teach,",
    );
    expect(FOOTNOTE_LINE_2).toBe(
      'or all faculty see all allocations. Step 5 means moving off "admins only".',
    );
  });

  test("stepsSummary names the first step not yet done, in numerical order", () => {
    expect(
      stepsSummary(recruitmentStepsFixtures.fresh as RecruitmentStepsData),
    ).toBe("Step 2 of 9: Open TA Applications");
    expect(
      stepsSummary(recruitmentStepsFixtures.ulaFresh as RecruitmentStepsData),
    ).toBe("Step 2 of 9: Open ULA Applications");
    expect(
      stepsSummary(
        recruitmentStepsFixtures.applicationsClosed as RecruitmentStepsData,
      ),
    ).toBe("Step 3 of 9: Budget / Allocations");
    expect(
      stepsSummary(
        recruitmentStepsFixtures.rankingsOpen as RecruitmentStepsData,
      ),
    ).toBe("Step 7 of 9: Close Faculty Ranking");
    expect(
      stepsSummary(recruitmentStepsFixtures.published as RecruitmentStepsData),
    ).toBe("All 9 steps done");
    // Order of the array does not matter.
    const shuffled: RecruitmentStepsData = {
      ...recruitmentStepsFixtures.fresh,
      steps: [...recruitmentStepsFixtures.fresh.steps].reverse(),
    } as RecruitmentStepsData;
    expect(stepsSummary(shuffled)).toBe("Step 2 of 9: Open TA Applications");
  });
});
