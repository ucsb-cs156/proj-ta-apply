import { describe, expect, test } from "vitest";
import {
  CLASS_LEVEL_LABELS,
  LANGUAGE_EXAM_LABELS,
  RESIDENCY_LABELS,
} from "main/utils/applicationLabels";

describe("applicationLabels", () => {
  test("every residency code has its label", () => {
    expect(RESIDENCY_LABELS).toEqual({
      US_CITIZEN: "US Citizen",
      US_RESIDENT: "US Permanent Resident",
      F1_STUDENT_VISA: "F1 Student Visa",
      J1_STUDENT_VISA: "J1 Student Visa",
      OTHER: "Other",
    });
  });

  test("every language exam code has its label", () => {
    expect(LANGUAGE_EXAM_LABELS).toEqual({
      EXEMPT_US_CITIZEN: "exempt (U.S. Citizen)",
      PASSED_US_PERMANENT_RESIDENT: "passed (U.S. Perm. Resident)",
      PASSED_F1_OR_J1_VISA: "passed (F1 or J1 visa)",
      NOT_PASSED: "not passed",
    });
  });

  test("the two class levels have their labels", () => {
    expect(CLASS_LEVEL_LABELS).toEqual({ PHD: "PhD", MS: "MS" });
  });
});
