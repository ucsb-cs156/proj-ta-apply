import type { DetailsColumn } from "main/components/Common/DetailsTable";

/**
 * One course's hiring figures as the backend releases them to faculty (issue #224): the admin's
 * allocation, how many candidates the instructor is asked to rank, how many they have ranked, and
 * how many are still needed.
 */
export type CourseTargets = {
  recruitmentCourseId: number;
  allocation: number;
  /** Interested, real, non-cancelled applicants; the cap on the ranking target. */
  candidateCount: number;
  rankingTarget: number;
  rankedCount: number;
  stillNeeded: number;
};

/** The four headings of the targets table, in order. */
export const TARGET_HEADINGS = [
  "Hiring Target",
  "Ranking Target",
  "Candidates Ranked",
  "Rankings Still Needed",
] as const;

/** The test-id suffix of each column, in heading order. */
export const TARGET_IDS = [
  "hiring-target",
  "ranking-target",
  "candidates-ranked",
  "rankings-still-needed",
] as const;

/**
 * The targets table's columns for DetailsTable: the four numbers under the four headings. Every
 * heading is longer than a small number, so the headings come out stacked and small.
 */
export const targetsColumns = (
  targets: CourseTargets,
  testIdPrefix: string,
): DetailsColumn[] =>
  [
    targets.allocation,
    targets.rankingTarget,
    targets.rankedCount,
    targets.stillNeeded,
  ].map((value, index) => ({
    label: TARGET_HEADINGS[index],
    value: String(value),
    text: String(value),
    testId: `${testIdPrefix}-${TARGET_IDS[index]}`,
  }));
