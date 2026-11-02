/**
 * The numbers behind Developer Mode's Fake Hiring Targets and Allocations (issue #225). The
 * backend enforces the same bounds; these keep the modal from offering what it would refuse.
 */

/** The largest hiring target offered, as a multiple of the recruitment's courses. */
export const MAX_TARGET_PER_COURSE = 3;

/** Where the enrollment estimates come from; KEEP leaves the ones already entered. */
export type FakeEstimates = "MAX" | "ACTUAL" | "KEEP";

/** The choices in the order the modal lists them, with their labels. */
export const FAKE_ESTIMATE_CHOICES: { value: FakeEstimates; label: string }[] =
  [
    { value: "MAX", label: "Use the schedule's maximum enrollment" },
    { value: "ACTUAL", label: "Use current enrollment" },
    { value: "KEEP", label: "Keep the estimates already entered" },
  ];

/** The largest target for a recruitment with this many (non-removed) courses. */
export const maxFakeTarget = (courseCount: number): number =>
  MAX_TARGET_PER_COURSE * courseCount;

/** A whole number from 1 to {@link maxFakeTarget}, typed as text. */
export const isValidFakeTarget = (
  value: string,
  courseCount: number,
): boolean =>
  /^\d+$/.test(value) &&
  Number(value) >= 1 &&
  Number(value) <= maxFakeTarget(courseCount);
