import { describe, expect, test } from "vitest";
import {
  FAKE_RANKING_SCOPES,
  canCreateFakeRankings,
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
});
