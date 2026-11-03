import { type UseQueryOptions } from "@tanstack/react-query";
import type { AxiosRequestConfig } from "axios";
import { hasRole, useCurrentUser } from "main/utils/currentUser";
import { nextRefreshMs, timingFor } from "main/utils/refreshInterval";
import { useSystemInfo } from "main/utils/systemInfo";
import { useBackend } from "main/utils/useBackend";

/**
 * The options that make a query refresh itself in the background (issue #281), for a caller that
 * cannot use {@link useRefreshingBackend}. A function for `refetchInterval` is asked again after
 * every fetch, so each wait is a fresh random draw, not one drawn at page load.
 *
 * Nothing is fetched while the tab is hidden (react-query's default for the interval), and a tab
 * that is shown again, or whose window is focused, refetches at once.
 */
export function refreshOptions<T>(
  isAdmin: boolean,
  info: Parameters<typeof timingFor>[0],
  random: () => number = Math.random,
): Partial<UseQueryOptions<T>> {
  const timing = timingFor(info, isAdmin);
  return {
    refetchInterval: () => nextRefreshMs(timing, random),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  };
}

/**
 * {@link useBackend} for the cheap queries that carry where a recruitment is in the process
 * (issue #281): the same arguments, plus a background refresh without a page reload. An admin (even
 * one who is also an instructor) refreshes about every 5 seconds, anyone else about every 15, each
 * wait drawn at random with jitter; see {@link refreshOptions} and the settings in
 * /api/systemInfo. Options given by the caller win over the refresh options.
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
) {
  const currentUser = useCurrentUser();
  const { data: info } = useSystemInfo();
  return useBackend<T>(queryKey, axiosParameters, initialData, suppressToasts, {
    ...refreshOptions<T>(hasRole(currentUser, "ROLE_ADMIN"), info),
    ...options,
  });
}
