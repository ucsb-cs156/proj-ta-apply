import { describe, expect, test } from "vitest";
import {
  ASSIGNMENTS_TABLE_KEY,
  TENTATIVE_COLUMN_ID,
  assignmentColumnChoices,
  compareTentativeAssignments,
  courseColumnId,
} from "main/utils/assignmentColumns";

describe("assignmentColumns (issue #314)", () => {
  test("constants and ids", () => {
    expect(ASSIGNMENTS_TABLE_KEY).toBe("recruitmentAssignments");
    expect(TENTATIVE_COLUMN_ID).toBe("tentativeAssignment");
    expect(courseColumnId(12)).toBe("course-12");
  });

  test("choices are the identity columns then the lectures, never the Tentative Assignment", () => {
    const course = {
      id: 10,
      courseId: "CMPSC     8",
      section: "0100",
      enrollCode: null,
      allocation: 1,
      assigned: 0,
      left: 1,
      historical: false,
    };
    const choices = assignmentColumnChoices({
      identityHeaders: ["firstName", "gpaMajor", "unknownField"],
      courses: [course],
    });
    expect(choices).toEqual([
      { id: "firstName", label: "First Name" },
      { id: "gpaMajor", label: "GPA (Major)" },
      { id: "unknownField", label: "unknownField" },
      { id: "course-10", label: "  8", monospace: true },
    ]);
  });

  test("the lectures are named as the table heads them: aligned, the section only when a course has two (issue #355)", () => {
    const course = (id: number, courseId: string, section: string) => ({
      id,
      courseId,
      section,
      enrollCode: null,
      allocation: 1,
      assigned: 0,
      left: 1,
      historical: false,
    });
    expect(
      assignmentColumnChoices({
        identityHeaders: [],
        courses: [
          course(1, "CMPSC    5A", "0100"),
          course(2, "CMPSC     8", "0100"),
          course(3, "CMPSC     8", "0200"),
          course(4, "CMPSC  190DD", "0100"),
        ],
      }),
    ).toEqual([
      { id: "course-1", label: "  5A", monospace: true },
      { id: "course-2", label: "  8   (0100)", monospace: true },
      { id: "course-3", label: "  8   (0200)", monospace: true },
      { id: "course-4", label: "190DD", monospace: true },
    ]);
  });
});

describe("compareTentativeAssignments (issue #348)", () => {
  test("a blank sorts after any assignment, and equal blanks tie", () => {
    expect(compareTentativeAssignments("", "  8   (0100)")).toBeGreaterThan(0);
    expect(compareTentativeAssignments("  8   (0100)", "")).toBeLessThan(0);
    expect(compareTentativeAssignments("", "")).toBe(0);
  });

  test("assignments are in natural order and equal ones tie", () => {
    expect(
      compareTentativeAssignments("CMPSC 8 (0100)", "CMPSC 16 (0100)"),
    ).toBeLessThan(0);
    expect(
      compareTentativeAssignments("CMPSC 16 (0100)", "CMPSC 8 (0100)"),
    ).toBeGreaterThan(0);
    expect(compareTentativeAssignments("CMPSC 8", "CMPSC 8")).toBe(0);
  });

  test("the aligned labels of issue #355 sort in course order, padding and sections included", () => {
    const labels = [
      "  5A",
      "  5B",
      "  8   (0100)",
      "  8   (0200)",
      " 16",
      "130A",
      "130B",
      "190DD (0100)",
      "190DD (0200)",
      "",
    ];
    const shuffled = [...labels].reverse();
    expect([...shuffled].sort(compareTentativeAssignments)).toEqual(labels);
    expect(compareTentativeAssignments("  8", "  8")).toBe(0);
  });
});
