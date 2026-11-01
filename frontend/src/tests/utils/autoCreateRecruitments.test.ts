import { describe, expect, test } from "vitest";
import {
  calendarDaysFrom,
  nextNonSummerQuarter,
  planAutoCreate,
  selectableQuarters,
  WEEK_IN_DAYS,
} from "main/utils/autoCreateRecruitments";

describe("autoCreateRecruitments", () => {
  test("the next quarter skips Summer, whichever quarter today is in", () => {
    // Winter (January to March) -> Spring.
    expect(nextNonSummerQuarter(new Date(2026, 0, 15))).toBe("20262");
    expect(nextNonSummerQuarter(new Date(2026, 2, 31))).toBe("20262");
    // Spring (April to June) -> Summer is skipped -> Fall.
    expect(nextNonSummerQuarter(new Date(2026, 3, 1))).toBe("20264");
    expect(nextNonSummerQuarter(new Date(2026, 5, 30))).toBe("20264");
    // Summer (July and August) -> Fall.
    expect(nextNonSummerQuarter(new Date(2026, 6, 1))).toBe("20264");
    expect(nextNonSummerQuarter(new Date(2026, 7, 31))).toBe("20264");
    // Fall (September to December) -> Winter of the next year.
    expect(nextNonSummerQuarter(new Date(2026, 8, 1))).toBe("20271");
    expect(nextNonSummerQuarter(new Date(2026, 11, 31))).toBe("20271");
  });

  test("with no argument it uses today", () => {
    expect(nextNonSummerQuarter()).toMatch(/^\d{4}[124]$/);
  });

  test("the selector offers the current quarter and the five after it", () => {
    expect(selectableQuarters(new Date(2026, 9, 31))).toEqual([
      "20264",
      "20271",
      "20272",
      "20273",
      "20274",
      "20281",
    ]);
    expect(selectableQuarters(new Date(2026, 0, 5))).toEqual([
      "20261",
      "20262",
      "20263",
      "20264",
      "20271",
      "20272",
    ]);
    expect(selectableQuarters()).toHaveLength(6);
  });

  test("calendar days are added across month and year ends", () => {
    expect(WEEK_IN_DAYS).toBe(7);
    expect(calendarDaysFrom(new Date(2026, 9, 31), 7)).toBe("2026-11-07");
    expect(calendarDaysFrom(new Date(2026, 11, 28), 14)).toBe("2027-01-11");
    expect(calendarDaysFrom(new Date(2026, 1, 25), 7)).toBe("2026-03-04");
    // The time of day does not matter.
    expect(calendarDaysFrom(new Date(2026, 9, 31, 23, 59), 0)).toBe(
      "2026-10-31",
    );
  });

  const today = new Date(2026, 9, 31);

  test("neither recruitment exists: both will be created, with dates a week and two weeks out", () => {
    expect(planAutoCreate([], "20271", today)).toEqual({
      quarter: "20271",
      qyy: "W27",
      tentativeOpeningDate: "2026-11-07",
      primaryConsiderationDate: "2026-11-14",
      taExists: false,
      ulaExists: false,
      nothingToCreate: false,
    });
  });

  test("only a TA recruitment exists", () => {
    const plan = planAutoCreate(
      [{ quarter: "20271", type: "TA" }],
      "20271",
      today,
    );
    expect(plan.taExists).toBe(true);
    expect(plan.ulaExists).toBe(false);
    expect(plan.nothingToCreate).toBe(false);
  });

  test("only a ULA recruitment exists", () => {
    const plan = planAutoCreate(
      [{ quarter: "20271", type: "ULA" }],
      "20271",
      today,
    );
    expect(plan.taExists).toBe(false);
    expect(plan.ulaExists).toBe(true);
    expect(plan.nothingToCreate).toBe(false);
  });

  test("both exist: nothing to create", () => {
    const plan = planAutoCreate(
      [
        { quarter: "20271", type: "TA" },
        { quarter: "20271", type: "ULA" },
      ],
      "20271",
      today,
    );
    expect(plan.nothingToCreate).toBe(true);
  });

  test("recruitments of other quarters do not count, and neither does the wrong type", () => {
    const plan = planAutoCreate(
      [
        { quarter: "20264", type: "TA" },
        { quarter: "20264", type: "ULA" },
        { quarter: "20272", type: "TA" },
        { quarter: "20271", type: "TA" },
      ],
      "20271",
      today,
    );
    expect(plan.taExists).toBe(true);
    expect(plan.ulaExists).toBe(false);
  });

  test("the plan defaults to today", () => {
    expect(planAutoCreate([], "20271").tentativeOpeningDate).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });
});
