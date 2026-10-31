import {
  isValidAllocation,
  isValidHiringTarget,
  OVER_ALLOCATED_MESSAGE,
} from "main/utils/allocations";

describe("allocations utilities", () => {
  test("a hiring target is a whole number of at least one", () => {
    expect(isValidHiringTarget("1")).toBe(true);
    expect(isValidHiringTarget("12")).toBe(true);
    expect(isValidHiringTarget("0")).toBe(false);
    expect(isValidHiringTarget("")).toBe(false);
    expect(isValidHiringTarget("-1")).toBe(false);
    expect(isValidHiringTarget("1.5")).toBe(false);
    expect(isValidHiringTarget("five")).toBe(false);
    expect(isValidHiringTarget(" 3")).toBe(false);
  });

  test("an allocation is a whole number of zero or more", () => {
    expect(isValidAllocation("0")).toBe(true);
    expect(isValidAllocation("7")).toBe(true);
    expect(isValidAllocation("12")).toBe(true);
    expect(isValidAllocation("")).toBe(false);
    expect(isValidAllocation("-1")).toBe(false);
    expect(isValidAllocation("2.5")).toBe(false);
    expect(isValidAllocation("x")).toBe(false);
  });

  test("the over-allocation message is the one the design asks for", () => {
    expect(OVER_ALLOCATED_MESSAGE).toBe(
      "Please either increase the hiring target, or reduce the allocations for one or more courses.",
    );
  });
});
