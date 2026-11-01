import {
  OTHER_CAMPUS_JOB_OPTIONS,
  PERM_NUMBER_PATTERN,
  STUDENT_STATUS_OPTIONS,
  TRAINING_COMMITMENT_OPTIONS,
  YES_NO_OPTIONS,
  booleanToSelect,
  labelOf,
  selectToBoolean,
  yesNoLabel,
  GRADUATE_WARNING,
} from "main/utils/ulaQuestions";

describe("ulaQuestions utilities", () => {
  test("the answer options are worded as on the Google Form", () => {
    expect(YES_NO_OPTIONS.map((o) => [o.value, o.label])).toEqual([
      ["true", "Yes"],
      ["false", "No"],
    ]);
    expect(OTHER_CAMPUS_JOB_OPTIONS.map((o) => [o.value, o.label])).toEqual([
      ["YES", "Yes"],
      ["NO", "No"],
      ["NOT_SURE", "Not sure yet"],
    ]);
    expect(STUDENT_STATUS_OPTIONS.map((o) => [o.value, o.label])).toEqual([
      ["UNDERGRADUATE", "Undergraduate"],
      ["GRADUATE", "Graduate"],
    ]);
    expect(TRAINING_COMMITMENT_OPTIONS.map((o) => o.value)).toEqual([
      "AGREE",
      "UNSURE",
      "CANNOT",
    ]);
    expect(TRAINING_COMMITMENT_OPTIONS.map((o) => o.label)).toEqual([
      "I AGREE to this commitment.",
      "I am UNSURE if I can commit to this training at this point.",
      "I CANNOT commit to this training at this point.",
    ]);
  });

  test("labelOf spells out a stored value and is blank for null or an unknown one", () => {
    expect(labelOf(OTHER_CAMPUS_JOB_OPTIONS, "NOT_SURE")).toBe("Not sure yet");
    expect(labelOf(STUDENT_STATUS_OPTIONS, "GRADUATE")).toBe("Graduate");
    expect(labelOf(STUDENT_STATUS_OPTIONS, null)).toBe("");
    expect(labelOf(STUDENT_STATUS_OPTIONS, "POSTDOC")).toBe("");
  });

  test("booleans round-trip through Yes/No and the select values", () => {
    expect(yesNoLabel(true)).toBe("Yes");
    expect(yesNoLabel(false)).toBe("No");
    expect(yesNoLabel(null)).toBe("");
    expect(yesNoLabel(undefined)).toBe("");
    expect(booleanToSelect(true)).toBe("true");
    expect(booleanToSelect(false)).toBe("false");
    expect(booleanToSelect(null)).toBe("");
    expect(booleanToSelect(undefined)).toBe("");
    expect(selectToBoolean("true")).toBe(true);
    expect(selectToBoolean("false")).toBe(false);
    expect(selectToBoolean("")).toBeNull();
  });

  test("a perm number is exactly seven letters or digits", () => {
    expect(PERM_NUMBER_PATTERN.test("1234567")).toBe(true);
    expect(PERM_NUMBER_PATTERN.test("a1b2c3d")).toBe(true);
    expect(PERM_NUMBER_PATTERN.test("A1B2C3D")).toBe(true);
    expect(PERM_NUMBER_PATTERN.test("123456")).toBe(false);
    expect(PERM_NUMBER_PATTERN.test("12345678")).toBe(false);
    expect(PERM_NUMBER_PATTERN.test("12-4567")).toBe(false);
    expect(PERM_NUMBER_PATTERN.test("")).toBe(false);
  });

  test("the graduate-status warning is the short form (issue #194)", () => {
    expect(GRADUATE_WARNING).toBe(
      "If you will be in graduate status, you are strongly encouraged to apply to be a TA instead of applying to be a ULA.",
    );
    expect(GRADUATE_WARNING).not.toMatch(/funding/);
  });
});
