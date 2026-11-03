import { formatPacificDateTime } from "main/utils/pacificTime";

/**
 * What the Recruitment Courses page says about how fresh the list is (issue #124): the time of the
 * last successful Populate in Pacific time, or that there has not been one.
 */
export function lastRefreshedText(
  lastPopulatedAt: string | null | undefined,
): string {
  return lastPopulatedAt
    ? `Last refreshed from the UCSB schedule: ${formatPacificDateTime(lastPopulatedAt)}.`
    : "Not yet refreshed from the UCSB schedule.";
}
