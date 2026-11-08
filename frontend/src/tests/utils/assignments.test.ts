import { describe, expect, test } from "vitest";
import {
  COURSE_LABEL_WIDTH,
  IDENTITY_LABELS,
  LONGEST_COURSE_LABEL,
  assignedCourse,
  courseNumber,
  courseOptionLabel,
  identityLabel,
  labelCourses,
  rankFor,
  type AssignmentCourse,
  type AssignmentRow,
} from "main/utils/assignments";
import assignmentsFixtures from "fixtures/assignmentsFixtures";

const courses = assignmentsFixtures.taPage.courses as AssignmentCourse[];
const rows = assignmentsFixtures.taPage.rows as unknown as AssignmentRow[];

/** A lecture to label: the id is its position, the course id padded as the registrar pads it. */
const lecture = (
  id: number,
  number: string,
  section: string | null = "0100",
) => ({ id, courseId: `CMPSC ${number.padStart(5)}`, section });

const labelsOf = (
  lectures: { id: number; courseId: string; section: string | null }[],
) => labelCourses(lectures).map((course) => course.label);

describe("assignments utilities (issue #179)", () => {
  test("identityLabel names every CSV identity column and falls back to the raw header", () => {
    expect(identityLabel("firstName")).toBe("First Name");
    expect(identityLabel("lastName")).toBe("Last Name");
    expect(identityLabel("email")).toBe("Email");
    expect(identityLabel("major")).toBe("Major");
    expect(identityLabel("classLevel")).toBe("Class Level");
    expect(identityLabel("yearInProgram")).toBe("Year in Program");
    expect(identityLabel("graduationDate")).toBe("Graduation Date");
    expect(identityLabel("gpaMajor")).toBe("GPA (Major)");
    expect(identityLabel("gpaOverall")).toBe("GPA (Overall)");
    expect(identityLabel("previousServiceAsUla")).toBe("Previous ULA Quarters");
    expect(identityLabel("somethingNew")).toBe("somethingNew");
    expect(Object.keys(IDENTITY_LABELS)).toHaveLength(10);
  });

  test("assignedCourse finds the pencilled-in lecture or null", () => {
    expect(assignedCourse(rows[0], courses)).toBe(courses[0]);
    expect(assignedCourse(rows[1], courses)).toBe(courses[1]);
    expect(assignedCourse(rows[3], courses)).toBeNull();
    expect(
      assignedCourse({ ...rows[0], tentativeAssignment: 999 }, courses),
    ).toBeNull();
    expect(assignedCourse(rows[0], [])).toBeNull();
  });

  test("rankFor reads a lecture's rank and is undefined for the unranked or a null rank", () => {
    expect(rankFor(rows[0], courses[0])).toBe(1);
    expect(rankFor(rows[0], courses[1])).toBe(3);
    expect(rankFor(rows[0], courses[2])).toBeUndefined();
    expect(rankFor(rows[3], courses[0])).toBeUndefined();
    expect(
      rankFor({ ...rows[0], rankings: { 10: null } }, courses[0]),
    ).toBeUndefined();
    expect(rankFor({ ...rows[0], rankings: { 10: 0 } }, courses[0])).toBe(0);
  });
});

describe("naming a lecture (issue #355)", () => {
  test("courseNumber drops the subject and the registrar's padding, and keeps an id with no subject", () => {
    expect(courseNumber("CMPSC     8")).toBe("8");
    expect(courseNumber("CMPSC   130A")).toBe("130A");
    expect(courseNumber("CMPSC  190DD")).toBe("190DD");
    expect(courseNumber(" CMPSC 16 ")).toBe("16");
    expect(courseNumber("CMPSC\t5A")).toBe("5A");
    expect(courseNumber("8")).toBe("8");
    expect(courseNumber("")).toBe("");
  });

  test("the issue's list: no CMPSC, digits right-aligned so the letters line up, no section", () => {
    expect(
      labelsOf([
        lecture(1, "5A"),
        lecture(2, "5B"),
        lecture(3, "8"),
        lecture(4, "16"),
        lecture(5, "130A"),
        lecture(6, "130B"),
        lecture(7, "190DD"),
      ]),
    ).toEqual(["  5A", "  5B", "  8", " 16", "130A", "130B", "190DD"]);
  });

  test("the issue's list with two sections of 8 and of 190DD: only those carry the section, padded so the parentheses line up", () => {
    expect(
      labelsOf([
        lecture(1, "5A"),
        lecture(2, "5B"),
        lecture(3, "8", "0100"),
        lecture(4, "8", "0200"),
        lecture(5, "16"),
        lecture(6, "130A"),
        lecture(7, "130B"),
        lecture(8, "190DD", "0100"),
        lecture(9, "190DD", "0200"),
      ]),
    ).toEqual([
      "  5A",
      "  5B",
      "  8   (0100)",
      "  8   (0200)",
      " 16",
      "130A",
      "130B",
      "190DD (0100)",
      "190DD (0200)",
    ]);
  });

  test("a one-letter suffix with a section pads to the same parenthesis as 190DD", () => {
    expect(
      labelsOf([
        lecture(1, "130A", "0100"),
        lecture(2, "130A", "0200"),
        lecture(3, "16", "0100"),
        lecture(4, "16", "0200"),
      ]),
    ).toEqual(["130A  (0100)", "130A  (0200)", " 16   (0100)", " 16   (0200)"]);
  });

  test("the digits are padded to three whatever the list holds, so a course is named alike on every recruitment", () => {
    expect(labelsOf([lecture(1, "8")])).toEqual(["  8"]);
    expect(labelsOf([lecture(1, "5A"), lecture(2, "16")])).toEqual([
      "  5A",
      " 16",
    ]);
    expect(labelsOf([lecture(1, "156")])).toEqual(["156"]);
  });

  test("the same course three times, in any order, carries its section each time; a course listed once never does", () => {
    expect(
      labelsOf([
        lecture(1, "8", "0100"),
        lecture(2, "16", "0100"),
        lecture(3, "8", "0200"),
        lecture(4, "8", "0300"),
      ]),
    ).toEqual(["  8   (0100)", " 16", "  8   (0200)", "  8   (0300)"]);
  });

  test("a missing section is an empty pair of parentheses, as on the rankings CSV", () => {
    expect(labelsOf([lecture(1, "8", null), lecture(2, "8", "0200")])).toEqual([
      "  8   ()",
      "  8   (0200)",
    ]);
  });

  test("a number longer than the pattern is not cut, only left unaligned", () => {
    expect(labelsOf([lecture(1, "1234XYZ"), lecture(2, "8")])).toEqual([
      "1234XYZ",
      "  8",
    ]);
    expect(
      labelsOf([lecture(1, "1234XYZ", "0100"), lecture(2, "1234XYZ", "0200")]),
    ).toEqual(["1234XYZ (0100)", "1234XYZ (0200)"]);
  });

  test("an id with no subject, or no digits, is still labelled", () => {
    expect(
      labelsOf([
        { id: 1, courseId: "8", section: "0100" },
        { id: 2, courseId: "CMPSC   XYZ", section: "0100" },
        { id: 3, courseId: "", section: "0100" },
      ]),
    ).toEqual(["  8", "   XYZ", "   "]);
  });

  test("no lectures, no labels", () => {
    expect(labelCourses([])).toEqual([]);
  });

  test("labelCourses keeps every field of the lecture and adds the label", () => {
    expect(labelCourses(courses)).toEqual([
      { ...courses[0], label: "  8" },
      { ...courses[1], label: " 16" },
      { ...courses[2], label: " 24" },
    ]);
  });

  test("the longest label is the pattern the columns are sized to, as a monospace width", () => {
    expect(LONGEST_COURSE_LABEL).toBe("190DD (0100)");
    expect(COURSE_LABEL_WIDTH).toBe("12ch");
    // The pattern is as long as the rule ever makes a label for a UCSB course.
    expect(
      labelsOf([lecture(1, "190DD", "0100"), lecture(2, "190DD", "0200")])[0],
    ).toHaveLength(LONGEST_COURSE_LABEL.length);
  });

  test("courseOptionLabel flags a lecture that is no longer offered and makes every space non-breaking", () => {
    const [eight, , twentyFour] = labelCourses(courses);
    expect(courseOptionLabel(eight)).toBe("\u00a0\u00a08");
    expect(courseOptionLabel(twentyFour)).toBe(
      "\u00a024\u00a0-\u00a0no\u00a0longer\u00a0offered",
    );
    const [withSection] = labelCourses([
      { ...courses[0], section: "0100" },
      { ...courses[0], id: 11, section: "0200" },
    ]);
    expect(courseOptionLabel(withSection)).toBe(
      "\u00a0\u00a08\u00a0\u00a0\u00a0(0100)",
    );
    expect(courseOptionLabel(withSection)).not.toContain(" ");
  });
});
