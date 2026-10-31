import { describe, expect, test } from "vitest";
import {
  IDENTITY_LABELS,
  assignedCourse,
  courseLabel,
  courseOptionLabel,
  identityLabel,
  rankFor,
  type AssignmentCourse,
  type AssignmentRow,
} from "main/utils/assignments";
import assignmentsFixtures from "fixtures/assignmentsFixtures";

const courses = assignmentsFixtures.taPage.courses as AssignmentCourse[];
const rows = assignmentsFixtures.taPage.rows as unknown as AssignmentRow[];

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

  test("courseLabel collapses the padded course id and adds the section", () => {
    expect(courseLabel({ courseId: "CMPSC     8", section: "0100" })).toBe(
      "CMPSC 8 (0100)",
    );
    expect(courseLabel({ courseId: "CMPSC   130A", section: "0200" })).toBe(
      "CMPSC 130A (0200)",
    );
    expect(courseLabel({ courseId: " CMPSC 16 ", section: null })).toBe(
      "CMPSC 16 ()",
    );
  });

  test("courseOptionLabel flags a lecture that is no longer offered", () => {
    expect(courseOptionLabel(courses[0])).toBe("CMPSC 8 (0100)");
    expect(courseOptionLabel(courses[2])).toBe(
      "CMPSC 24 (0100) - no longer offered",
    );
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
