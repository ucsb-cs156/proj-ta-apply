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

/** One recruitment the modal fakes: a box for its target, sized by its non-removed courses. */
export type FakeAllocationsRecruitment = {
  recruitmentId: number | string;
  /** The recruitment's non-removed courses: the default target, and a third of the largest. */
  courseCount: number;
  /** Names the box ("TA hiring target") on a page with more than one recruitment (issue #358). */
  type?: string;
};

/** The label of a recruitment's target box: its type, when it has one, so two boxes differ. */
export const fakeTargetLabel = (type: string | undefined): string =>
  type === undefined ? "Hiring target" : `${type} hiring target`;

/**
 * What is said once the targets are set and allocated: for one recruitment as it always was, and
 * for several each target with its type, "4 (TA) and 2 (ULA)".
 */
export const fakeAllocationsMessage = (
  targets: { type?: string; target: string }[],
): string => {
  if (targets.length === 1) {
    return `Faked a hiring target of ${targets[0].target} and allocated it across the courses.`;
  }
  const each = targets.map(({ type, target }) =>
    type === undefined ? target : `${target} (${type})`,
  );
  return `Faked hiring targets of ${each.slice(0, -1).join(", ")} and ${each[each.length - 1]} and allocated them across the courses.`;
};
