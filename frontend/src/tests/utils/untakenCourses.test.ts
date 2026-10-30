import { describe, expect, test } from "vitest";
import {
  asksFor,
  courseKey,
  hasTaken,
  UNTAKEN_EXAMPLE,
  UNTAKEN_EXPLANATION,
  UNTAKEN_TITLE,
  untakenAskedFor,
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
    const taken = [
      ...priorCourseworkFixtures.threeCourses,
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
      "signifies that this is a course you have not listed as one you have taken. Be sure that in the comments field at the bottom of the application, you explain what background you have that prepares you to be a ULA for this course.",
    );
    expect(UNTAKEN_EXAMPLE).toBe(
      "For example, CS students don't typically take CMPSC 5A or 5B, but if they have Python programming background, and some statistics background (e.g. PSTAT 5 or PSTAT 120A), that's typically enough preparation to be a ULA for CMPSC 5A/5B.",
    );
  });
});
