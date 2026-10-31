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

/** Issue #178: the two states of the show/hide control on the Recruitment Courses page. */
export const ALLOCATIONS_HIDDEN_MESSAGE =
  "Allocations of TAs/ULAs per course are currently hidden from faculty.";
export const ALLOCATIONS_SHOWN_MESSAGE =
  "Allocations of TAs/ULAs per course are currently shown to faculty (though only for their own courses)";
export const SHOW_ALLOCATIONS_LABEL = "Show Allocations to Faculty";
export const HIDE_ALLOCATIONS_LABEL = "Hide Allocations from Faculty";

/** The line under a course on an instructor's home page card once allocations are shown. */
export const courseAllocationText = (
  type: "TA" | "ULA",
  allocation: number,
): string => `${type}s allocated to this course: ${allocation}`;

/**
 * The notice at the top of the candidate ranking page once allocations are shown (issue #178):
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
