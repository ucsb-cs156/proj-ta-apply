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
