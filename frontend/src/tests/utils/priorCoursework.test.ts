import { describe, test, expect } from "vitest";
import {
  COURSEWORK_INSTRUCTIONS,
  MIN_COURSES,
  schoolOf,
  tooFewCoursesMessage,
  type PriorCourse,
} from "main/utils/priorCoursework";
import priorCourseworkFixtures from "fixtures/priorCourseworkFixtures";

describe("priorCoursework utils", () => {
  test("a TA application needs three courses and a ULA application one", () => {
    expect(MIN_COURSES).toEqual({ TA: 3, ULA: 1 });
    expect(tooFewCoursesMessage("TA")).toBe("Please list at least 3 courses.");
    expect(tooFewCoursesMessage("ULA")).toBe("Please list at least 1 course.");
  });

  test("the instructions say what each kind of applicant must list", () => {
    expect(COURSEWORK_INSTRUCTIONS.TA).toContain("at least 3 courses");
    expect(COURSEWORK_INSTRUCTIONS.ULA).toContain(
      "every course that is relevant background for the courses you are applying to be a ULA for",
    );
    expect(COURSEWORK_INSTRUCTIONS.ULA).toContain("at least one course");
  });

  test("the School column reads UCSB or the other school", () => {
    expect(schoolOf(priorCourseworkFixtures.ucsbCourse as PriorCourse)).toBe(
      "UCSB",
    );
    expect(schoolOf(priorCourseworkFixtures.elsewhere as PriorCourse)).toBe(
      "Another University",
    );
    // A UCSB course with a stray school still reads UCSB; a non-UCSB course with none reads blank.
    expect(
      schoolOf({ ...priorCourseworkFixtures.ucsbCourse, otherSchool: "X" }),
    ).toBe("UCSB");
    expect(
      schoolOf({ ...priorCourseworkFixtures.elsewhere, otherSchool: null }),
    ).toBe("");
  });
});
