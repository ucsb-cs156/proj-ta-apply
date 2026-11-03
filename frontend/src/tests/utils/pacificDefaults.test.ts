import { afterEach, describe, expect, test, vi } from "vitest";
import {
  defaultReviewDeadline,
  isBeforeDeadline,
} from "main/utils/workingDays";
import {
  nextNonSummerQuarter,
  selectableQuarters,
} from "main/utils/autoCreateRecruitments";
import { defaultPreviewQuarter } from "main/utils/noticeFields";
import { recentQuarters } from "main/utils/bulkCourses";
import { todayIso } from "main/utils/applicationAccess";
import { daysUntil } from "main/utils/studentRecruitments";

/**
 * Issue #293: "today" is the Pacific day. These run at moments when it is already tomorrow (or the
 * next quarter, or the next year) in UTC and in Tokyo, though not yet in California.
 */
const originalZone = process.env.TZ;

afterEach(() => {
  vi.useRealTimers();
  if (originalZone === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = originalZone;
  }
});

const at = (zone: string, instant: string) => {
  process.env.TZ = zone;
  vi.useFakeTimers();
  vi.setSystemTime(new Date(instant));
};

describe.each(["UTC", "Asia/Tokyo", "America/Los_Angeles"])(
  "with the browser in %s",
  (zone) => {
    test("todayIso is the Pacific date", () => {
      at(zone, "2026-11-03T01:39:00Z"); // 5:39 p.m. on Nov 2 in California
      expect(todayIso()).toBe("2026-11-02");
    });

    test("days until a date count from the Pacific date", () => {
      at(zone, "2026-11-03T01:39:00Z");
      expect(daysUntil("2026-11-03")).toBe(1);
      expect(daysUntil("2026-11-02")).toBe(0);
    });

    test("a deadline is not early on the day it falls, in Pacific time", () => {
      at(zone, "2026-11-03T01:39:00Z");
      expect(isBeforeDeadline("2026-11-03")).toBe(true);
      expect(isBeforeDeadline("2026-11-02")).toBe(false);
    });

    test("the default review deadline counts working days from the Pacific day", () => {
      // 7:00 p.m. on Sunday Nov 8 in California, already Monday Nov 9 in UTC
      at(zone, "2026-11-09T03:00:00Z");
      expect(defaultReviewDeadline()).toBe("2026-11-13");
    });

    test("the quarter is the Pacific quarter at New Year", () => {
      // 9 p.m. on Dec 31, 2026 in California (Fall 2026), already 2027 in UTC
      at(zone, "2027-01-01T05:00:00Z");
      expect(nextNonSummerQuarter()).toBe("20271");
      expect(defaultPreviewQuarter()).toBe("20271");
      expect(selectableQuarters()).toEqual([
        "20254",
        "20261",
        "20262",
        "20263",
        "20264",
        "20271",
      ]);
      expect(recentQuarters()[0].yyyyq).toBe("20264");
    });
  },
);
