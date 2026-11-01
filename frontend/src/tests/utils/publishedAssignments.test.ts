import { describe, expect, test } from "vitest";
import {
  CLOSE_APPLICATIONS_FIRST,
  CLOSE_RANKING_FIRST,
  LAYOUT_LABELS,
  assignmentsCsvFileName,
  assignmentsCsvUrl,
  publishModalText,
  unmetPrerequisite,
} from "main/utils/publishedAssignments";

describe("publishedAssignments utilities", () => {
  test("the radio labels are the design's", () => {
    expect(LAYOUT_LABELS).toEqual({
      course: "One Row per course",
      student: "One Row per TA/ULA",
    });
  });

  test("the CSV url and file name carry the recruitment and layout", () => {
    expect(assignmentsCsvUrl(7, "course")).toBe(
      "/api/assignments/csv?recruitmentId=7&layout=course",
    );
    expect(assignmentsCsvUrl("12", "student")).toBe(
      "/api/assignments/csv?recruitmentId=12&layout=student",
    );
    expect(assignmentsCsvFileName(7, "course")).toBe(
      "assignments-7-course.csv",
    );
    expect(assignmentsCsvFileName("12", "student")).toBe(
      "assignments-12-student.csv",
    );
  });

  test("the modal text names the recruitment's type", () => {
    expect(publishModalText("TA")).toEqual([
      "Proceeding will create a new page that shows the table of Assignments, with all courses, and information about the TAs hired, and make this available to admins and faculty. It will also unlock the ability to download a CSV file of assignments to pass off to the financial office to start hiring paperwork.",
      "It is still possible to update assignments after this point, but it's best to wait on this step until most assignments are finalized.",
      "Proceed?",
    ]);
    expect(publishModalText("ULA")[0]).toContain(
      "information about the ULAs hired",
    );
    expect(publishModalText("ULA")).toHaveLength(3);
  });

  test("unmetPrerequisite names ranking first, then applications, then nothing", () => {
    expect(CLOSE_RANKING_FIRST).toBe(
      "Close Faculty Ranking before releasing hiring decisions.",
    );
    expect(CLOSE_APPLICATIONS_FIRST).toBe(
      "Close Applications before releasing hiring decisions.",
    );
    expect(
      unmetPrerequisite({ applicationStatus: "OPEN", reviewStatus: "Open" }),
    ).toBe(CLOSE_RANKING_FIRST);
    expect(
      unmetPrerequisite({
        applicationStatus: "CLOSED",
        reviewStatus: "NotStarted",
      }),
    ).toBe(CLOSE_RANKING_FIRST);
    expect(
      unmetPrerequisite({ applicationStatus: "OPEN", reviewStatus: "Closed" }),
    ).toBe(CLOSE_APPLICATIONS_FIRST);
    expect(
      unmetPrerequisite({
        applicationStatus: "CLOSED",
        reviewStatus: "Closed",
      }),
    ).toBeNull();
  });
});
