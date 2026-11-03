import type { SystemInfo } from "main/utils/systemInfo";

/**
 * How long a page waits before it re-reads the recruitment state in the background (issue #281).
 *
 * Each wait is drawn uniformly between `base - jitter` and `base + jitter` seconds, afresh before
 * every refresh, so that clients which started together (a classroom opening the home page at the
 * same moment) drift apart instead of asking the server at the same instant every time. Admins use
 * one pair of numbers and instructors and students another; the values are the server's settings
 * `ADMIN_REFRESH_SEC`, `ADMIN_REFRESH_JITTER`, `NON_ADMIN_REFRESH` and `NON_ADMIN_JITTER`,
 * delivered in /api/systemInfo so that they can change on a deployed instance without a rebuild.
 */
export type RefreshTiming = {
  /** Mean wait between refreshes, in seconds. */
  base: number;
  /** The wait is uniform between base - jitter and base + jitter seconds. */
  jitter: number;
};

export const DEFAULT_ADMIN_TIMING: RefreshTiming = { base: 5, jitter: 3 };
export const DEFAULT_NON_ADMIN_TIMING: RefreshTiming = { base: 15, jitter: 5 };

/** No wait is ever shorter than this, whatever the settings say. */
export const MIN_WAIT_SECONDS = 1;

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * The timing for one role from what the server sent. A base that is missing, not a number or below
 * one second is the default; a jitter that is missing, not a number, negative or larger than its
 * base is the default, and a jitter is never larger than its base.
 */
export function resolveTiming(
  base: unknown,
  jitter: unknown,
  fallback: RefreshTiming,
): RefreshTiming {
  const goodBase =
    isNumber(base) && base >= MIN_WAIT_SECONDS ? base : fallback.base;
  const goodJitter =
    isNumber(jitter) && jitter >= 0 && jitter <= goodBase
      ? jitter
      : fallback.jitter;
  return { base: goodBase, jitter: Math.min(goodJitter, goodBase) };
}

/** The timing for an admin (anyone with the admin role) or for everyone else. */
export function timingFor(
  info: Partial<SystemInfo> | null | undefined,
  isAdmin: boolean,
): RefreshTiming {
  return isAdmin
    ? resolveTiming(
        info?.adminRefreshSec,
        info?.adminRefreshJitter,
        DEFAULT_ADMIN_TIMING,
      )
    : resolveTiming(
        info?.nonAdminRefresh,
        info?.nonAdminJitter,
        DEFAULT_NON_ADMIN_TIMING,
      );
}

/**
 * The next wait in milliseconds: uniform between base - jitter and base + jitter seconds, never
 * under one second. `random` is injectable (it returns a number from 0 up to but not including 1)
 * so that tests are deterministic.
 */
export function nextRefreshMs(
  timing: RefreshTiming,
  random: () => number = Math.random,
): number {
  const seconds = timing.base - timing.jitter + 2 * timing.jitter * random();
  return Math.round(Math.max(MIN_WAIT_SECONDS, seconds) * 1000);
}
