import { describe, expect, test } from "vitest";
import {
  asksFor,
  courseKey,
  hasTaken,
  UNTAKEN_EXPLANATION,
  UNTAKEN_TITLE,
  untakenAskedFor,
  untakenCommentsReminder,
} from "main/utils/untakenCourses";
import priorCourseworkFixtures from "fixtures/priorCourseworkFixtures";

describe("untakenCourses (issue #148)", () => {
  test("courseKey ignores case and every kind of spacing", () => {
    expect(courseKey("CMPSC   156")).toBe("CMPSC156");
    expect(courseKey("cmpsc 156")).toBe("CMPSC156");
    expect(courseKey(" CMPSC\t156 ")).toBe("CMPSC156");
    expect(courseKey("CMPSC156")).toBe("CMPSC156");
    expect(courseKey("CMPSC 156A")).not.toBe(courseKey("CMPSC 156"));
  });

  test("hasTaken matches the padded id against the coursework's course numbers, any school", () => {
    // The named fixtures rather than threeCourses, which the JS fixture adds after the literal
    // and so is invisible to this file's type check.
    const taken = [
      priorCourseworkFixtures.ucsbCourse,
      priorCourseworkFixtures.inProgress,
      priorCourseworkFixtures.elsewhere,
      { ...priorCourseworkFixtures.ucsbCourse, courseNumber: "cmpsc156" },
    ];
    expect(hasTaken(taken, "CMPSC   263")).toBe(true);
    expect(hasTaken(taken, "CMPSC   156")).toBe(true);
    expect(hasTaken(taken, "CS   143")).toBe(true);
    expect(hasTaken(taken, "CMPSC     8")).toBe(false);
    expect(hasTaken([], "CMPSC   263")).toBe(false);
  });

  test("asksFor is a choice, Enthusiastic or Would Consider, not Not Interested", () => {
    expect(asksFor("1st choice", "NOT_INTERESTED")).toBe(true);
    expect(asksFor("2nd choice", "NOT_INTERESTED")).toBe(true);
    expect(asksFor(null, "ENTHUSIASTIC")).toBe(true);
    expect(asksFor(null, "WOULD_CONSIDER")).toBe(true);
    expect(asksFor(null, "NOT_INTERESTED")).toBe(false);
    expect(asksFor(null, "")).toBe(false);
  });

  test("untakenAskedFor keeps list order and drops taken courses and unasked ones", () => {
    const courses = [
      "CMPSC     8",
      "CMPSC   130A",
      "CMPSC   156",
      "CMPSC   263",
    ];
    const rankOf = (c: string) =>
      c === "CMPSC   156"
        ? "1st choice"
        : c === "CMPSC   263"
          ? "2nd choice"
          : null;
    const interestIn = (c: string) =>
      c === "CMPSC     8" ? "WOULD_CONSIDER" : "NOT_INTERESTED";
    expect(
      untakenAskedFor(
        courses,
        [priorCourseworkFixtures.ucsbCourse],
        rankOf,
        interestIn,
      ),
    ).toEqual(["CMPSC     8", "CMPSC   156"]);
    expect(
      untakenAskedFor(
        courses,
        [],
        () => null,
        () => "NOT_INTERESTED",
      ),
    ).toEqual([]);
  });

  test("the wording", () => {
    expect(UNTAKEN_TITLE).toBe("Not listed as a course you have taken");
    expect(UNTAKEN_EXPLANATION).toBe(
      "Have you taken this course? If so, add it to the courses taken section. If not, please explain your background for serving as a ULA for this course in the comments section at the bottom of the application.",
    );
  });

  test("the comments reminder names the courses and agrees in number", () => {
    expect(untakenCommentsReminder(["CMPSC   156"])).toBe(
      "You have listed CMPSC 156 as a course you are interested in serving as a ULA for. Please explain in the comments section what your preparation is for serving as a ULA for this course.",
    );
    expect(untakenCommentsReminder(["CMPSC 156", "CMPSC 130A"])).toBe(
      "You have listed CMPSC 156 and CMPSC 130A as courses you are interested in serving as a ULA for. Please explain in the comments section what your preparation is for serving as a ULA for these courses.",
    );
    expect(untakenCommentsReminder(["A 1", "B 2", "C 3"])).toContain(
      "A 1, B 2 and C 3 as courses",
    );
  });
});
