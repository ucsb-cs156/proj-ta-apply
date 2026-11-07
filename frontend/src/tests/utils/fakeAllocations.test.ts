import { describe, expect, test } from "vitest";
import {
  FAKE_ESTIMATE_CHOICES,
  fakeAllocationsMessage,
  fakeTargetLabel,
  isValidFakeTarget,
  MAX_TARGET_PER_COURSE,
  maxFakeTarget,
} from "main/utils/fakeAllocations";

describe("fakeAllocations", () => {
  test("the largest target is three per course", () => {
    expect(MAX_TARGET_PER_COURSE).toBe(3);
    expect(maxFakeTarget(1)).toBe(3);
    expect(maxFakeTarget(4)).toBe(12);
    expect(maxFakeTarget(0)).toBe(0);
  });

  test("a target is a whole number from one to the largest", () => {
    expect(isValidFakeTarget("1", 4)).toBe(true);
    expect(isValidFakeTarget("12", 4)).toBe(true);
    expect(isValidFakeTarget("0", 4)).toBe(false);
    expect(isValidFakeTarget("13", 4)).toBe(false);
    expect(isValidFakeTarget("", 4)).toBe(false);
    expect(isValidFakeTarget("2.5", 4)).toBe(false);
    expect(isValidFakeTarget("-1", 4)).toBe(false);
    expect(isValidFakeTarget("abc", 4)).toBe(false);
    // With no courses nothing is valid.
    expect(isValidFakeTarget("1", 0)).toBe(false);
  });

  test("a target box is named by its recruitment's type when it has one (issue #358)", () => {
    expect(fakeTargetLabel(undefined)).toBe("Hiring target");
    expect(fakeTargetLabel("TA")).toBe("TA hiring target");
    expect(fakeTargetLabel("ULA")).toBe("ULA hiring target");
  });

  test("what is said once the targets are faked: one as before, several each with its type", () => {
    expect(fakeAllocationsMessage([{ target: "4" }])).toBe(
      "Faked a hiring target of 4 and allocated it across the courses.",
    );
    expect(fakeAllocationsMessage([{ type: "TA", target: "4" }])).toBe(
      "Faked a hiring target of 4 and allocated it across the courses.",
    );
    expect(
      fakeAllocationsMessage([
        { type: "TA", target: "4" },
        { type: "ULA", target: "2" },
      ]),
    ).toBe(
      "Faked hiring targets of 4 (TA) and 2 (ULA) and allocated them across the courses.",
    );
    expect(
      fakeAllocationsMessage([
        { target: "4" },
        { target: "2" },
        { type: "X", target: "1" },
      ]),
    ).toBe(
      "Faked hiring targets of 4, 2 and 1 (X) and allocated them across the courses.",
    );
  });

  test("the estimate choices, in order, with their labels", () => {
    expect(FAKE_ESTIMATE_CHOICES).toEqual([
      { value: "MAX", label: "Use the schedule's maximum enrollment" },
      { value: "ACTUAL", label: "Use current enrollment" },
      { value: "KEEP", label: "Keep the estimates already entered" },
    ]);
  });
});
