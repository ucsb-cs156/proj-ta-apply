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

/** Shown under the totals when more has been allocated than the target allows. */
export const OVER_ALLOCATED_MESSAGE =
  "Please either increase the hiring target, or reduce the allocations for one or more courses.";
