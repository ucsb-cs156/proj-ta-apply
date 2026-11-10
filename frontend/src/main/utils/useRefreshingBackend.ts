import { type UseQueryOptions } from "@tanstack/react-query";
import type { AxiosRequestConfig } from "axios";
import { hasRole, useCurrentUser } from "main/utils/currentUser";
import { nextRefreshMs, timingFor, withBase } from "main/utils/refreshInterval";
import { useSystemInfo } from "main/utils/systemInfo";
import { useBackend } from "main/utils/useBackend";

/** What a query's state says about how many times it has been read, well or not. */
type ReadCount = {
  state: { dataUpdateCount: number; errorUpdateCount: number };
};

/**
 * The wait drawn for each query, and after which read it was drawn. react-query asks for the
 * interval again on every render of every page that uses the query, and starts the timer again
 * whenever the answer differs, so a fresh draw on every question would restart the wait at each
 * render and a page that renders more often than it waits (a heartbeat, a clock) would never
 * refresh. Each wait is drawn once per read (and again if the timing changes) instead (issue #426).
 */
const draws = new WeakMap<object, { after: string; wait: number }>();

/**
 * The options that make a query refresh itself in the background (issue #281), for a caller that
 * cannot use {@link useRefreshingBackend}. A function for `refetchInterval` is asked again after
 * every fetch, so each wait is a fresh random draw, not one drawn at page load; between two reads
 * it gives the same wait, however often it is asked.
 *
 * Nothing is fetched while the tab is hidden (react-query's default for the interval), and a tab
 * that is shown again, or whose window is focused, refetches at once. A window that can be seen
 * but does not have focus, such as the second of two windows side by side, keeps refreshing.
 *
 * `baseSeconds`, when given, replaces the mean wait of the role's timing and keeps its jitter, never
 * more than the new mean (issue #426: the Budget and Combined Allocation pages use 10 seconds).
 */
export function refreshOptions<T>(
  isAdmin: boolean,
  info: Parameters<typeof timingFor>[0],
  random: () => number = Math.random,
  baseSeconds?: number,
): Partial<UseQueryOptions<T>> {
  const roleTiming = timingFor(info, isAdmin);
  const timing =
    baseSeconds === undefined ? roleTiming : withBase(roleTiming, baseSeconds);
  return {
    refetchInterval: (query: ReadCount) => {
      // A new read, or new settings (the user and /api/systemInfo arrive after the first ask).
      const { dataUpdateCount, errorUpdateCount } = query.state;
      const after = [
        dataUpdateCount,
        errorUpdateCount,
        timing.base,
        timing.jitter,
      ].join("/");
      const drawn = draws.get(query);
      if (drawn?.after === after) {
        return drawn.wait;
      }
      const wait = nextRefreshMs(timing, random);
      draws.set(query, { after, wait });
      return wait;
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  };
}

/**
 * {@link useBackend} for the cheap queries that carry where a recruitment is in the process
 * (issue #281): the same arguments, plus a background refresh without a page reload. An admin (even
 * one who is also an instructor) refreshes about every 5 seconds, anyone else about every 15, each
 * wait drawn at random with jitter; see {@link refreshOptions} and the settings in
 * /api/systemInfo. Options given by the caller win over the refresh options. `baseSeconds` gives
 * another mean wait with the same jitter, as the Budget and Combined Allocation pages do (issue
 * #426).
 *
 * Use it only for light reads. The heavy tables (applications, rankings, assignments) and the
 * endpoints that compute counts are not refreshed this way.
 */
export function useRefreshingBackend<T>(
  queryKey: unknown[],
  axiosParameters: AxiosRequestConfig,
  initialData: T,
  suppressToasts = false,
  options: Partial<UseQueryOptions<T>> = {},
  baseSeconds?: number,
) {
  const currentUser = useCurrentUser();
  const { data: info } = useSystemInfo();
  return useBackend<T>(queryKey, axiosParameters, initialData, suppressToasts, {
    ...refreshOptions<T>(
      hasRole(currentUser, "ROLE_ADMIN"),
      info,
      Math.random,
      baseSeconds,
    ),
    ...options,
  });
}
