import { describe, expect, test } from "vitest";
import { courseLabel, instructorsFromRows } from "main/utils/courseLabels";
import recruitmentCoursesFixtures from "fixtures/recruitmentCoursesFixtures";

describe("courseLabels", () => {
  test("courseLabel appends the instructors in parentheses when known", () => {
    const instructors = { "CMPSC   156": "CONRAD P, GAUCHO C" };
    expect(courseLabel("CMPSC   156", instructors)).toBe(
      "CMPSC   156 (CONRAD P, GAUCHO C)",
    );
    expect(courseLabel("CMPSC     8", instructors)).toBe("CMPSC     8");
    expect(courseLabel("CMPSC     8", { "CMPSC     8": "" })).toBe(
      "CMPSC     8",
    );
    expect(courseLabel("CMPSC     8", undefined)).toBe("CMPSC     8");
    expect(courseLabel("CMPSC     8", null)).toBe("CMPSC     8");
  });

  test("instructorsFromRows joins each course's lecture instructors, distinct and sorted", () => {
    expect(
      instructorsFromRows([
        { courseId: "CMPSC   156", instructor: "GAUCHO C" },
        { courseId: "CMPSC   156", instructor: " CONRAD P " },
        { courseId: "CMPSC   156", instructor: "CONRAD P" },
        { courseId: "CMPSC     8", instructor: null },
        { courseId: "CMPSC    16", instructor: "  " },
        { courseId: "CMPSC   130A", instructor: "REMOVED R", removed: true },
        { courseId: "CMPSC    24", instructor: "ZED Z", removed: false },
      ]),
    ).toEqual({
      "CMPSC   156": "CONRAD P, GAUCHO C",
      "CMPSC    24": "ZED Z",
    });
    expect(instructorsFromRows([])).toEqual({});
  });

  test("instructorsFromRows works on the admin's rows", () => {
    const result = instructorsFromRows(recruitmentCoursesFixtures.fourCourses);
    // Two lectures of 156 in the fixture, with different instructors.
    expect(result["CMPSC   156"]).toBe("CONRAD P, SOMEONE ELSE");
    expect(result["CMPSC     1A"]).toBe("GAUCHO C");
  });
});
