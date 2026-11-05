import {
  ASSIGNMENTS_TABLE_KEY,
  TENTATIVE_COLUMN_ID,
  assignmentColumnChoices,
  courseColumnId,
} from "main/utils/assignmentColumns";

describe("assignmentColumns (issue #314)", () => {
  test("constants and ids", () => {
    expect(ASSIGNMENTS_TABLE_KEY).toBe("recruitmentAssignments");
    expect(TENTATIVE_COLUMN_ID).toBe("tentativeAssignment");
    expect(courseColumnId(12)).toBe("course-12");
  });

  test("choices are the identity columns then the lectures, never the Tentative Assignment", () => {
    const choices = assignmentColumnChoices({
      identityHeaders: ["firstName", "gpaMajor", "unknownField"],
      courses: [
        {
          id: 10,
          courseId: "CMPSC     8",
          section: "0100",
          enrollCode: null,
          allocation: 1,
          assigned: 0,
          left: 1,
          historical: false,
        },
      ],
    });
    expect(choices).toEqual([
      { id: "firstName", label: "First Name" },
      { id: "gpaMajor", label: "GPA (Major)" },
      { id: "unknownField", label: "unknownField" },
      { id: "course-10", label: "CMPSC 8 (0100)" },
    ]);
  });
});
