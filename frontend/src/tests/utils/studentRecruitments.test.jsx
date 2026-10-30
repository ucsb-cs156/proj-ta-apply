import { describe, expect, test, vi } from "vitest";
import {
  applicationFor,
  classifyRecruitments,
  daysUntil,
  opensInText,
} from "main/utils/studentRecruitments";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import applicationsFixtures from "fixtures/applicationsFixtures";

// Fixture order: S26 TA CLOSED never opened (id 3), W26 ULA OPEN (id 2),
// W26 TA CLOSED on 2026-02-01 (id 1).
const [upcomingTa, openUla, closedTa] = recruitmentsFixtures.threeRecruitments;

describe("studentRecruitments", () => {
  test("daysUntil counts whole days, negative once past", () => {
    expect(daysUntil("2026-03-30", "2026-03-01")).toBe(29);
    expect(daysUntil("2026-03-01", "2026-03-01")).toBe(0);
    expect(daysUntil("2026-03-02", "2026-03-01")).toBe(1);
    expect(daysUntil("2026-02-28", "2026-03-01")).toBe(-1);
    // Across a year end and a leap day.
    expect(daysUntil("2029-01-01", "2028-02-28")).toBe(308);
  });

  test("daysUntil defaults to today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 1, 12, 0, 0));
    expect(daysUntil("2026-03-11")).toBe(10);
    vi.useRealTimers();
  });

  test("opensInText words the count", () => {
    expect(opensInText(12)).toBe("12 days");
    expect(opensInText(2)).toBe("2 days");
    expect(opensInText(1)).toBe("1 day");
    expect(opensInText(0)).toBe("today");
    expect(opensInText(-1)).toBe("any day now");
  });

  test("applicationFor finds the application to a recruitment", () => {
    const applications = applicationsFixtures.twoApplications;
    expect(applicationFor(applications, 2)).toBe(
      applicationsFixtures.oneUlaApplication,
    );
    expect(applicationFor(applications, 9)).toBeUndefined();
  });

  test("classifyRecruitments splits upcoming, current and past", () => {
    // Today is within six months of the TA's closing, so it is current.
    const result = classifyRecruitments(
      recruitmentsFixtures.threeRecruitments,
      [],
      "2026-03-01",
    );
    expect(result.upcoming).toEqual([upcomingTa]);
    // Both W26: TA before ULA, as the backend orders them.
    expect(result.current).toEqual([closedTa, openUla]);
    expect(result.past).toEqual([]);
  });

  test("an application to an upcoming or current recruitment never makes it past", () => {
    const applications = [
      { ...applicationsFixtures.oneTaApplication, id: 30, recruitmentId: 3 },
      applicationsFixtures.oneUlaApplication,
    ];
    const result = classifyRecruitments(
      recruitmentsFixtures.threeRecruitments,
      applications,
      "2026-03-01",
    );
    expect(result.past).toEqual([]);
    expect(result.upcoming).toEqual([upcomingTa]);
    expect(result.current).toEqual([closedTa, openUla]);
  });

  test("an open recruitment is current even without a recorded opening date", () => {
    const odd = { ...openUla, id: 40, actualOpeningDate: null };
    const result = classifyRecruitments([odd], [], "2026-03-01");
    expect(result.upcoming).toEqual([]);
    expect(result.current).toEqual([odd]);
  });

  test("a recruitment closed over six months ago is past only when the student applied", () => {
    const later = "2026-09-01";
    expect(
      classifyRecruitments(recruitmentsFixtures.threeRecruitments, [], later)
        .past,
    ).toEqual([]);
    const result = classifyRecruitments(
      recruitmentsFixtures.threeRecruitments,
      [applicationsFixtures.oneTaApplication],
      later,
    );
    expect(result.past).toEqual([closedTa]);
    expect(result.current).toEqual([openUla]);
    expect(result.upcoming).toEqual([upcomingTa]);
  });

  test("upcoming is sorted by tentative opening, current and past newest quarter first", () => {
    const a = {
      ...upcomingTa,
      id: 10,
      quarter: "20264",
      tentativeOpeningDate: "2026-09-01",
    };
    const b = {
      ...upcomingTa,
      id: 11,
      quarter: "20263",
      tentativeOpeningDate: "2026-06-01",
    };
    const oldTa = {
      ...closedTa,
      id: 12,
      quarter: "20251",
      actualClosingDate: "2025-02-01",
    };
    const olderTa = {
      ...closedTa,
      id: 13,
      quarter: "20244",
      actualClosingDate: "2024-11-01",
    };
    const applications = [
      { ...applicationsFixtures.oneTaApplication, id: 20, recruitmentId: 12 },
      { ...applicationsFixtures.oneTaApplication, id: 21, recruitmentId: 13 },
    ];
    const newerUla = { ...openUla, id: 14, quarter: "20264" };
    const result = classifyRecruitments(
      [a, olderTa, b, oldTa, openUla, closedTa, newerUla],
      applications,
      "2026-03-01",
    );
    expect(result.upcoming.map((r) => r.id)).toEqual([11, 10]);
    // Newest quarter first; within a quarter TA before ULA.
    expect(result.current.map((r) => r.id)).toEqual([14, 1, 2]);
    expect(result.past.map((r) => r.id)).toEqual([12, 13]);
  });

  test("classifyRecruitments tolerates non-array inputs and defaults to today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 1, 12, 0, 0));
    expect(classifyRecruitments(null, null)).toEqual({
      upcoming: [],
      current: [],
      past: [],
    });
    expect(
      classifyRecruitments(recruitmentsFixtures.threeRecruitments, null)
        .current,
    ).toEqual([closedTa, openUla]);
    vi.useRealTimers();
  });
});
