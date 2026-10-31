import {
  ESTIMATE_SAVE_DELAY_MS,
  isValidAllocation,
  isValidEnrollmentEstimate,
  isValidHiringTarget,
  OVER_ALLOCATED_MESSAGE,
  ALLOCATIONS_HIDDEN_MESSAGE,
  ALLOCATIONS_SHOWN_MESSAGE,
  SHOW_ALLOCATIONS_LABEL,
  HIDE_ALLOCATIONS_LABEL,
  courseAllocationText,
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

  // ---- issue #178 ----

  test("the visibility messages and button labels are the ones the design asks for", () => {
    expect(ALLOCATIONS_HIDDEN_MESSAGE).toBe(
      "Allocations of TAs/ULAs per course are currently hidden from faculty.",
    );
    expect(ALLOCATIONS_SHOWN_MESSAGE).toBe(
      "Allocations of TAs/ULAs per course are currently shown to faculty (though only for their own courses)",
    );
    expect(SHOW_ALLOCATIONS_LABEL).toBe("Show Allocations to Faculty");
    expect(HIDE_ALLOCATIONS_LABEL).toBe("Hide Allocations from Faculty");
  });

  test("the card line names the type and the number", () => {
    expect(courseAllocationText("TA", 2)).toBe(
      "TAs allocated to this course: 2",
    );
    expect(courseAllocationText("ULA", 1)).toBe(
      "ULAs allocated to this course: 1",
    );
    expect(courseAllocationText("TA", 0)).toBe(
      "TAs allocated to this course: 0",
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
