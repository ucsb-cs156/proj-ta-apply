import { courseColumnStatus } from "main/utils/assignmentColumns";

describe("courseColumnStatus (issue #343)", () => {
  const course = (id, allocation, assigned) => ({ id, allocation, assigned });

  test("a course is complete when assigned reaches its allocation, and over it too", () => {
    expect(
      courseColumnStatus({
        courses: [course(1, 2, 1), course(2, 2, 2), course(3, 1, 2)],
      }),
    ).toEqual([
      { id: "course-1", complete: false },
      { id: "course-2", complete: true },
      { id: "course-3", complete: true },
    ]);
  });

  test("a course with nothing allocated and nothing assigned is exactly at target", () => {
    expect(courseColumnStatus({ courses: [course(4, 0, 0)] })).toEqual([
      { id: "course-4", complete: true },
    ]);
  });

  test("no courses, no columns", () => {
    expect(courseColumnStatus({ courses: [] })).toEqual([]);
  });
});
