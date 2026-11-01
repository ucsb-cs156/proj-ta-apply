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

/**
 * Issues #178 and #224: who may see a recruitment's allocations. One setting per recruitment with
 * three states, chosen in the Allocation Visibility modal on the Recruitment Courses page; there is
 * nothing about it on a course's row.
 */
export type AllocationVisibility =
  "ADMINS_ONLY" | "OWN_COURSES" | "ALL_COURSES";

export const ALLOCATION_VISIBILITY_OPTIONS: {
  value: AllocationVisibility;
  name: string;
  explanation: string;
}[] = [
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
];

/** A recruitment's setting; one that has none yet (an older response) is admins only. */
export const allocationVisibilityOf = (recruitment: {
  allocationVisibility?: AllocationVisibility | null;
}): AllocationVisibility => recruitment.allocationVisibility ?? "ADMINS_ONLY";

/** The short name of a state, as the panel and the toast say it. */
export const allocationVisibilityName = (
  visibility: AllocationVisibility,
): string =>
  ALLOCATION_VISIBILITY_OPTIONS.find((option) => option.value === visibility)
    ?.name ?? "";

export const ALLOCATION_VISIBILITY_NOTE =
  "You can still change allocations afterwards; faculty see changes immediately.";

export const allocationVisibilityToast = (
  visibility: AllocationVisibility,
): string =>
  `Allocation visibility is now: ${allocationVisibilityName(visibility)}.`;

/**
 * The notice at the top of the candidate ranking page once allocations are shown (issue #178; the
 * targets table shown with it is in courseTargets.ts, issue #224):
 * how many positions the course has, and that the instructor should rank at least that many
 * candidates and preferably twice as many.
 */
export const rankingAllocationNotice = (
  type: "TA" | "ULA",
  allocation: number,
): string => {
  const positions =
    allocation === 1 ? `1 ${type} has` : `${allocation} ${type}s have`;
  const candidates =
    allocation === 1 ? "1 candidate" : `${allocation} candidates`;
  return `${positions} been allocated to this course. Please rank at least ${candidates}, and preferably ${2 * allocation}.`;
};
