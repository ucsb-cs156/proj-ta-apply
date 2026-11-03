import { describe, expect, test } from "vitest";
import {
  DEFAULT_ADMIN_TIMING,
  DEFAULT_NON_ADMIN_TIMING,
  MIN_WAIT_SECONDS,
  nextRefreshMs,
  resolveTiming,
  timingFor,
} from "main/utils/refreshInterval";

describe("refreshInterval defaults", () => {
  test("the defaults are the documented ones", () => {
    expect(DEFAULT_ADMIN_TIMING).toEqual({ base: 5, jitter: 3 });
    expect(DEFAULT_NON_ADMIN_TIMING).toEqual({ base: 15, jitter: 5 });
    expect(MIN_WAIT_SECONDS).toBe(1);
  });
});

describe("resolveTiming", () => {
  const fallback = { base: 5, jitter: 3 };

  test("good numbers are used as they are", () => {
    expect(resolveTiming(10, 2, fallback)).toEqual({ base: 10, jitter: 2 });
  });

  test("a base of exactly 1 and a jitter of 0 are allowed", () => {
    expect(resolveTiming(1, 0, fallback)).toEqual({ base: 1, jitter: 0 });
  });

  test("a jitter equal to its base is allowed", () => {
    expect(resolveTiming(4, 4, fallback)).toEqual({ base: 4, jitter: 4 });
  });

  test.each([
    ["missing", undefined],
    ["null", null],
    ["a string", "7"],
    ["NaN", NaN],
    ["Infinity", Infinity],
    ["below one second", 0.5],
    ["zero", 0],
    ["negative", -4],
  ])("a base that is %s is the default", (_name, base) => {
    expect(resolveTiming(base, 1, fallback).base).toBe(5);
  });

  test.each([
    ["missing", undefined],
    ["a string", "1"],
    ["NaN", NaN],
    ["negative", -0.5],
    ["larger than the base", 10.5],
  ])("a jitter that is %s is the default", (_name, jitter) => {
    expect(resolveTiming(10, jitter, fallback).jitter).toBe(3);
  });

  test("the default jitter is cut down to a small base", () => {
    expect(resolveTiming(2, "junk", fallback)).toEqual({ base: 2, jitter: 2 });
  });
});

describe("timingFor", () => {
  const info = {
    adminRefreshSec: 6,
    adminRefreshJitter: 1,
    nonAdminRefresh: 20,
    nonAdminJitter: 4,
  };

  test("an admin uses the admin pair", () => {
    expect(timingFor(info, true)).toEqual({ base: 6, jitter: 1 });
  });

  test("anyone else uses the non-admin pair", () => {
    expect(timingFor(info, false)).toEqual({ base: 20, jitter: 4 });
  });

  test("with nothing from the server, each role gets its defaults", () => {
    expect(timingFor(undefined, true)).toEqual(DEFAULT_ADMIN_TIMING);
    expect(timingFor(null, false)).toEqual(DEFAULT_NON_ADMIN_TIMING);
    expect(timingFor({}, true)).toEqual(DEFAULT_ADMIN_TIMING);
  });

  test("the two pairs do not leak into each other", () => {
    const onlyAdmin = { adminRefreshSec: 9, adminRefreshJitter: 1 };
    expect(timingFor(onlyAdmin, false)).toEqual(DEFAULT_NON_ADMIN_TIMING);
    const onlyOthers = { nonAdminRefresh: 9, nonAdminJitter: 1 };
    expect(timingFor(onlyOthers, true)).toEqual(DEFAULT_ADMIN_TIMING);
  });
});

describe("nextRefreshMs", () => {
  const admin = { base: 5, jitter: 3 };

  test("is uniform between base - jitter and base + jitter", () => {
    expect(nextRefreshMs(admin, () => 0)).toBe(2000);
    expect(nextRefreshMs(admin, () => 0.5)).toBe(5000);
    expect(nextRefreshMs(admin, () => 0.25)).toBe(3500);
    expect(nextRefreshMs(admin, () => 0.75)).toBe(6500);
    expect(nextRefreshMs(admin, () => 0.999999)).toBe(8000);
  });

  test("scales the non-admin pair the same way", () => {
    const others = { base: 15, jitter: 5 };
    expect(nextRefreshMs(others, () => 0)).toBe(10000);
    expect(nextRefreshMs(others, () => 0.5)).toBe(15000);
    expect(nextRefreshMs(others, () => 0.9999999)).toBe(20000);
  });

  test("draws a new number each time it is asked", () => {
    const draws = [0, 0.5, 1];
    let i = 0;
    const random = () => draws[i++] ?? 0.5;
    expect([1, 2, 3].map(() => nextRefreshMs(admin, random))).toEqual([
      2000, 5000, 8000,
    ]);
  });

  test("with no jitter the wait is the base", () => {
    expect(nextRefreshMs({ base: 7, jitter: 0 }, () => 0.9)).toBe(7000);
  });

  test("never waits less than one second", () => {
    expect(nextRefreshMs({ base: 1, jitter: 1 }, () => 0)).toBe(1000);
    expect(nextRefreshMs({ base: 1, jitter: 5 }, () => 0)).toBe(1000);
  });

  test("uses Math.random when no source is given", () => {
    const ms = nextRefreshMs({ base: 5, jitter: 3 });
    expect(ms).toBeGreaterThanOrEqual(2000);
    expect(ms).toBeLessThanOrEqual(8000);
  });
});
