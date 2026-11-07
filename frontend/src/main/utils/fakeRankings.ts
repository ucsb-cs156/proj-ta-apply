/** Which courses Create Fake Rankings (issue #220) ranks; the values the backend accepts. */
export type FakeRankingScope = "SOME" | "ALL";

export const FAKE_RANKING_SCOPES: { value: FakeRankingScope; label: string }[] =
  [
    { value: "ALL", label: "Every course that has no rankings yet" },
    {
      value: "SOME",
      label: "Some of the courses (a random part; the rest stay unranked)",
    },
  ];

/**
 * Whether the Create Fake Rankings button is offered: only while the faculty review is Open, the
 * only time instructors rank, and there is a course to rank.
 */
export const canCreateFakeRankings = (
  reviewStatus: string | undefined,
  courseCount: number,
): boolean => reviewStatus === "Open" && courseCount > 0;

/**
 * What the Combined Allocation page's modal says about which of the quarter's recruitments get
 * fake rankings (issue #358), by type: nothing when there is only the one acted on; which ones when
 * several are; and when one is left out, because its faculty review is not Open or it has no
 * course, which one and why.
 */
export const fakeRankingsNote = (
  acting: string[],
  skipped: string[],
): string | undefined => {
  if (skipped.length > 0) {
    return `Only the ${acting.join(" and ")} recruitment's faculty review is Open with courses to rank, so only its courses get rankings; the ${skipped.join(" and ")} recruitment is left alone.`;
  }
  return acting.length > 1
    ? `The ${acting.join(" and ")} recruitments both get rankings, one job each.`
    : undefined;
};
