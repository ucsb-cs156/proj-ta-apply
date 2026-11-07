import { describe, expect, test } from "vitest";
import { mergeStandings, type Standing } from "main/concurrency/merge";

const PHILL = {
  label: "phtcon@ucsb.edu (Phill Conrad)",
  samePerson: false,
  admin: true,
};
const CHRIS = { label: "chris@ucsb.edu (Chris Gaucho)", samePerson: false };
const ME = { label: "me@ucsb.edu (Me)", samePerson: true, admin: true };

const standing = (
  others: Standing["others"],
  newest: boolean,
  arrivedAt: number,
): Standing => ({ others, newest, arrivedAt });

describe("mergeStandings (issue #358)", () => {
  test("nothing merged is alone and not yet arrived, and with no one to be newer than it is the newest", () => {
    expect(mergeStandings([])).toEqual({
      others: [],
      newest: true,
      arrivedAt: 0,
    });
  });

  test("one standing comes back as it is", () => {
    const only = standing([PHILL, ME], true, 1700);
    expect(mergeStandings([only])).toEqual(only);
  });

  test("the others are everyone named by any standing, each person once, first one's order", () => {
    const merged = mergeStandings([
      standing([PHILL, ME], true, 1000),
      standing([CHRIS, { ...PHILL }, { ...ME }], true, 1000),
    ]);
    expect(merged.others).toEqual([PHILL, ME, CHRIS]);
  });

  test("the same label is not the same person when one is you and the other is not, or one is an admin", () => {
    const merged = mergeStandings([
      standing([{ label: "a@ucsb.edu (A)", samePerson: true }], true, 1),
      standing([{ label: "a@ucsb.edu (A)", samePerson: false }], true, 1),
      standing(
        [{ label: "a@ucsb.edu (A)", samePerson: false, admin: true }],
        true,
        1,
      ),
    ]);
    expect(merged.others).toHaveLength(3);
  });

  test("the tab is the newest only when every standing says so", () => {
    expect(
      mergeStandings([standing([], true, 1), standing([PHILL], true, 1)])
        .newest,
    ).toBe(true);
    expect(
      mergeStandings([standing([], true, 1), standing([PHILL], false, 1)])
        .newest,
    ).toBe(false);
    expect(
      mergeStandings([standing([PHILL], false, 1), standing([], true, 1)])
        .newest,
    ).toBe(false);
    expect(
      mergeStandings([standing([], false, 1), standing([], false, 1)]).newest,
    ).toBe(false);
  });

  test("the arrival is the latest of them", () => {
    expect(
      mergeStandings([standing([], true, 1500), standing([], true, 1800)])
        .arrivedAt,
    ).toBe(1800);
    expect(
      mergeStandings([standing([], true, 1800), standing([], true, 1500)])
        .arrivedAt,
    ).toBe(1800);
    expect(
      mergeStandings([standing([], true, 0), standing([], true, 0)]).arrivedAt,
    ).toBe(0);
  });
});
