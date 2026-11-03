import { afterEach, describe, expect, test, vi } from "vitest";
import {
  PACIFIC_TIME_ZONE,
  formatLongDate,
  formatPacificDateTime,
  pacificTodayIso,
  pacificWallClock,
} from "main/utils/pacificTime";

// None of these zones is Pacific except the last: what the browser's own zone is must not matter.
const BROWSER_ZONES = [
  "UTC",
  "Asia/Tokyo",
  "America/New_York",
  "Pacific/Kiritimati",
  "America/Los_Angeles",
];

const originalZone = process.env.TZ;

afterEach(() => {
  vi.useRealTimers();
  if (originalZone === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = originalZone;
  }
});

const inBrowserZone = (zone: string, check: () => void) => {
  process.env.TZ = zone;
  check();
};

describe.each(BROWSER_ZONES)("with the browser in %s", (zone) => {
  test.each([
    // [what the server sends, what is shown]
    // a date-time column holds Pacific wall-clock time and is shown as it reads
    ["2026-11-01T19:30:00", "11/1/2026, 7:30:00 PM"],
    ["2026-07-01T00:00:00", "7/1/2026, 12:00:00 AM"],
    ["2026-07-01T12:00:00", "7/1/2026, 12:00:00 PM"],
    ["2026-07-01T11:59:59", "7/1/2026, 11:59:59 AM"],
    ["2026-07-01T23:59:59", "7/1/2026, 11:59:59 PM"],
    ["2026-07-01T13:05:09", "7/1/2026, 1:05:09 PM"],
    ["2026-01-02T03:04:05.123456", "1/2/2026, 3:04:05 AM"],
    ["2026-01-02T03:04", "1/2/2026, 3:04:00 AM"],
    ["2026-01-02 03:04:05", "1/2/2026, 3:04:05 AM"],
    // the two daylight saving changes read as they are stored
    ["2026-03-08T01:59:59", "3/8/2026, 1:59:59 AM"],
    ["2026-03-08T03:00:00", "3/8/2026, 3:00:00 AM"],
    ["2026-11-01T01:30:00", "11/1/2026, 1:30:00 AM"],
    // an exact instant is converted: summer (UTC-7)
    ["2026-07-01T07:00:00Z", "7/1/2026, 12:00:00 AM"],
    ["2026-07-01T06:59:59Z", "6/30/2026, 11:59:59 PM"],
    ["2026-04-01T17:30:00Z", "4/1/2026, 10:30:00 AM"],
    // winter (UTC-8)
    ["2026-11-02T03:30:00Z", "11/1/2026, 7:30:00 PM"],
    ["2027-01-01T08:00:00Z", "1/1/2027, 12:00:00 AM"],
    ["2027-01-01T07:59:59Z", "12/31/2026, 11:59:59 PM"],
    ["2026-03-28T09:05:12.345Z", "3/28/2026, 2:05:12 AM"],
    // spring forward and fall back, from UTC
    ["2026-03-08T09:59:59Z", "3/8/2026, 1:59:59 AM"],
    ["2026-03-08T10:00:00Z", "3/8/2026, 3:00:00 AM"],
    ["2026-11-01T08:30:00Z", "11/1/2026, 1:30:00 AM"],
    ["2026-11-01T09:30:00Z", "11/1/2026, 1:30:00 AM"],
    ["2026-11-01T10:00:00Z", "11/1/2026, 2:00:00 AM"],
    // other offsets, with and without the colon
    ["2026-07-01T00:00:00-07:00", "7/1/2026, 12:00:00 AM"],
    ["2026-07-01T09:00:00+09:00", "6/30/2026, 5:00:00 PM"],
    ["2026-07-01T09:00:00+0900", "6/30/2026, 5:00:00 PM"],
  ])("%s is shown as %s", (stamp, shown) => {
    inBrowserZone(zone, () => {
      expect(formatPacificDateTime(stamp)).toBe(shown);
    });
  });

  test("pacificTodayIso changes at Pacific midnight, not the browser's", () => {
    inBrowserZone(zone, () => {
      expect(pacificTodayIso(new Date("2026-07-01T06:59:59Z"))).toBe(
        "2026-06-30",
      );
      expect(pacificTodayIso(new Date("2026-07-01T07:00:00Z"))).toBe(
        "2026-07-01",
      );
      expect(pacificTodayIso(new Date("2027-01-01T07:59:59Z"))).toBe(
        "2026-12-31",
      );
      expect(pacificTodayIso(new Date("2027-01-01T08:00:00Z"))).toBe(
        "2027-01-01",
      );
      expect(pacificTodayIso(new Date("2026-03-08T09:59:59Z"))).toBe(
        "2026-03-08",
      );
      expect(pacificTodayIso(new Date("2026-11-01T08:30:00Z"))).toBe(
        "2026-11-01",
      );
    });
  });

  test("pacificTodayIso pads single digits", () => {
    inBrowserZone(zone, () => {
      expect(pacificTodayIso(new Date("2026-02-03T20:00:00Z"))).toBe(
        "2026-02-03",
      );
    });
  });

  test("pacificWallClock reads as the Pacific clock in the browser's own fields", () => {
    inBrowserZone(zone, () => {
      const late = pacificWallClock(new Date("2026-11-02T03:30:45Z"));
      expect([
        late.getFullYear(),
        late.getMonth(),
        late.getDate(),
        late.getHours(),
        late.getMinutes(),
        late.getSeconds(),
      ]).toEqual([2026, 10, 1, 19, 30, 45]);

      const midnight = pacificWallClock(new Date("2026-07-01T07:00:00Z"));
      expect([
        midnight.getFullYear(),
        midnight.getMonth(),
        midnight.getDate(),
        midnight.getHours(),
      ]).toEqual([2026, 6, 1, 0]);
    });
  });

  test("with no argument, today and now are taken from the clock", () => {
    inBrowserZone(zone, () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-11-02T03:30:00Z"));
      expect(pacificTodayIso()).toBe("2026-11-01");
      expect(pacificWallClock().getDate()).toBe(1);
      expect(pacificWallClock().getHours()).toBe(19);
    });
  });
});

describe("formatPacificDateTime without a usable stamp", () => {
  test.each([null, undefined, ""])("%j is blank", (nothing) => {
    expect(formatPacificDateTime(nothing)).toBe("");
  });

  test.each([
    "garbage",
    "2026-13-45T99:99:99Z",
    "2026-07-01",
    "yesterday at noon",
  ])("%s comes back as it was", (text) => {
    expect(formatPacificDateTime(text)).toBe(text);
  });

  test("a stamp has to start with the date, not merely contain it", () => {
    expect(formatPacificDateTime("on 2026-07-01T07:00:00")).toBe(
      "on 2026-07-01T07:00:00",
    );
  });

  test("a stamp with something after the time is not read as one that names a zone", () => {
    expect(formatPacificDateTime("2026-07-01T07:00:00 sharp")).toBe(
      "7/1/2026, 7:00:00 AM",
    );
  });

  test("a zone in the middle of the text does not make it an instant", () => {
    expect(formatPacificDateTime("2026-07-01T07:00:00Zulu")).toBe(
      "7/1/2026, 7:00:00 AM",
    );
  });
});

describe("formatLongDate", () => {
  test.each([
    ["2026-01-20", "January 20, 2026"],
    ["2026-03-08", "March 8, 2026"],
    ["2026-04-09", "April 9, 2026"],
    ["2026-05-10", "May 10, 2026"],
    ["2026-06-11", "June 11, 2026"],
    ["2026-08-12", "August 12, 2026"],
    ["2026-09-13", "September 13, 2026"],
    ["2026-10-14", "October 14, 2026"],
    ["2026-11-15", "November 15, 2026"],
    ["2026-12-31", "December 31, 2026"],
    ["2026-02-03", "February 3, 2026"],
    ["2026-07-04", "July 4, 2026"],
  ])("%s is %s", (iso, text) => {
    expect(formatLongDate(iso)).toBe(text);
  });

  test("does not depend on the browser's zone", () => {
    for (const zone of BROWSER_ZONES) {
      process.env.TZ = zone;
      expect(formatLongDate("2026-03-08")).toBe("March 8, 2026");
    }
  });
});

test("the test run itself is not in California", () => {
  // vite.config.ts sets TZ=UTC for the run; the checks above mean nothing if this were Pacific
  expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(0);
});

test("the zone is Los Angeles", () => {
  expect(PACIFIC_TIME_ZONE).toBe("America/Los_Angeles");
});
