import { describe, expect, test } from "vitest";
import {
  adminColumnChoices,
  AdminOnlyColumns,
  AllocationsRelatedColumns,
  columnChoices,
  courseColumnsStorageKey,
  DEFAULT_VISIBLE_COLUMNS,
  defaultHiddenColumns,
  instructorColumnChoices,
  isSummerQuarter,
} from "main/utils/courseColumns";

describe("courseColumns", () => {
  test("the storage key names the recruitment", () => {
    expect(courseColumnsStorageKey("7")).toBe(
      "recruitmentCourses.hiddenColumns.7",
    );
    expect(courseColumnsStorageKey("8")).not.toBe(courseColumnsStorageKey("7"));
  });

  test("AllocationsRelatedColumns is the five planning columns", () => {
    expect(AllocationsRelatedColumns).toEqual([
      "enrollmentEstimate",
      "allocation",
      "unroundedAllocation",
      "delta",
      "ratio",
    ]);
  });

  test("the default columns: course number (never hidden), instructor, enrolled, max and the allocation columns", () => {
    expect(DEFAULT_VISIBLE_COLUMNS).toEqual([
      "instructor",
      "enrollment",
      "maxEnroll",
      "enrollmentEstimate",
      "allocation",
      "unroundedAllocation",
      "delta",
      "ratio",
    ]);
  });

  test("every other column starts hidden, Rankings and Summer Session included", () => {
    expect(defaultHiddenColumns()).toEqual([
      "rankingCount",
      "section",
      "title",
      "instructorEmail",
      "days",
      "time",
      "room",
      "status",
      "summerSession",
      "removed",
    ]);
  });

  test("an admin is offered every column but the course number and the budget columns (issue #358)", () => {
    expect(adminColumnChoices(false, false).map((c) => c.id)).toEqual([
      "section",
      "title",
      "instructor",
      "instructorEmail",
      "days",
      "time",
      "room",
      "enrollment",
      "maxEnroll",
      "status",
      "removed",
    ]);
    const full = adminColumnChoices(true, true);
    expect(full.map((c) => c.id)).toEqual([
      "rankingCount",
      "section",
      "title",
      "instructor",
      "instructorEmail",
      "days",
      "time",
      "room",
      "enrollment",
      "maxEnroll",
      "status",
      "summerSession",
      "removed",
    ]);
    // The labels are the shared ones.
    expect(full.map((c) => c.label)).toEqual([
      "Rankings",
      "Section",
      "Title",
      "Instructor",
      "Email",
      "Days",
      "Time",
      "Room",
      "Enrolled",
      "Max",
      "Status",
      "Summer Session",
      "Remove / Unremove",
    ]);
    for (const id of AllocationsRelatedColumns) {
      expect(full.map((c) => c.id)).not.toContain(id);
    }
    expect(adminColumnChoices(true, false).map((c) => c.id)).not.toContain(
      "summerSession",
    );
    expect(adminColumnChoices(false, true).map((c) => c.id)).not.toContain(
      "rankingCount",
    );
  });

  test("an instructor is offered no allocation columns unless they are shown to all faculty", () => {
    const without = instructorColumnChoices(false, false).map((c) => c.id);
    expect(without).toEqual([
      "section",
      "title",
      "instructor",
      "days",
      "time",
      "room",
      "enrollment",
      "maxEnroll",
      "status",
    ]);
    const withAll = instructorColumnChoices(false, true).map((c) => c.id);
    expect(withAll).toEqual([
      "section",
      "title",
      "instructor",
      "days",
      "time",
      "room",
      "enrollment",
      "maxEnroll",
      "enrollmentEstimate",
      "allocation",
      "unroundedAllocation",
      "delta",
      "ratio",
      "status",
    ]);
  });

  test("an instructor never gets the admin-only columns, and Summer Session only in summer", () => {
    expect(AdminOnlyColumns).toEqual([
      "rankingCount",
      "instructorEmail",
      "removed",
    ]);
    expect(instructorColumnChoices(true, true).map((c) => c.id)).toContain(
      "summerSession",
    );
    expect(instructorColumnChoices(false, true).map((c) => c.id)).not.toContain(
      "summerSession",
    );
    for (const id of AdminOnlyColumns) {
      expect(
        instructorColumnChoices(true, true).map((c) => c.id),
      ).not.toContain(id);
    }
  });

  test("only a quarter ending in 3 is a summer quarter", () => {
    expect(isSummerQuarter("20263")).toBe(true);
    expect(isSummerQuarter("20261")).toBe(false);
    expect(isSummerQuarter("20262")).toBe(false);
    expect(isSummerQuarter("20264")).toBe(false);
    expect(isSummerQuarter(null)).toBe(false);
    expect(isSummerQuarter(undefined)).toBe(false);
    expect(isSummerQuarter("")).toBe(false);
  });

  test("every column but the course number may be hidden, in table order", () => {
    expect(columnChoices(false, false).map((c) => c.id)).toEqual([
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
      "allocation",
      "unroundedAllocation",
      "delta",
      "ratio",
      "status",
      "removed",
    ]);
    expect(columnChoices(false, false).map((c) => c.label)).toEqual([
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
      "Allocation",
      "Unrounded Allocation",
      "Delta",
      "TA:student ratio",
      "Status",
      "Remove / Unremove",
    ]);
  });

  test("Rankings comes first once reviews start, Summer Session before Remove for a summer quarter", () => {
    const ids = columnChoices(true, true).map((c) => c.id);
    expect(ids[0]).toBe("rankingCount");
    expect(ids.slice(-2)).toEqual(["summerSession", "removed"]);
    expect(
      columnChoices(true, true).find((c) => c.id === "rankingCount")?.label,
    ).toBe("Rankings");
    expect(
      columnChoices(true, true).find((c) => c.id === "summerSession")?.label,
    ).toBe("Summer Session");
    expect(columnChoices(true, false).map((c) => c.id)).not.toContain(
      "summerSession",
    );
    expect(columnChoices(false, true).map((c) => c.id)).not.toContain(
      "rankingCount",
    );
  });
});
