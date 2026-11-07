import { describe, expect, test } from "vitest";
import {
  COMBINED_DEFAULT_VISIBLE_COLUMNS,
  combinedColumnChoices,
  combinedColumnsStorageKey,
  defaultHiddenCombinedColumns,
  typeColumnId,
} from "main/utils/combinedColumns";

const ids = (...args: Parameters<typeof combinedColumnChoices>) =>
  combinedColumnChoices(...args).map((c) => c.id);
const both = { exists: true, showRankings: true };
const none = { exists: false, showRankings: false };

describe("combinedColumns (issue #358)", () => {
  test("the storage key is per quarter and its own", () => {
    expect(combinedColumnsStorageKey("F26")).toBe(
      "combinedAllocations.hiddenColumns.F26",
    );
  });

  test("a type's column ids", () => {
    expect(typeColumnId("TA", "rankingCount")).toBe("taRankingCount");
    expect(typeColumnId("ULA", "unroundedAllocation")).toBe(
      "ulaUnroundedAllocation",
    );
  });

  test("with both types and rankings: every column but Course Number, in table order", () => {
    expect(ids(both, both)).toEqual([
      "taRankingCount",
      "ulaRankingCount",
      "section",
      "title",
      "instructor",
      "instructorEmail",
      "days",
      "time",
      "room",
      "enrollment",
      "maxEnroll",
      "enrollmentEstimate",
      "taAllocation",
      "taUnroundedAllocation",
      "taDelta",
      "taRatio",
      "ulaAllocation",
      "ulaUnroundedAllocation",
      "ulaDelta",
      "ulaRatio",
      "aseRatio",
      "status",
    ]);
    expect(ids(both, both)).not.toContain("courseId");
  });

  test("the labels are the allocations page's", () => {
    const labels = combinedColumnChoices(both, both).map((c) => c.label);
    expect(labels).toEqual([
      "TA Rankings",
      "ULA Rankings",
      "Section",
      "Title",
      "Instructor",
      "Email",
      "Days",
      "Time",
      "Room",
      "Enrolled",
      "Max",
      "Enrollment Estimate",
      "TA Allocation",
      "TA Unrounded Allocation",
      "TA Delta",
      "TA:student ratio",
      "ULA Allocation",
      "ULA Unrounded Allocation",
      "ULA Delta",
      "ULA:student ratio",
      "ASE:Student Ratio",
      "Status",
    ]);
  });

  test("columns starting with TA or ULA need that recruitment", () => {
    const taOnly = ids(both, none);
    expect(taOnly.filter((id) => id.startsWith("ula"))).toEqual([]);
    expect(taOnly).toContain("taAllocation");
    expect(taOnly).not.toContain("aseRatio");
    const ulaOnly = ids(none, both);
    expect(ulaOnly.filter((id) => id.startsWith("ta"))).toEqual([]);
    expect(ulaOnly).toContain("ulaRankingCount");
    expect(ulaOnly).not.toContain("aseRatio");
  });

  test("rankings columns need the rankings opened", () => {
    const closed = { exists: true, showRankings: false };
    expect(ids(closed, closed)).not.toContain("taRankingCount");
    expect(ids(closed, closed)).not.toContain("ulaRankingCount");
    expect(ids(closed, both)).toContain("ulaRankingCount");
    expect(ids(closed, both)).not.toContain("taRankingCount");
    expect(ids(both, closed)).toContain("taRankingCount");
    expect(ids(both, closed)).not.toContain("ulaRankingCount");
  });

  test("by default the allocations page's columns and the ASE ratio are shown, and the rest hidden", () => {
    expect(defaultHiddenCombinedColumns()).toEqual([
      "taRankingCount",
      "ulaRankingCount",
      "section",
      "title",
      "instructorEmail",
      "days",
      "time",
      "room",
      "status",
    ]);
    // Everything else the full menu has is visible.
    expect(
      ids(both, both).filter(
        (id) => !defaultHiddenCombinedColumns().includes(id),
      ),
    ).toEqual(
      [...COMBINED_DEFAULT_VISIBLE_COLUMNS].sort(
        (a, b) => ids(both, both).indexOf(a) - ids(both, both).indexOf(b),
      ),
    );
  });
});
