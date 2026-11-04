import { describe, test, expect } from "vitest";
import {
  COURSEWORK_INSTRUCTIONS,
  MIN_COURSES,
  schoolOf,
  canonicalTerm,
  normalizeTerm,
  termOptions,
  termSortKey,
  withCatalogTitles,
  withNormalizedTerm,
  TERM_LEGEND,
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

  test.each([
    ["F25", "F25"],
    ["f25", "F25"],
    [" w26 ", "W26"],
    ["Fall 2025", "F25"],
    ["fall 2025", "F25"],
    ["Fall25", "F25"],
    ["Fall '25", "F25"],
    ["Fall, 2025", "F25"],
    ["Winter 2026", "W26"],
    ["Spring 2024", "S24"],
    ["Summer 2023", "M23"],
    ["Fa 25", "F25"],
    ["Fa25", "F25"],
    ["Wi 2026", "W26"],
    ["Sp-24", "S24"],
    ["Su 23", "M23"],
    ["Sum 2023", "M23"],
    ["2025 Fall", "F25"],
    ["25 Sp", "S25"],
    ["F 25", "F25"],
    ["Win 2026", "W26"],
    ["Spr 2024", "S24"],
    ["s24", "S24"],
    ["m23", "M23"],
    ["F2025", "F25"],
    ["2025Fall", "F25"],
    ["2025 - Fall", "F25"],
    ["Fall  -  2025", "F25"],
  ])("%j is made standard: %s", (text, expected) => {
    expect(canonicalTerm(text)).toBe(expected);
    expect(normalizeTerm(text)).toBe(expected);
  });

  test.each([
    "",
    "   ",
    "Semester 1",
    "Fall",
    "2025",
    "Fall 1999",
    "Fall 2025 (transfer)",
    "Transfer Fall 2025",
    "Transfer 2025 Fall",
    "2025 Fall transfer",
    "1999 Fall",
    "Autumn 2025",
    "X25",
    "F2",
    "Fall 20255",
    "FALL 205",
  ])("%j cannot be made standard with certainty", (text) => {
    expect(canonicalTerm(text)).toBeNull();
  });

  test("canonicalTerm tolerates null and undefined", () => {
    expect(canonicalTerm(null)).toBeNull();
    expect(canonicalTerm(undefined)).toBeNull();
  });

  test("normalizeTerm keeps what it cannot convert, trimmed, and nulls blanks", () => {
    expect(normalizeTerm("  Semester 1 ")).toBe("Semester 1");
    expect(normalizeTerm("   ")).toBeNull();
    expect(normalizeTerm(null)).toBeNull();
    expect(normalizeTerm(undefined)).toBeNull();
  });

  test("withNormalizedTerm changes only the term", () => {
    const course: PriorCourse = {
      ...priorCourseworkFixtures.elsewhere,
      term: "Spring 2024",
    };
    expect(withNormalizedTerm(course)).toEqual({ ...course, term: "S24" });
    expect(withNormalizedTerm({ ...course, term: null }).term).toBeNull();
  });

  describe("withCatalogTitles", () => {
    const catalog = [
      { courseId: "CMPSC   156", title: "ADV APP PROGRAM" },
      { courseId: "CMPSC   8", title: null },
      { courseId: "CMPSC   16", title: "   " },
    ];
    const blank = (courseNumber: string, extra = {}): PriorCourse => ({
      ucsbCourse: true,
      otherSchool: null,
      courseNumber,
      courseTitle: null,
      term: "F25",
      grade: "A",
      ...extra,
    });

    test("fills a blank or missing title, matching the number as the table writes it", () => {
      expect(
        withCatalogTitles(
          [
            blank("CMPSC 156"),
            blank("  CMPSC   156 ", { courseTitle: "  " }),
            blank("CMPSC 156", { courseTitle: "" }),
          ],
          catalog,
        ).map((c) => c.courseTitle),
      ).toEqual(["ADV APP PROGRAM", "ADV APP PROGRAM", "ADV APP PROGRAM"]);
    });

    test("fills nothing else, and changes only the title", () => {
      const course = blank("CMPSC 156", { id: 4, grade: "B" });
      expect(withCatalogTitles([course], catalog)).toEqual([
        { ...course, courseTitle: "ADV APP PROGRAM" },
      ]);
    });

    test("leaves a typed title, another school, an unknown number or an untitled catalog entry alone", () => {
      const courses = [
        blank("CMPSC 156", { courseTitle: "Mine" }),
        blank("CMPSC 156", { ucsbCourse: false, otherSchool: "UCLA" }),
        blank("CMPSC 999"),
        blank("CMPSC 8"),
        blank("CMPSC 16"),
      ];
      expect(withCatalogTitles(courses, catalog)).toBe(courses);
    });
  });

  test("termSortKey is YYYYQ, and 0 for anything not in standard form", () => {
    expect(termSortKey("S26")).toBe(20262);
    expect(termSortKey("W26")).toBe(20261);
    expect(termSortKey("M26")).toBe(20263);
    expect(termSortKey("F25")).toBe(20254);
    expect(termSortKey("Spring 2024")).toBe(0);
    expect(termSortKey("s26")).toBe(0);
    expect(termSortKey(null)).toBe(0);
    expect(termSortKey(undefined)).toBe(0);
  });

  test("termOptions starts with the current quarter and goes back 8 years", () => {
    const options = termOptions(new Date(2026, 10, 3));
    expect(options[0]).toBe("F26");
    expect(options[1]).toBe("M26");
    expect(options[options.length - 1]).toBe("F18");
    expect(options).toHaveLength(33);
    expect(termOptions(new Date(2026, 0, 15))[0]).toBe("W26");
  });

  test("the legend names the four letters", () => {
    expect(TERM_LEGEND).toBe("F: Fall, W: Winter, S: Spring, M: Summer");
  });
});
