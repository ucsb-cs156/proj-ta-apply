import { describe, test, expect } from "vitest";
import {
  COURSE_INTEREST_OPTIONS,
  DEFAULT_COURSE_INTEREST,
  EMPTY_OPTIONS,
  INTEREST_LEVELS,
  MIN_PROFICIENCY,
  OTHER_MAJOR,
  TA_PROFICIENCY_LEVELS,
  ULA_PROFICIENCY_LEVELS,
  proficiencyInstruction,
  proficiencyLevels,
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
  priorCoursework: [],
  topicProficiencies: { Java: 5 },
  interests: {},
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
  languageExam: "PASSED_F1_OR_J1_VISA",
  languageExamDatePassed: "F25",
  classLevel: "PHD",
  videoLink: "",
  previousServiceAsUla: "2",
  permNumber: "a1b2c3d",
  bsMsStudent: "true",
  studentStatusNextQuarter: "GRADUATE",
  wantsTaEligibility: "false",
  otherCampusJob: "NOT_SURE",
  priorUcsbEmployment: "true",
  employeeId: "1234567",
  i9Appointment: false,
  trainingCommitment: "UNSURE",
  trainingCommitmentExplanation: "Might have a Friday lab",
  changingMajor: "false",
  noticeVersionId: 1,
  ...overrides,
});

describe("toPayload", () => {
  test("turns the numeric answers back into numbers", () => {
    const payload = toPayload(fields());

    expect(payload.gpaMajor).toBe(3.9);
    expect(payload.gpaOverall).toBe(3.8);
    expect(payload.previousServiceAsUla).toBe(2);
    expect(payload.languageExamDatePassed).toBe("F25");
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

  // ---- topic proficiencies ----

  test("the TA topic scale runs 1 to 5, headed by the numbers", () => {
    expect(MIN_PROFICIENCY).toBe(1);
    expect(TA_PROFICIENCY_LEVELS).toEqual([
      { value: 1, label: "1" },
      { value: 2, label: "2" },
      { value: 3, label: "3" },
      { value: 4, label: "4" },
      { value: 5, label: "5" },
    ]);
    expect(proficiencyLevels("TA")).toBe(TA_PROFICIENCY_LEVELS);
    expect(proficiencyInstruction("TA")).toBe(
      "Choose a level of proficiency, with 1 being the lowest, and 5 being the highest.",
    );
  });

  test("the ULA topic scale has three worded levels", () => {
    expect(ULA_PROFICIENCY_LEVELS).toEqual([
      { value: 1, label: "1-Very comfortable" },
      { value: 2, label: "2-Somewhat comfortable" },
      { value: 3, label: "3-Not familiar" },
    ]);
    expect(proficiencyLevels("ULA")).toBe(ULA_PROFICIENCY_LEVELS);
    expect(proficiencyInstruction("ULA")).toBe(
      "For each topic, choose 1 if you are very comfortable with it, 2 if somewhat comfortable, or 3 if you are not familiar with it.",
    );
  });

  test("the interest scale runs 1 to 5 with its ends worded", () => {
    expect(INTEREST_LEVELS).toEqual([
      { value: 1, label: "1-Not interested" },
      { value: 2, label: "2" },
      { value: 3, label: "3" },
      { value: 4, label: "4" },
      { value: 5, label: "5-Very interested" },
    ]);
  });

  test("topic ratings are carried through as given", () => {
    expect(
      toPayload(fields({ topicProficiencies: { Java: 5, Python: 2 } }))
        .topicProficiencies,
    ).toEqual({ Java: 5, Python: 2 });
  });

  /** The sentinel can never collide with a real major typed by an applicant. */
  test("the Other sentinel is not a plausible major name", () => {
    expect(OTHER_MAJOR).toBe("__OTHER__");
    expect(EMPTY_OPTIONS).toEqual({ majors: [], topics: [], interests: [] });
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

  /** Issue #72: the ULA yes/no questions travel as "true"/"false" and arrive as booleans. */
  test("the ULA yes/no answers become booleans, and blank ones null", () => {
    const payload = toPayload(fields());
    expect(payload.bsMsStudent).toBe(true);
    expect(payload.wantsTaEligibility).toBe(false);
    expect(payload.priorUcsbEmployment).toBe(true);
    // A checkbox since issue #111, so it travels as it is.
    expect(payload.i9Appointment).toBe(false);
    expect(toPayload(fields({ i9Appointment: true })).i9Appointment).toBe(true);
    expect(payload.changingMajor).toBe(false);
    expect(payload.studentStatusNextQuarter).toBe("GRADUATE");
    expect(payload.otherCampusJob).toBe("NOT_SURE");
    expect(payload.trainingCommitment).toBe("UNSURE");
    // Text answers travel as they are; the backend upper-cases the perm number.
    expect(payload.permNumber).toBe("a1b2c3d");
    expect(payload.employeeId).toBe("1234567");
    expect(payload.trainingCommitmentExplanation).toBe(
      "Might have a Friday lab",
    );

    const blank = toPayload(
      fields({
        bsMsStudent: "",
        studentStatusNextQuarter: "",
        otherCampusJob: "",
        trainingCommitment: "",
        changingMajor: "",
      }),
    );
    expect(blank.bsMsStudent).toBeNull();
    expect(blank.studentStatusNextQuarter).toBeNull();
    expect(blank.otherCampusJob).toBeNull();
    expect(blank.trainingCommitment).toBeNull();
    expect(blank.changingMajor).toBeNull();
  });
});
