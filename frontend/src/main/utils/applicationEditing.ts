import { toast } from "react-toastify";
import { shouldToastBackendError } from "main/utils/apiError";
import { isConflict } from "main/utils/useDraftSaving";

/**
 * The applicant's page and the admin's edit page both edit a submitted application, so both tell
 * the server through the same two endpoints that they have it open, and learn who else does (issue
 * #302). The server allows the application's owner and any admin.
 */
export const applicationHeartbeatUrl = (
  id: string | number | undefined,
): string => `/api/applications/heartbeat?id=${id}`;

export const applicationLeaveUrl = (id: string | number | undefined): string =>
  `/api/applications/leave?id=${id}`;

/**
 * What a failed save does besides what the page shows for itself: a refused stale save (409
 * Conflict) is shown by the page, so it gets no toast of its own; any other failure is toasted as
 * usual, unless it is only a lost session or an unreachable server (issue #198), which is logged.
 */
export function toastUnlessConflict(error: unknown): void {
  if (isConflict(error)) {
    return;
  }
  if (shouldToastBackendError(error)) {
    toast(`${error}`);
  } else {
    // Stryker disable next-line StringLiteral : the wording of a log line
    console.error("Backend request failed", error);
  }
}
