import { describe, expect, test } from "vitest";
import {
  columnChoices,
  COURSES_TABLE_KEY,
  isSummerQuarter,
} from "main/utils/courseColumns";

describe("courseColumns", () => {
  test("the table key", () => {
    expect(COURSES_TABLE_KEY).toBe("recruitmentCourses");
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
      "allocationReleased",
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
      "Released to faculty",
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
