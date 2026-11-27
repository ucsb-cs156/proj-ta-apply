import { afterEach, describe, expect, test, vi } from "vitest";
import {
  PACIFIC_TIME_ZONE,
  SOFT_OFFER_DEADLINE_DAYS,
  defaultSoftOfferDeadline,
  formatLongDate,
  formatPacificDateTime,
  formatPacificShortDate,
  formatPacificShortTime,
  isFutureWallClock,
  pacificNowLocalIso,
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

// Issue #509: the two short lines under a stamped checkbox.
describe.each(BROWSER_ZONES)(
  "short date and time with the browser in %s",
  (zone) => {
    test.each([
      // [what the server sends, mm/dd/yy, h:mm AM/PM]
      // a date-time column holds Pacific wall-clock time and is shown as it reads
      ["2026-11-21T08:05:00", "11/21/26", "8:05 AM"],
      ["2026-11-21T08:05", "11/21/26", "8:05 AM"],
      ["2026-11-21 08:05:00", "11/21/26", "8:05 AM"],
      ["2026-11-21T08:05:59.123456", "11/21/26", "8:05 AM"],
      // midnight and noon
      ["2026-07-01T00:00:00", "07/01/26", "12:00 AM"],
      ["2026-07-01T12:00:00", "07/01/26", "12:00 PM"],
      ["2026-07-01T00:30:00", "07/01/26", "12:30 AM"],
      ["2026-07-01T12:30:00", "07/01/26", "12:30 PM"],
      // single-figure hours, each side of noon, and the last minute of each half
      ["2026-07-01T01:00:00", "07/01/26", "1:00 AM"],
      ["2026-07-01T13:07:00", "07/01/26", "1:07 PM"],
      ["2026-07-01T11:59:59", "07/01/26", "11:59 AM"],
      ["2026-07-01T23:59:59", "07/01/26", "11:59 PM"],
      ["2026-07-01T09:01:00", "07/01/26", "9:01 AM"],
      ["2026-07-01T21:10:00", "07/01/26", "9:10 PM"],
      // month and day are always two figures; the year is its last two, padded
      ["2026-12-31T22:15:00", "12/31/26", "10:15 PM"],
      ["2005-01-02T03:04:05", "01/02/05", "3:04 AM"],
      ["2100-10-10T10:10:00", "10/10/00", "10:10 AM"],
      ["2030-02-03T04:05:00", "02/03/30", "4:05 AM"],
      // an exact instant is converted: summer (UTC-7) and winter (UTC-8)
      ["2026-07-01T07:00:00Z", "07/01/26", "12:00 AM"],
      ["2026-07-01T06:59:59Z", "06/30/26", "11:59 PM"],
      ["2026-04-01T17:30:00Z", "04/01/26", "10:30 AM"],
      ["2026-11-02T03:30:00Z", "11/01/26", "7:30 PM"],
      ["2027-01-01T08:00:00Z", "01/01/27", "12:00 AM"],
      ["2027-01-01T07:59:59Z", "12/31/26", "11:59 PM"],
      ["2026-07-01T09:00:00+09:00", "06/30/26", "5:00 PM"],
      ["2026-07-01T00:00:00-07:00", "07/01/26", "12:00 AM"],
    ])("%s is %s and %s", (stamp, date, time) => {
      inBrowserZone(zone, () => {
        expect(formatPacificShortDate(stamp)).toBe(date);
        expect(formatPacificShortTime(stamp)).toBe(time);
      });
    });
  },
);

describe("short date and time without a usable stamp", () => {
  test.each([null, undefined, ""])("%j is blank", (nothing) => {
    expect(formatPacificShortDate(nothing)).toBe("");
    expect(formatPacificShortTime(nothing)).toBe("");
  });

  test.each([
    "garbage",
    "2026-13-45T99:99:99Z",
    "2026-07-01",
    "on 2026-07-01T07:00:00",
  ])("%s comes back as it was", (text) => {
    expect(formatPacificShortDate(text)).toBe(text);
    expect(formatPacificShortTime(text)).toBe(text);
  });

  test("the three formatters agree on what a stamp is", () => {
    for (const stamp of [
      "2026-07-01T07:00:00 sharp",
      "2026-07-01T07:00:00Zulu",
    ]) {
      expect(formatPacificDateTime(stamp)).toBe("7/1/2026, 7:00:00 AM");
      expect(formatPacificShortDate(stamp)).toBe("07/01/26");
      expect(formatPacificShortTime(stamp)).toBe("7:00 AM");
    }
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

// Issue #485: the soft offer deadline box.
describe.each(BROWSER_ZONES)(
  "soft offer deadline with the browser in %s",
  (zone) => {
    // 6:30 pm on Nov 24 in California, already Nov 25 in UTC and Tokyo.
    const evening = new Date("2026-11-25T02:30:00Z");

    test("pacificNowLocalIso is the Pacific wall clock as a datetime-local value", () => {
      inBrowserZone(zone, () => {
        expect(pacificNowLocalIso(evening)).toBe("2026-11-24T18:30");
        expect(pacificNowLocalIso(new Date("2026-07-01T07:05:00Z"))).toBe(
          "2026-07-01T00:05",
        );
      });
    });

    test("defaultSoftOfferDeadline is 5:00 pm five calendar days after the Pacific date", () => {
      inBrowserZone(zone, () => {
        expect(SOFT_OFFER_DEADLINE_DAYS).toBe(5);
        expect(defaultSoftOfferDeadline(evening)).toBe("2026-11-29T17:00");
        // Across a month end, and across a year end.
        expect(defaultSoftOfferDeadline(new Date("2026-11-28T08:00:00Z"))).toBe(
          "2026-12-03T17:00",
        );
        expect(defaultSoftOfferDeadline(new Date("2026-12-30T20:00:00Z"))).toBe(
          "2027-01-04T17:00",
        );
      });
    });

    test("isFutureWallClock: well formed and later than the Pacific clock now", () => {
      inBrowserZone(zone, () => {
        expect(isFutureWallClock("2026-11-24T18:31", evening)).toBe(true);
        expect(isFutureWallClock("2026-11-25T00:00", evening)).toBe(true);
        expect(isFutureWallClock("2026-11-24T18:30", evening)).toBe(false);
        expect(isFutureWallClock("2026-11-24T18:29", evening)).toBe(false);
        expect(isFutureWallClock("2026-11-24", evening)).toBe(false);
        expect(isFutureWallClock("", evening)).toBe(false);
        expect(isFutureWallClock("2999-01-01T00:00:00", evening)).toBe(false);
        expect(isFutureWallClock("x2999-01-01T00:00", evening)).toBe(false);
      });
    });

    test("with no argument, the clock is read", () => {
      inBrowserZone(zone, () => {
        vi.useFakeTimers();
        vi.setSystemTime(evening);
        expect(pacificNowLocalIso()).toBe("2026-11-24T18:30");
        expect(defaultSoftOfferDeadline()).toBe("2026-11-29T17:00");
        expect(isFutureWallClock("2026-11-24T18:31")).toBe(true);
        expect(isFutureWallClock("2026-11-24T18:30")).toBe(false);
      });
    });
  },
);

test("the test run itself is not in California", () => {
  // vite.config.ts sets TZ=UTC for the run; the checks above mean nothing if this were Pacific
  expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(0);
});

test("the zone is Los Angeles", () => {
  expect(PACIFIC_TIME_ZONE).toBe("America/Los_Angeles");
});
