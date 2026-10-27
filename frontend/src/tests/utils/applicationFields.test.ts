import { describe, test, expect } from "vitest";
import {
  toPayload,
  type ApplicationFormFields,
} from "main/utils/applicationFields";

const fields = (
  overrides: Partial<ApplicationFormFields> = {},
): ApplicationFormFields => ({
  firstName: "Ada",
  middleName: "",
  lastName: "Lovelace",
  major: "Computer Science",
  gpaMajor: "3.9",
  gpaOverall: "3.8",
  yearInProgram: "2nd",
  graduationDate: "S27",
  courseworkUcsb: "CS 156",
  knowledge: "Java",
  prevExperience: "TA for CS 24",
  desiredCourses: "",
  comments: "",
  firstChoiceCourse: "CMPSC   156",
  secondChoiceCourse: "",
  availableForLecturesFirstChoice: true,
  availableForLecturesSecondChoice: false,
  availableForDiscussionFirstChoice: false,
  availableForDiscussionSecondChoice: false,
  residencyStatus: "F1_STUDENT_VISA",
  languageExam: "PASSED",
  languageExamDatePassed: "2025-09-01",
  classLevel: "PHD",
  courseworkOther: "",
  coursework290: "",
  videoLink: "",
  previousServiceAsUla: "2",
  ...overrides,
});

describe("toPayload", () => {
  test("turns the numeric answers back into numbers", () => {
    const payload = toPayload(fields());

    expect(payload.gpaMajor).toBe(3.9);
    expect(payload.gpaOverall).toBe(3.8);
    expect(payload.previousServiceAsUla).toBe(2);
    expect(payload.languageExamDatePassed).toBe("2025-09-01");
  });

  /** An unanswered number is no answer at all, and must not arrive as zero. */
  test("an empty numeric answer becomes null, not zero", () => {
    const payload = toPayload(
      fields({ gpaMajor: "", gpaOverall: "", previousServiceAsUla: "" }),
    );

    expect(payload.gpaMajor).toBeNull();
    expect(payload.gpaOverall).toBeNull();
    expect(payload.previousServiceAsUla).toBeNull();
  });

  test("a genuine zero survives", () => {
    expect(
      toPayload(fields({ previousServiceAsUla: "0" })).previousServiceAsUla,
    ).toBe(0);
  });

  /** The backend cannot coerce "" into an enum, and an unchosen dropdown is not an answer. */
  test("an unchosen dropdown becomes null", () => {
    const payload = toPayload(
      fields({ residencyStatus: "", languageExam: "", classLevel: "" }),
    );

    expect(payload.residencyStatus).toBeNull();
    expect(payload.languageExam).toBeNull();
    expect(payload.classLevel).toBeNull();
  });

  test("an empty exam date becomes null", () => {
    expect(
      toPayload(fields({ languageExamDatePassed: "" })).languageExamDatePassed,
    ).toBeNull();
  });

  test("everything else is carried through untouched", () => {
    const payload = toPayload(fields());

    expect(payload.firstName).toBe("Ada");
    expect(payload.lastName).toBe("Lovelace");
    expect(payload.major).toBe("Computer Science");
    expect(payload.firstChoiceCourse).toBe("CMPSC   156");
    expect(payload.availableForLecturesFirstChoice).toBe(true);
    expect(payload.availableForLecturesSecondChoice).toBe(false);
    expect(payload.residencyStatus).toBe("F1_STUDENT_VISA");
    expect(payload.classLevel).toBe("PHD");
  });
});
