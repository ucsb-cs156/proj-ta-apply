import { useNavigate } from "react-router";
import { toast } from "react-toastify";
import type { DraftApplication } from "main/utils/draftApplications";
import { apiErrorMessage, shouldToastBackendError } from "main/utils/apiError";
import { useBackendMutation } from "main/utils/useBackend";

/** Turns a cancelled application back into a draft (issue #420). */
export const FROM_CANCELLED_URL = "/api/draftApplications/fromCancelled";

/**
 * A refusal's own words (applications closed, a draft already begun, and so on), toasted; a lost
 * session or an unreachable server is only logged, as everywhere else (issue #198).
 */
export function toastServerMessage(error: unknown): void {
  if (shouldToastBackendError(error)) {
    toast(apiErrorMessage(error));
  } else {
    // Stryker disable next-line StringLiteral : the wording of a log line
    console.error("Backend request failed", error);
  }
}

/**
 * "Create a new application" for a cancelled application (issue #420): the server turns it back
 * into a draft holding its answers, in one transaction that also deletes it, and the applicant is
 * taken to the draft. Mutate with the cancelled application's id.
 *
 * The lists of the applicant's applications and drafts are refreshed, so the home page shows the
 * draft and no longer the cancelled application. The cancelled application's own query is left
 * alone: refetching it would only find that it is gone.
 */
export function useCreateFromCancelled() {
  const navigate = useNavigate();
  return useBackendMutation<number, DraftApplication>(
    (applicationId) => ({
      url: FROM_CANCELLED_URL,
      method: "POST",
      params: { applicationId },
    }),
    {
      onSuccess: (draft) => navigate(`/apply/${draft.recruitmentId}`),
      onError: toastServerMessage,
    },
    // Stryker disable next-line all : cache invalidation is not observable from here
    ["/api/applications/mine", "/api/draftApplications/mine"],
  );
}
