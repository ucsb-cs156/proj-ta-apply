import { describe, expect, test } from "vitest";
import {
  FAKE_RANKING_SCOPES,
  NO_APPLICANTS_NOTE,
  canCreateFakeRankings,
  fakeRankingsBlockers,
} from "main/utils/fakeRankings";

describe("fakeRankings", () => {
  test("the scopes are the values the backend accepts, every course first", () => {
    expect(FAKE_RANKING_SCOPES).toEqual([
      { value: "ALL", label: "Every course that has no rankings yet" },
      {
        value: "SOME",
        label: "Some of the courses (a random part; the rest stay unranked)",
      },
    ]);
  });

  test("rankings can be faked only while the review is Open and there is a course", () => {
    expect(canCreateFakeRankings("Open", 1)).toBe(true);
    expect(canCreateFakeRankings("Open", 4)).toBe(true);
    expect(canCreateFakeRankings("Open", 0)).toBe(false);
    expect(canCreateFakeRankings("NotStarted", 4)).toBe(false);
    expect(canCreateFakeRankings("Closed", 4)).toBe(false);
    expect(canCreateFakeRankings(undefined, 4)).toBe(false);
  });

  test("the blockers say what must happen before the button can be used, one sentence each (issue #385)", () => {
    const where =
      "from the recruitment's card on the home page (Recruitment Steps, step 6: Open Faculty Ranking), which asks for a faculty ranking deadline.";
    const noCourses =
      "The recruitment must have at least one course on offer to rank; it has none. Fill its course list with Populate on its Courses page.";
    expect(fakeRankingsBlockers("Open", 1)).toEqual([]);
    expect(fakeRankingsBlockers("Open", 4)).toEqual([]);
    expect(fakeRankingsBlockers("NotStarted", 4)).toEqual([
      `Faculty ranking must be Open for this recruitment; it is not started. Open it ${where}`,
    ]);
    expect(fakeRankingsBlockers("Closed", 4)).toEqual([
      `Faculty ranking must be Open for this recruitment; it is closed. Reopen it ${where}`,
    ]);
    expect(fakeRankingsBlockers(undefined, 4)).toEqual([
      `Faculty ranking must be Open for this recruitment; it is not known yet. Open it ${where}`,
    ]);
    expect(fakeRankingsBlockers("Open", 0)).toEqual([noCourses]);
    // Both unmet: the review first, since it is the one the backend enforces.
    expect(fakeRankingsBlockers("NotStarted", 0)).toEqual([
      `Faculty ranking must be Open for this recruitment; it is not started. Open it ${where}`,
      noCourses,
    ]);
    // The button is enabled exactly when there is nothing to say.
    for (const status of ["Open", "NotStarted", "Closed", undefined]) {
      for (const count of [0, 1, 4]) {
        expect(fakeRankingsBlockers(status, count).length === 0).toBe(
          canCreateFakeRankings(status, count),
        );
      }
    }
  });

  test("the note for a recruitment without applicants (issue #385)", () => {
    expect(NO_APPLICANTS_NOTE).toBe(
      "This recruitment has no applicants yet, so the job would rank nobody. Create fake applications on the recruitment's Applications page first.",
    );
  });
});
