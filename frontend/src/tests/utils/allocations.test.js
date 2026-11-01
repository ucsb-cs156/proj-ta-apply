import {
  allocationDelta,
  autoAssignTooltip,
  deltaDisplay,
  ESTIMATE_SAVE_DELAY_MS,
  oneDecimal,
  ratioDisplay,
  unroundedTooltip,
  isValidAllocation,
  isValidEnrollmentEstimate,
  isValidHiringTarget,
  OVER_ALLOCATED_MESSAGE,
  ALLOCATION_VISIBILITY_NOTE,
  ALLOCATION_VISIBILITY_OPTIONS,
  allocationVisibilityName,
  allocationVisibilityOf,
  allocationVisibilityToast,
  rankingAllocationNotice,
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

  test("an enrollment estimate is a whole number of zero or more, or nothing", () => {
    expect(isValidEnrollmentEstimate("")).toBe(true);
    expect(isValidEnrollmentEstimate("0")).toBe(true);
    expect(isValidEnrollmentEstimate("150")).toBe(true);
    expect(isValidEnrollmentEstimate("-1")).toBe(false);
    expect(isValidEnrollmentEstimate("1.5")).toBe(false);
    expect(isValidEnrollmentEstimate("many")).toBe(false);
    expect(isValidEnrollmentEstimate(" 1")).toBe(false);
  });

  test("estimates are saved a second after the last keystroke", () => {
    expect(ESTIMATE_SAVE_DELAY_MS).toBe(1000);
  });

  test("the over-allocation message is the one the design asks for", () => {
    expect(OVER_ALLOCATED_MESSAGE).toBe(
      "Please either increase the hiring target, or reduce the allocations for one or more courses.",
    );
  });

  // ---- issue #176 ----

  test("one decimal place, always", () => {
    expect(oneDecimal(1)).toBe("1.0");
    expect(oneDecimal(2.25)).toBe("2.3");
    expect(oneDecimal(3.6666)).toBe("3.7");
    expect(oneDecimal(0)).toBe("0.0");
  });

  test("the delta is the unrounded share minus the allocation", () => {
    expect(
      allocationDelta({ unroundedAllocation: 3.5, allocation: 2 }),
    ).toBeCloseTo(1.5);
    expect(
      allocationDelta({ unroundedAllocation: 1.2, allocation: 3 }),
    ).toBeCloseTo(-1.8);
    expect(allocationDelta({ allocation: 2 })).toBe(-2);
    expect(allocationDelta({ unroundedAllocation: 2.5 })).toBe(2.5);
    expect(
      allocationDelta({ unroundedAllocation: null, allocation: null }),
    ).toBe(0);
  });

  test("a positive delta is green with a plus sign", () => {
    expect(deltaDisplay(1.5)).toEqual({
      text: "+1.5",
      className: "text-success",
    });
    expect(deltaDisplay(0.05)).toEqual({
      text: "+0.1",
      className: "text-success",
    });
    expect(deltaDisplay(2)).toEqual({
      text: "+2.0",
      className: "text-success",
    });
  });

  test("a negative delta is red with its minus sign", () => {
    expect(deltaDisplay(-1.5)).toEqual({
      text: "-1.5",
      className: "text-danger",
    });
    expect(deltaDisplay(-0.05)).toEqual({
      text: "-0.1",
      className: "text-danger",
    });
  });

  test("anything that rounds to zero is a plain black 0.0, never -0.0", () => {
    expect(deltaDisplay(0)).toEqual({ text: "0.0", className: "" });
    expect(deltaDisplay(0.04)).toEqual({ text: "0.0", className: "" });
    expect(deltaDisplay(-0.04)).toEqual({ text: "0.0", className: "" });
  });

  test("the ratio is 1:n with n rounded, or a dash", () => {
    expect(ratioDisplay({ enrollmentEstimate: 220, allocation: 2 })).toBe(
      "1:110",
    );
    expect(ratioDisplay({ enrollmentEstimate: 140, allocation: 3 })).toBe(
      "1:47",
    );
    expect(ratioDisplay({ enrollmentEstimate: 0, allocation: 3 })).toBe("1:0");
    expect(ratioDisplay({ enrollmentEstimate: 140, allocation: 0 })).toBe(
      "\u2014",
    );
    expect(ratioDisplay({ enrollmentEstimate: 140 })).toBe("\u2014");
    expect(ratioDisplay({ enrollmentEstimate: null, allocation: 3 })).toBe(
      "\u2014",
    );
    expect(ratioDisplay({ allocation: 3 })).toBe("\u2014");
  });

  test("the tooltips name the type and the target", () => {
    expect(unroundedTooltip("TA")).toBe(
      'unroundedAllocation is how many TAs the course would receive if TAs could be divided into "fractional bits", and were divided based only on estimatedEnrollment. In reality, one must round up or round down, but this number provides a guide for approaching a fair allocation.',
    );
    expect(unroundedTooltip("ULA")).toMatch(
      /^unroundedAllocation is how many ULAs the course would receive if ULAs could/,
    );
    expect(autoAssignTooltip(12, "TA")).toBe(
      "Automatically allocate the 12 TAs across courses based on enrollment",
    );
    expect(autoAssignTooltip(6, "ULA")).toBe(
      "Automatically allocate the 6 ULAs across courses based on enrollment",
    );
  });

  // ---- issue #178 ----

  test("the three allocation visibility states and their plain-language explanations", () => {
    expect(ALLOCATION_VISIBILITY_OPTIONS).toEqual([
      {
        value: "ADMINS_ONLY",
        name: "Admins only",
        explanation: "No faculty member sees any allocation.",
      },
      {
        value: "OWN_COURSES",
        name: "Faculty see their own courses",
        explanation:
          "Each faculty member sees the allocations for the courses they teach. This is what Release Allocations to Faculty means.",
      },
      {
        value: "ALL_COURSES",
        name: "Faculty see all courses",
        explanation:
          "Every faculty member teaching in this recruitment sees the allocations of all its courses.",
      },
    ]);
    expect(ALLOCATION_VISIBILITY_NOTE).toBe(
      "You can still change allocations afterwards; faculty see changes immediately.",
    );
  });

  test("a recruitment's visibility defaults to admins only, and each state has its name and toast", () => {
    expect(allocationVisibilityOf({})).toBe("ADMINS_ONLY");
    expect(allocationVisibilityOf({ allocationVisibility: null })).toBe(
      "ADMINS_ONLY",
    );
    expect(
      allocationVisibilityOf({ allocationVisibility: "OWN_COURSES" }),
    ).toBe("OWN_COURSES");
    expect(allocationVisibilityName("ADMINS_ONLY")).toBe("Admins only");
    expect(allocationVisibilityName("OWN_COURSES")).toBe(
      "Faculty see their own courses",
    );
    expect(allocationVisibilityName("ALL_COURSES")).toBe(
      "Faculty see all courses",
    );
    expect(allocationVisibilityName("SOMETHING_ELSE")).toBe("");
    expect(allocationVisibilityToast("ALL_COURSES")).toBe(
      "Allocation visibility is now: Faculty see all courses.",
    );
  });

  test("the ranking notice handles singular and plural and doubles the number", () => {
    expect(rankingAllocationNotice("TA", 2)).toBe(
      "2 TAs have been allocated to this course. Please rank at least 2 candidates, and preferably 4.",
    );
    expect(rankingAllocationNotice("ULA", 1)).toBe(
      "1 ULA has been allocated to this course. Please rank at least 1 candidate, and preferably 2.",
    );
    expect(rankingAllocationNotice("ULA", 0)).toBe(
      "0 ULAs have been allocated to this course. Please rank at least 0 candidates, and preferably 0.",
    );
    expect(rankingAllocationNotice("TA", 3)).toBe(
      "3 TAs have been allocated to this course. Please rank at least 3 candidates, and preferably 6.",
    );
  });
});
