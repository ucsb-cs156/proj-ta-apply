/**
 * Validation for the hiring-target and allocation boxes on the Recruitment Courses page (issue
 * #174). Both take whole numbers typed as text; a value that fails is never sent to the backend.
 */

/** A whole number of positions, at least one: the recruitment's total hiring target. */
export const isValidHiringTarget = (value: string): boolean =>
  /^\d+$/.test(value) && Number(value) >= 1;

/** A whole number of positions, zero or more: one course's allocation. */
export const isValidAllocation = (value: string): boolean =>
  /^\d+$/.test(value);

/**
 * A whole number of students, or nothing at all: one course's enrollment estimate (issue #175).
 * An empty box clears the estimate rather than being an error.
 */
export const isValidEnrollmentEstimate = (value: string): boolean =>
  value === "" || /^\d+$/.test(value);

/** How long after the last keystroke an enrollment estimate is saved (issue #175). */
export const ESTIMATE_SAVE_DELAY_MS = 1000;

/** Shown under the totals when more has been allocated than the target allows. */
export const OVER_ALLOCATED_MESSAGE =
  "Please either increase the hiring target, or reduce the allocations for one or more courses.";

/** A course as the allocation columns need it (issue #176). */
export type AllocationFigures = {
  allocation?: number | null;
  enrollmentEstimate?: number | null;
  unroundedAllocation?: number | null;
};

/** One decimal place, always: 1 shows as "1.0". */
export const oneDecimal = (value: number): string => value.toFixed(1);

/**
 * How far the course is from its fair share: unroundedAllocation minus allocation, as the
 * design defines it. A course with no share yet counts as 0.0.
 */
export const allocationDelta = (course: AllocationFigures): number =>
  (course.unroundedAllocation ?? 0) - (course.allocation ?? 0);

/**
 * The delta as shown: a plus sign and green when positive, red when negative, and plain
 * "0.0" (never "-0.0") in black for anything that rounds to zero.
 */
export const deltaDisplay = (
  delta: number,
): { text: string; className: string } => {
  const rounded = Number(oneDecimal(delta));
  if (rounded > 0) {
    return { text: `+${oneDecimal(rounded)}`, className: "text-success" };
  }
  if (rounded < 0) {
    return { text: oneDecimal(rounded), className: "text-danger" };
  }
  return { text: "0.0", className: "" };
};

/**
 * The estimated students per position, "1:n" with n rounded to a whole number; a dash when the
 * course has no estimate or no positions.
 */
export const ratioDisplay = (course: AllocationFigures): string => {
  const allocation = course.allocation ?? 0;
  if (course.enrollmentEstimate == null || allocation <= 0) {
    return "\u2014";
  }
  return `1:${Math.round(course.enrollmentEstimate / allocation)}`;
};

/** The tooltip on the Unrounded Allocation heading. */
export const unroundedTooltip = (type: "TA" | "ULA"): string =>
  `unroundedAllocation is how many ${type}s the course would receive if ${type}s could be divided into "fractional bits", and were divided based only on estimatedEnrollment. In reality, one must round up or round down, but this number provides a guide for approaching a fair allocation.`;

/** The tooltip on the Auto assign button. */
export const autoAssignTooltip = (
  totalHiringTarget: number,
  type: "TA" | "ULA",
): string =>
  `Automatically allocate the ${totalHiringTarget} ${type}s across courses based on enrollment`;
