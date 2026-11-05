import {
  ENTHUSIASTIC,
  FIRST_CHOICE,
  NOT_INTERESTED,
  SECOND_CHOICE,
  WOULD_CONSIDER,
} from "main/utils/interestDisplay";

/**
 * The applicant's interest in a course, strongest first. This is the order the faculty ranking
 * page and the admin Assignments page share (issue #345).
 */
export const PREFERENCE_ORDER: string[] = [
  FIRST_CHOICE,
  SECOND_CHOICE,
  ENTHUSIASTIC,
  WOULD_CONSIDER,
  NOT_INTERESTED,
];

/** What one applicant has for one course: the faculty rank (if any) and their own interest. */
export type RankAndPreference = {
  /** The faculty rank, 1 first; undefined, null or Infinity when the applicant is unranked. */
  rank?: number | null;
  /** The applicant's interest; undefined or null reads as Not Interested. */
  preference?: string | null;
};

/**
 * The default order of the candidates for one course (issues #265 and #345): every ranked
 * applicant first, from rank 1 down, then the unranked in order of the student's preference (1st
 * choice, 2nd choice, Enthusiastic, Would Consider, Not Interested); applicants ranked equally
 * are also ordered by preference. A tie on both is 0, so a stable sort over rows that arrive in
 * submission order keeps the applications in the order they were submitted.
 */
export function compareByRankThenPreference(
  a: RankAndPreference,
  b: RankAndPreference,
): number {
  const byRank = (a.rank ?? Infinity) - (b.rank ?? Infinity);
  if (byRank !== 0 && !Number.isNaN(byRank)) return byRank;
  return (
    PREFERENCE_ORDER.indexOf(a.preference ?? NOT_INTERESTED) -
    PREFERENCE_ORDER.indexOf(b.preference ?? NOT_INTERESTED)
  );
}
