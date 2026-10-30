import { describe, expect, test } from "vitest";
import {
  GRADE_OPTIONS,
  NO_ANSWER,
  YEARS_BACK,
  bulkCourseRows,
  collapseCourseId,
  quarterOf,
  recentQuarters,
} from "main/utils/bulkCourses";

describe("bulkCourses", () => {
  test("the grades start with IP and run A+ to F", () => {
    expect(GRADE_OPTIONS).toEqual([
      "IP",
      "A+",
      "A",
      "A-",
      "B+",
      "B",
      "B-",
      "C+",
      "C",
      "C-",
      "D+",
      "D",
      "D-",
      "F",
    ]);
  });

  test("quarterOf maps each month to its quarter", () => {
    expect(quarterOf(new Date(2026, 0, 15))).toBe("20261");
    expect(quarterOf(new Date(2026, 2, 31))).toBe("20261");
    expect(quarterOf(new Date(2026, 3, 1))).toBe("20262");
    expect(quarterOf(new Date(2026, 5, 30))).toBe("20262");
    expect(quarterOf(new Date(2026, 6, 1))).toBe("20263");
    expect(quarterOf(new Date(2026, 8, 30))).toBe("20263");
    expect(quarterOf(new Date(2026, 9, 1))).toBe("20264");
    expect(quarterOf(new Date(2026, 11, 31))).toBe("20264");
  });

  test("recentQuarters runs from the current quarter back ten years, newest first", () => {
    const quarters = recentQuarters(new Date(2026, 9, 29));
    expect(YEARS_BACK).toBe(10);
    expect(quarters.length).toBe(41);
    expect(quarters[0]).toEqual({ yyyyq: "20264", qyy: "F26" });
    expect(quarters[1]).toEqual({ yyyyq: "20263", qyy: "M26" });
    expect(quarters[40]).toEqual({ yyyyq: "20164", qyy: "F16" });
  });

  test("recentQuarters defaults to now", () => {
    const quarters = recentQuarters();
    expect(quarters[0].yyyyq).toBe(quarterOf(new Date()));
    expect(quarters.length).toBe(41);
  });

  test("collapseCourseId squeezes the padding to one space", () => {
    expect(collapseCourseId("CMPSC   156")).toBe("CMPSC 156");
    expect(collapseCourseId("CMPSC     8")).toBe("CMPSC 8");
    expect(collapseCourseId(" CMPSC 16 ")).toBe("CMPSC 16");
  });

  test("bulkCourseRows makes a UCSB row per course ticked, in list order", () => {
    const courses = [
      { courseId: "CMPSC   130A", title: "Data Structures" },
      { courseId: "CMPSC   156", title: "Advanced Applications" },
      { courseId: "CMPSC    16", title: null },
    ];
    const rows = bulkCourseRows(courses, {
      "CMPSC    16": { taken: true, term: "20254", grade: "A" },
      "CMPSC   156": { taken: false, term: "20254", grade: "A" },
      "CMPSC   130A": { taken: true, term: "", grade: "" },
    });
    expect(rows).toEqual([
      {
        ucsbCourse: true,
        otherSchool: null,
        courseNumber: "CMPSC 130A",
        courseTitle: "Data Structures",
        term: null,
        grade: null,
      },
      {
        ucsbCourse: true,
        otherSchool: null,
        courseNumber: "CMPSC 16",
        courseTitle: null,
        term: "F25",
        grade: "A",
      },
    ]);
  });

  test("bulkCourseRows gives nothing for courses without an answer", () => {
    expect(
      bulkCourseRows([{ courseId: "CMPSC   156", title: "X" }], {}),
    ).toEqual([]);
    expect(NO_ANSWER).toEqual({ taken: false, term: "", grade: "" });
  });
});
