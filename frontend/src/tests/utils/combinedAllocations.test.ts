import { describe, expect, test } from "vitest";
import {
  aseRatioDisplay,
  combineCourses,
  CONVERSION_FACTOR_EXPLANATION,
  CONVERSION_FACTOR_INVALID_MESSAGE,
  costRatioDisplay,
  DEFAULT_CONVERSION_FACTOR,
  isValidConversionFactor,
} from "main/utils/combinedAllocations";
import type { RecruitmentCourse } from "main/components/Recruitments/RecruitmentCourseTable";

const course = (
  id: number,
  recruitmentId: number,
  overrides: Partial<RecruitmentCourse> = {},
): RecruitmentCourse => ({
  id,
  recruitmentId,
  courseId: "CMPSC   156",
  enrollCode: "07492",
  section: "0100",
  title: "Advanced Applications Programming",
  instructor: "CONRAD P",
  days: null,
  time: null,
  room: null,
  enrollment: null,
  maxEnroll: null,
  status: "open",
  summerSession: null,
  removed: false,
  allocation: 0,
  enrollmentEstimate: null,
  ...overrides,
});

describe("the conversion factor", () => {
  test("the default is 3 and the words are the issue's", () => {
    expect(DEFAULT_CONVERSION_FACTOR).toBe(3);
    expect(CONVERSION_FACTOR_EXPLANATION).toBe(
      "When computing overall ASE:Student ratio, how many ULAs count as 1 TA? You can set this to the ratio of their costs (computed above), or the ratio of the number of hours they put in (20 for TAs vs. 10 for ULAs) or whatever basis makes the most sense.",
    );
    expect(CONVERSION_FACTOR_INVALID_MESSAGE).toBe(
      "conversionTAtoULA must be greater than zero",
    );
  });

  test.each(["3", "2", "0.5", "1.25", "10", "0.001", "007"])(
    "%s is valid",
    (value) => expect(isValidConversionFactor(value)).toBe(true),
  );

  test.each([
    "0",
    "0.0",
    "00",
    "-1",
    "-0.5",
    "",
    "abc",
    "2.",
    ".5",
    "1e3",
    " 2",
    "2 ",
    "2x",
    "x2",
    "NaN",
    "Infinity",
    "1.2.3",
  ])("%j is not valid", (value) =>
    expect(isValidConversionFactor(value)).toBe(false),
  );
});

describe("costRatioDisplay", () => {
  test("is the TA cost over the ULA cost to two places", () => {
    expect(costRatioDisplay(12000, 2500.5)).toBe("4.80");
    expect(costRatioDisplay(3000, 1000)).toBe("3.00");
    expect(costRatioDisplay(0, 1000)).toBe("0.00");
  });

  test("is empty when the cost per ULA is zero or either cost is unknown", () => {
    expect(costRatioDisplay(12000, 0)).toBe("");
    expect(costRatioDisplay(12000, null)).toBe("");
    expect(costRatioDisplay(12000, undefined)).toBe("");
    expect(costRatioDisplay(null, 1000)).toBe("");
    expect(costRatioDisplay(undefined, 1000)).toBe("");
    expect(costRatioDisplay(null, null)).toBe("");
  });
});

describe("aseRatioDisplay: students per TA-equivalent", () => {
  test("is 1:(estimate / (TAs + ULAs / factor)), rounded", () => {
    // 3 + 6/3 = 5 TA-equivalents; 100 / 5 = 20
    expect(aseRatioDisplay(3, 6, 100, 3)).toBe("1:20");
    // 2 + 3/2 = 3.5; 100 / 3.5 = 28.57
    expect(aseRatioDisplay(2, 3, 100, 2)).toBe("1:29");
    // 1 + 1/4 = 1.25; 100 / 1.25 = 80
    expect(aseRatioDisplay(1, 1, 100, 4)).toBe("1:80");
    // 1 + 1/3 = 1.333; 50 / 1.333 = 37.5, which rounds up
    expect(aseRatioDisplay(1, 1, 50, 3)).toBe("1:38");
  });

  test("a type the course lacks counts as nothing", () => {
    expect(aseRatioDisplay(2, undefined, 100, 3)).toBe("1:50");
    expect(aseRatioDisplay(2, null, 100, 3)).toBe("1:50");
    expect(aseRatioDisplay(undefined, 3, 100, 3)).toBe("1:100");
    expect(aseRatioDisplay(null, 3, 100, 3)).toBe("1:100");
  });

  test("is a dash with no estimate", () => {
    expect(aseRatioDisplay(2, 2, null, 3)).toBe("—");
    expect(aseRatioDisplay(2, 2, undefined, 3)).toBe("—");
  });

  test("is a dash when nothing is allocated, but an estimate of zero is an estimate", () => {
    expect(aseRatioDisplay(0, 0, 100, 3)).toBe("—");
    expect(aseRatioDisplay(undefined, undefined, 100, 3)).toBe("—");
    expect(aseRatioDisplay(2, 0, 0, 3)).toBe("1:0");
  });

  test("a ULA alone is enough to have a ratio", () => {
    expect(aseRatioDisplay(0, 3, 90, 3)).toBe("1:90");
  });
});

describe("combineCourses: the descriptive columns (issue #358)", () => {
  const details = {
    days: "M W",
    time: "9:30 AM",
    room: "PHELP 1",
    enrollment: 90,
    maxEnroll: 120,
    status: "open",
    stale: true,
  };

  test("a section in both recruitments takes its details from the TA row", () => {
    const rows = combineCourses(
      [course(1, 10, details)],
      [
        course(2, 20, {
          days: "T R",
          time: "1 PM",
          room: "HFH 1",
          enrollment: 1,
          maxEnroll: 2,
          status: "cancelled",
          stale: false,
        }),
      ],
    );

    expect(rows[0]).toMatchObject(details);
  });

  test("a ULA-only section takes them from the ULA row", () => {
    const rows = combineCourses([], [course(2, 20, details)]);

    expect(rows[0]).toMatchObject(details);
  });
});

describe("combineCourses: the union of the two recruitments by enroll code", () => {
  test("a section in both recruitments is one row, with both of its rows", () => {
    const ta = course(1, 10, { allocation: 2 });
    const ula = course(2, 20, { allocation: 4 });

    const rows = combineCourses([ta], [ula]);

    expect(rows).toHaveLength(1);
    expect(rows[0].enrollCode).toBe("07492");
    expect(rows[0].ta).toBe(ta);
    expect(rows[0].ula).toBe(ula);
  });

  test("two lectures of a course are two rows, not one", () => {
    const rows = combineCourses(
      [
        course(1, 10, { enrollCode: "07492", section: "0100" }),
        course(2, 10, { enrollCode: "07500", section: "0200" }),
      ],
      [course(3, 20, { enrollCode: "07500", section: "0200" })],
    );

    expect(rows.map((r) => r.enrollCode)).toEqual(["07492", "07500"]);
    expect(rows[0].ula).toBeUndefined();
    expect(rows[1].ta?.id).toBe(2);
    expect(rows[1].ula?.id).toBe(3);
  });

  test("the same course id with different enroll codes is not merged", () => {
    const rows = combineCourses(
      [course(1, 10, { enrollCode: "11111" })],
      [course(2, 20, { enrollCode: "22222" })],
    );

    expect(rows).toHaveLength(2);
  });

  test("a section in one recruitment only has no row of the other type", () => {
    const rows = combineCourses(
      [course(1, 10, { enrollCode: "1" })],
      [course(2, 20, { enrollCode: "2" })],
    );

    expect(rows[0].ta?.id).toBe(1);
    expect(rows[0].ula).toBeUndefined();
    expect(rows[1].ta).toBeUndefined();
    expect(rows[1].ula?.id).toBe(2);
  });

  test("either list may be empty", () => {
    expect(combineCourses([], [])).toEqual([]);
    expect(combineCourses([course(1, 10)], [])).toHaveLength(1);
    expect(combineCourses([], [course(1, 10)])).toHaveLength(1);
  });

  test("the details are the TA row's when there is one, else the ULA row's", () => {
    const both = combineCourses(
      [
        course(1, 10, {
          title: "TA title",
          instructor: "TA PROF",
          section: "0100",
          courseId: "CMPSC   156",
        }),
      ],
      [
        course(2, 20, {
          title: "ULA title",
          instructor: "ULA PROF",
          section: "0999",
          courseId: "CMPSC   999",
        }),
      ],
    );
    expect(both[0]).toMatchObject({
      title: "TA title",
      instructor: "TA PROF",
      section: "0100",
      courseId: "CMPSC   156",
    });

    const ulaOnly = combineCourses(
      [],
      [course(2, 20, { title: "ULA title", instructor: "ULA PROF" })],
    );
    expect(ulaOnly[0]).toMatchObject({
      title: "ULA title",
      instructor: "ULA PROF",
    });
  });

  test("the enrollment estimate is the higher of the two", () => {
    const estimate = (taEstimate: number | null, ulaEstimate: number | null) =>
      combineCourses(
        [course(1, 10, { enrollmentEstimate: taEstimate })],
        [course(2, 20, { enrollmentEstimate: ulaEstimate })],
      )[0].enrollmentEstimate;

    expect(estimate(100, 80)).toBe(100);
    expect(estimate(80, 100)).toBe(100);
    expect(estimate(90, 90)).toBe(90);
    expect(estimate(100, null)).toBe(100);
    expect(estimate(null, 80)).toBe(80);
    expect(estimate(null, null)).toBeNull();
    expect(estimate(0, null)).toBe(0);
    expect(estimate(null, 0)).toBe(0);
  });

  test("a row in one recruitment keeps its own estimate, and a missing one stays null", () => {
    expect(
      combineCourses([course(1, 10, { enrollmentEstimate: 70 })], [])[0]
        .enrollmentEstimate,
    ).toBe(70);
    expect(
      combineCourses([], [course(1, 10, { enrollmentEstimate: undefined })])[0]
        .enrollmentEstimate,
    ).toBeNull();
  });

  test("the rows are in course id, section, then enroll code order, by code unit", () => {
    const rows = combineCourses(
      [
        course(1, 10, {
          courseId: "CMPSC   130A",
          enrollCode: "3",
          section: "0100",
        }),
        course(2, 10, {
          courseId: "CMPSC     5A",
          enrollCode: "2",
          section: "0100",
        }),
        course(3, 10, {
          courseId: "CMPSC   130A",
          enrollCode: "5",
          section: "0200",
        }),
        course(4, 10, {
          courseId: "CMPSC   130A",
          enrollCode: "4",
          section: "0100",
        }),
        course(5, 10, {
          courseId: "CMPSC   130A",
          enrollCode: "6",
          section: null,
        }),
      ],
      [],
    );

    expect(rows.map((r) => r.enrollCode)).toEqual(["2", "6", "3", "4", "5"]);
  });

  test("a section without a number comes before one with a number, whichever is listed first", () => {
    const withNumber = course(1, 10, { enrollCode: "A", section: "0100" });
    const without = course(2, 10, { enrollCode: "B", section: null });
    const alsoWithout = course(3, 10, { enrollCode: "C", section: null });

    expect(
      combineCourses([withNumber, without, alsoWithout], []).map(
        (r) => r.enrollCode,
      ),
    ).toEqual(["B", "C", "A"]);
    expect(
      combineCourses([alsoWithout, without, withNumber], []).map(
        (r) => r.enrollCode,
      ),
    ).toEqual(["B", "C", "A"]);
  });

  test("the order is the same whichever recruitment lists a section first", () => {
    const rows = combineCourses(
      [course(1, 10, { enrollCode: "B", courseId: "B" })],
      [course(2, 20, { enrollCode: "A", courseId: "A" })],
    );

    expect(rows.map((r) => r.courseId)).toEqual(["A", "B"]);
  });
});
