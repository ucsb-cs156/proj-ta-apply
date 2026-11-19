import { formatPacificDateTime } from "main/utils/pacificTime";

/**
 * What the Recruitment Courses page says, in small type just above the table, about how fresh the
 * course data is (issues #124 and #465): when it was last updated from the UCSB Courses API, in
 * Pacific time, or that it has not been yet.
 */
export function courseDataLastUpdatedText(
  courseDataLastUpdated: string | null | undefined,
): string {
  return courseDataLastUpdated
    ? `Course data last updated from the UCSB API: ${formatPacificDateTime(courseDataLastUpdated)}.`
    : "Course data not yet updated from the UCSB API.";
}

/** Said after the time: the nightly refresh keeps it current without anyone clicking Refresh. */
export const NIGHTLY_REFRESH_NOTE =
  "Updated automatically every night at midnight.";

/** The toast once Refresh has started the job. */
export const REFRESH_STARTED_MESSAGE =
  "Refresh started. Watch its progress on the Developer > Jobs page; the time above the table changes when it finishes.";
