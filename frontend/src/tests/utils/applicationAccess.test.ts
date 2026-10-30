import { describe, test, expect, vi } from "vitest";
import {
  closedExplanation,
  isEditable,
  phaseOf,
  todayIso,
} from "main/utils/applicationAccess";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";

const recruitment = (
  applicationStatus: "OPEN" | "CLOSED",
  primaryConsiderationDate: string | null,
): Recruitment => ({
  id: 1,
  quarter: "20262",
  type: "TA",
  applicationStatus,
  tentativeOpeningDate: "2026-01-05",
  primaryConsiderationDate,
  actualOpeningDate: null,
  actualClosingDate: null,
});

describe("applicationAccess", () => {
  test("an open recruitment before its deadline is fully editable", () => {
    expect(phaseOf(recruitment("OPEN", "2026-01-20"), "2026-01-19")).toBe(
      "EDITABLE",
    );
  });

  /** The deadline day itself still counts as open; it closes the day after. */
  test("the deadline day itself is still editable", () => {
    expect(phaseOf(recruitment("OPEN", "2026-01-20"), "2026-01-20")).toBe(
      "EDITABLE",
    );
  });

  /** Issue #98: past the deadline the application is late, but still editable. */
  test("after the deadline the phase is late", () => {
    expect(phaseOf(recruitment("OPEN", "2026-01-20"), "2026-01-21")).toBe(
      "LATE",
    );
  });

  test("both open phases are editable; view only is not", () => {
    expect(isEditable("EDITABLE")).toBe(true);
    expect(isEditable("LATE")).toBe(true);
    expect(isEditable("VIEW_ONLY")).toBe(false);
  });

  test("the closed explanation names the closing date when there is one", () => {
    expect(
      closedExplanation({
        ...recruitment("CLOSED", "2026-01-20"),
        actualClosingDate: "2026-02-01",
      }),
    ).toBe("Applications were closed on 2026-02-01.");
    expect(closedExplanation(recruitment("CLOSED", "2026-01-20"))).toBe(
      "Applications are closed.",
    );
    expect(closedExplanation(undefined)).toBe("Applications are closed.");
    expect(closedExplanation(null)).toBe("Applications are closed.");
  });

  test("a closed recruitment is view only, deadline or not", () => {
    expect(phaseOf(recruitment("CLOSED", "2026-01-20"), "2026-01-01")).toBe(
      "VIEW_ONLY",
    );
    expect(phaseOf(recruitment("CLOSED", "2026-01-20"), "2026-02-01")).toBe(
      "VIEW_ONLY",
    );
  });

  test("an open recruitment with no deadline stays editable", () => {
    expect(phaseOf(recruitment("OPEN", null), "2030-01-01")).toBe("EDITABLE");
  });

  /** Nothing justifies showing an edit control when the recruitment is unknown. */
  test("an unknown recruitment is view only", () => {
    expect(phaseOf(undefined, "2026-01-01")).toBe("VIEW_ONLY");
    expect(phaseOf(null, "2026-01-01")).toBe("VIEW_ONLY");
  });

  test("todayIso pads the month and day to two digits", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 12, 0, 0));
    expect(todayIso()).toBe("2026-01-05");
    vi.setSystemTime(new Date(2026, 10, 30, 12, 0, 0));
    expect(todayIso()).toBe("2026-11-30");
    vi.useRealTimers();
  });

  /** The default argument is today, so a future deadline is still editable now. */
  test("phaseOf defaults to today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 12, 0, 0));
    expect(phaseOf(recruitment("OPEN", "2026-01-20"))).toBe("EDITABLE");
    expect(phaseOf(recruitment("OPEN", "2026-01-01"))).toBe("LATE");
    vi.useRealTimers();
  });
});
