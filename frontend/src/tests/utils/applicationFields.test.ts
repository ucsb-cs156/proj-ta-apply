import { describe, test, expect } from "vitest";
import {
  COURSE_INTEREST_OPTIONS,
  DEFAULT_COURSE_INTEREST,
  courseInterestLabel,
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
  comments: "",
  firstChoiceCourse: "CMPSC   156",
  secondChoiceCourse: "",
  availableForLecturesFirstChoice: true,
  availableForLecturesSecondChoice: false,
  availableForDiscussionFirstChoice: false,
  availableForDiscussionSecondChoice: false,
  availabilityCommentsFirstChoice: "Free any afternoon",
  availabilityCommentsSecondChoice: "",
  courseInterests: {},
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

  // ---- course interests ----

  /** The default says nothing, so sending it would only pad the table. */
  test("courses left at the default are not sent", () => {
    const payload = toPayload(
      fields({
        courseInterests: {
          "CMPSC     8": "ENTHUSIASTIC",
          "CMPSC    16": "NOT_INTERESTED",
          "CMPSC    24": "WOULD_CONSIDER",
        },
      }),
    );

    expect(payload.courseInterests).toEqual({
      "CMPSC     8": "ENTHUSIASTIC",
      "CMPSC    24": "WOULD_CONSIDER",
    });
  });

  /** The two choices have their own fields; an answer given before a course was chosen goes. */
  test("the first and second choice are never among the other courses", () => {
    const payload = toPayload(
      fields({
        firstChoiceCourse: "CMPSC   156",
        secondChoiceCourse: "CMPSC   130A",
        courseInterests: {
          "CMPSC   156": "ENTHUSIASTIC",
          "CMPSC   130A": "WOULD_CONSIDER",
          "CMPSC     8": "WOULD_CONSIDER",
        },
      }),
    );

    expect(payload.courseInterests).toEqual({
      "CMPSC     8": "WOULD_CONSIDER",
    });
  });

  test("with no courses marked, the map is empty", () => {
    expect(toPayload(fields()).courseInterests).toEqual({});
  });

  test("the options are offered in the order the issue lists them, defaulting to the last", () => {
    expect(COURSE_INTEREST_OPTIONS.map((option) => option.value)).toEqual([
      "ENTHUSIASTIC",
      "WOULD_CONSIDER",
      "NOT_INTERESTED",
    ]);
    expect(DEFAULT_COURSE_INTEREST).toBe("NOT_INTERESTED");
  });

  test("interest codes are spelled out for display", () => {
    expect(courseInterestLabel("ENTHUSIASTIC")).toBe("Enthusiastic");
    expect(courseInterestLabel("WOULD_CONSIDER")).toBe("Would Consider");
    expect(courseInterestLabel("NOT_INTERESTED")).toBe(
      "Not Applicable / Not Interested",
    );
    // An unrecognised code is better shown as nothing than as the raw code.
    expect(courseInterestLabel("SOMETHING_ELSE")).toBe("");
  });

  test("everything else is carried through untouched", () => {
    const payload = toPayload(fields());

    expect(payload.firstName).toBe("Ada");
    expect(payload.lastName).toBe("Lovelace");
    expect(payload.major).toBe("Computer Science");
    expect(payload.firstChoiceCourse).toBe("CMPSC   156");
    expect(payload.availableForLecturesFirstChoice).toBe(true);
    expect(payload.availableForLecturesSecondChoice).toBe(false);
    expect(payload.availabilityCommentsFirstChoice).toBe("Free any afternoon");
    expect(payload.availabilityCommentsSecondChoice).toBe("");
    expect(payload.residencyStatus).toBe("F1_STUDENT_VISA");
    expect(payload.classLevel).toBe("PHD");
  });
});
