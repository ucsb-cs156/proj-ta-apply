import { describe, expect, test } from "vitest";
import {
  compareByRankThenPreference,
  PREFERENCE_ORDER,
} from "main/utils/candidateOrder";

describe("candidateOrder (issue #345)", () => {
  test("PREFERENCE_ORDER runs from the strongest interest to Not Interested", () => {
    expect(PREFERENCE_ORDER).toEqual([
      "1st Choice",
      "2nd Choice",
      "Enthusiastic",
      "Would Consider",
      "Not Interested",
    ]);
  });

  test("a lower rank comes first, whatever the preferences", () => {
    expect(
      compareByRankThenPreference(
        { rank: 1, preference: "Not Interested" },
        { rank: 2, preference: "1st Choice" },
      ),
    ).toBeLessThan(0);
    expect(
      compareByRankThenPreference({ rank: 5 }, { rank: 4 }),
    ).toBeGreaterThan(0);
  });

  test("a ranked applicant comes before an unranked one (undefined, null or Infinity)", () => {
    for (const unranked of [undefined, null, Infinity]) {
      expect(
        compareByRankThenPreference(
          { rank: 99, preference: "Not Interested" },
          { rank: unranked, preference: "1st Choice" },
        ),
      ).toBeLessThan(0);
      expect(
        compareByRankThenPreference(
          { rank: unranked, preference: "1st Choice" },
          { rank: 99 },
        ),
      ).toBeGreaterThan(0);
    }
  });

  test("equal ranks, ranked or not, are ordered by preference", () => {
    expect(
      compareByRankThenPreference(
        { rank: 2, preference: "2nd Choice" },
        { rank: 2, preference: "Enthusiastic" },
      ),
    ).toBeLessThan(0);
    expect(
      compareByRankThenPreference(
        { preference: "Would Consider" },
        { preference: "Enthusiastic" },
      ),
    ).toBeGreaterThan(0);
    expect(
      compareByRankThenPreference({ preference: "1st Choice" }, {}),
    ).toBeLessThan(0);
  });

  test("a missing preference reads as Not Interested", () => {
    expect(compareByRankThenPreference({}, { preference: null })).toBe(0);
    expect(
      compareByRankThenPreference(
        { preference: undefined },
        { preference: "Not Interested" },
      ),
    ).toBe(0);
    expect(
      compareByRankThenPreference(
        { preference: "Would Consider" },
        { preference: undefined },
      ),
    ).toBeLessThan(0);
  });

  test("a full tie is 0, and a rank that is not a number falls through to preference", () => {
    expect(
      compareByRankThenPreference(
        { rank: 3, preference: "1st Choice" },
        { rank: 3, preference: "1st Choice" },
      ),
    ).toBe(0);
    expect(
      compareByRankThenPreference(
        { rank: NaN, preference: "1st Choice" },
        { rank: 1, preference: "2nd Choice" },
      ),
    ).toBeLessThan(0);
  });
});
