import { describe, expect, test } from "vitest";
import {
  FAKE_RANKING_SCOPES,
  canCreateFakeRankings,
  fakeRankingsNote,
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

  test("the combined page's note: nothing for one recruitment alone, which ones for several, and why one is left out (issue #358)", () => {
    expect(fakeRankingsNote(["TA"], [])).toBeUndefined();
    expect(fakeRankingsNote(["ULA"], [])).toBeUndefined();
    expect(fakeRankingsNote(["TA", "ULA"], [])).toBe(
      "The TA and ULA recruitments both get rankings, one job each.",
    );
    expect(fakeRankingsNote(["TA"], ["ULA"])).toBe(
      "Only the TA recruitment's faculty review is Open with courses to rank, so only its courses get rankings; the ULA recruitment is left alone.",
    );
    expect(fakeRankingsNote(["ULA"], ["TA"])).toBe(
      "Only the ULA recruitment's faculty review is Open with courses to rank, so only its courses get rankings; the TA recruitment is left alone.",
    );
    // There are only two types, so one is acting and one is skipped; the sentence nonetheless
    // joins whatever it is given, with "and".
    expect(fakeRankingsNote(["TA", "ULA"], ["X", "Y"])).toBe(
      "Only the TA and ULA recruitment's faculty review is Open with courses to rank, so only its courses get rankings; the X and Y recruitment is left alone.",
    );
  });
});
