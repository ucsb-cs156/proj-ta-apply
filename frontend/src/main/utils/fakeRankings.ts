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

/** How the tooltip names a faculty ranking status that is not Open. */
const describeReviewStatus = (reviewStatus: string | undefined): string => {
  switch (reviewStatus) {
    case "NotStarted":
      return "not started";
    case "Closed":
      return "closed";
    default:
      return "not known yet";
  }
};

/**
 * Why the Create Fake Rankings button is disabled (issue #385): one sentence for each condition
 * that is not met, saying what must happen first and where, for the disabled button's tooltip and
 * the Help page. The backend refuses the job unless the faculty review is Open; the course
 * condition is the page's own, since a recruitment without a course on offer has nothing to rank.
 * Empty while the button is enabled.
 */
export const fakeRankingsBlockers = (
  reviewStatus: string | undefined,
  courseCount: number,
): string[] => {
  const blockers: string[] = [];
  if (reviewStatus !== "Open") {
    blockers.push(
      `Faculty ranking must be Open for this recruitment; it is ${describeReviewStatus(reviewStatus)}. ${reviewStatus === "Closed" ? "Reopen" : "Open"} it from the recruitment's card on the home page (Recruitment Steps, step 6: Open Faculty Ranking), which asks for a faculty ranking deadline.`,
    );
  }
  if (courseCount === 0) {
    blockers.push(
      "The recruitment must have at least one course on offer to rank; it has none. Fill its course list with Populate on its Courses page.",
    );
  }
  return blockers;
};

/** The note the modal shows when the recruitment has no applicants to rank (issue #385). */
export const NO_APPLICANTS_NOTE =
  "This recruitment has no applicants yet, so the job would rank nobody. Create fake applications on the recruitment's Applications page first.";
