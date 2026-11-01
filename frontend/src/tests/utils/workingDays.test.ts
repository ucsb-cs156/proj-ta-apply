import { describe, expect, test } from "vitest";
import {
  addWorkingDays,
  DEFAULT_DEADLINE_WORKING_DAYS,
  defaultReviewDeadline,
  isBeforeDeadline,
  toIsoDate,
} from "main/utils/workingDays";

describe("workingDays", () => {
  test("toIsoDate is the local YYYY-MM-DD with zero padding", () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toIsoDate(new Date(2026, 10, 30))).toBe("2026-11-30");
  });

  test("addWorkingDays skips Saturdays and Sundays", () => {
    // Monday 2026-11-02 + 5 working days = Monday 2026-11-09.
    expect(toIsoDate(addWorkingDays(new Date(2026, 10, 2), 5))).toBe(
      "2026-11-09",
    );
    // Friday 2026-11-06 + 1 = Monday.
    expect(toIsoDate(addWorkingDays(new Date(2026, 10, 6), 1))).toBe(
      "2026-11-09",
    );
    // Wednesday 2026-11-04 + 5 = Wednesday next week.
    expect(toIsoDate(addWorkingDays(new Date(2026, 10, 4), 5))).toBe(
      "2026-11-11",
    );
    // A weekend start counts from the following Monday as day one.
    expect(toIsoDate(addWorkingDays(new Date(2026, 10, 7), 5))).toBe(
      "2026-11-13",
    );
    expect(toIsoDate(addWorkingDays(new Date(2026, 10, 8), 5))).toBe(
      "2026-11-13",
    );
    // Zero days is the same date, and the input is not changed.
    const start = new Date(2026, 10, 2, 15, 30);
    expect(toIsoDate(addWorkingDays(start, 0))).toBe("2026-11-02");
    expect(start.getHours()).toBe(15);
    // Across a month end.
    expect(toIsoDate(addWorkingDays(new Date(2026, 9, 29), 5))).toBe(
      "2026-11-05",
    );
  });

  test("the default deadline is five working days from today", () => {
    expect(DEFAULT_DEADLINE_WORKING_DAYS).toBe(5);
    expect(defaultReviewDeadline(new Date(2026, 10, 2))).toBe("2026-11-09");
    expect(defaultReviewDeadline(new Date(2026, 10, 6))).toBe("2026-11-13");
    expect(defaultReviewDeadline()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(defaultReviewDeadline() > toIsoDate(new Date())).toBe(true);
  });

  test("isBeforeDeadline is true only for a deadline later than today", () => {
    const today = new Date(2026, 10, 2);
    expect(isBeforeDeadline("2026-11-03", today)).toBe(true);
    expect(isBeforeDeadline("2027-01-01", today)).toBe(true);
    expect(isBeforeDeadline("2026-11-02", today)).toBe(false);
    expect(isBeforeDeadline("2026-11-01", today)).toBe(false);
    expect(isBeforeDeadline(null, today)).toBe(false);
    expect(isBeforeDeadline(undefined, today)).toBe(false);
    expect(isBeforeDeadline("2999-12-31")).toBe(true);
    expect(isBeforeDeadline("2000-01-01")).toBe(false);
  });
});
