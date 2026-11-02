import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "react-toastify";
import type { ApplicationPayload } from "main/utils/applicationFields";
import type { DraftApplication } from "main/utils/draftApplications";
import { apiErrorMessage, shouldToastBackendError } from "main/utils/apiError";
import { useBackend } from "main/utils/useBackend";
import { useClientActivity } from "main/concurrency";

const OPEN_URL = "/api/draftApplications/open";
const HEARTBEAT_URL = "/api/draftApplications/heartbeat";

/** Whether a failed request was the server refusing a stale save (409 Conflict). */
export const isConflict = (error: unknown): boolean =>
  (error as { response?: { status?: number } } | null)?.response?.status ===
  409;

/** What the saves share between renders; never read while rendering. */
type SaveState = {
  /** The draft the saves are for: what the server last gave when it was opened or reloaded. */
  draft: DraftApplication | null;
  /** The version the next save carries: the draft's own, then each save's answer. */
  version: number | null;
  /** The draft a refused save found out of date; nothing more is saved to it. */
  blocked: DraftApplication | null;
  /** Set once the application is submitted and the server has removed the draft. */
  stopped: boolean;
  /** The saves in order, so each carries the version the one before it came back with. */
  queue: Promise<unknown>;
};

type DraftSavingOptions = {
  recruitmentId: string | undefined;
  /** Whether the draft may be asked for yet. */
  enabled: boolean;
  /** Called once Save Draft has saved, to take the applicant home. */
  onSavedAndLeft: () => void;
};

/**
 * Opening a draft and saving to it as the application form is filled in (issue #270), including
 * the case where the draft was changed somewhere else in the meantime.
 *
 * Opening asks the server for the applicant's draft for the recruitment, which makes an empty one
 * if there is none. Every save carries the version the draft had when it was last seen, and the
 * server counts a new version for each save it accepts; a save made from an older version (the
 * draft was saved from another tab or window since) is refused with 409 Conflict. When that happens
 * nothing more is saved from this page, {@link conflicted} is true so the page can say so, and
 * {@link reload} fetches the draft as it now stands so the form can start again from it.
 *
 * The page also learns early, before any save is refused, whether the draft is open in another tab
 * or window (issue #273), and who has it open: see {@link useClientActivity}, which this uses for
 * it. Every save names this tab, and a heartbeat does too, so the server knows it is there.
 */
export function useDraftSaving({
  recruitmentId,
  enabled,
  onSavedAndLeft,
}: DraftSavingOptions) {
  const queryClient = useQueryClient();
  // Stryker disable next-line all : the one key is used throughout, so any value works
  const openKey = [OPEN_URL, recruitmentId];

  // Asked for with a POST because it may create the draft; asking again changes nothing, so the
  // usual refetching is harmless but pointless. Forgotten as soon as the page goes, so a later
  // visit starts from what was saved since rather than from this visit's first look.
  const { data: draft, isError: failed } = useBackend<DraftApplication | null>(
    openKey,
    { method: "POST", url: OPEN_URL, params: { recruitmentId } },
    null,
    false,
    {
      // Stryker disable next-line all : the guard only avoids a request that would be refused
      enabled,
      refetchOnWindowFocus: false,
      gcTime: 0,
      // A refusal (applications closed) will not change by asking again.
      retry: false,
    },
  );

  // Tells the server this tab is working on the draft, and learns whether another one is.
  const activity = useClientActivity({
    heartbeatUrl: draft ? `${HEARTBEAT_URL}?id=${draft.id}` : null,
  });

  const saves = useRef<SaveState>({
    draft: null,
    version: null,
    blocked: null,
    stopped: false,
    queue: Promise.resolve(),
  });
  const [conflictFor, setConflictFor] = useState<DraftApplication | null>(null);

  // A draft just fetched, the first time or on reload, starts the version count again.
  useEffect(() => {
    saves.current.draft = draft ?? null;
    saves.current.version = draft?.version ?? null;
  }, [draft]);

  /** Sends one save, after the ones before it; says whether the server took it. */
  const save = (payload: ApplicationPayload): Promise<boolean> => {
    const state = saves.current;
    const run = async (): Promise<boolean> => {
      const target = state.draft;
      // Stryker disable next-line ConditionalExpression : the form, the only caller, exists only once there is a draft
      if (target === null || state.stopped || state.blocked === target) {
        return false;
      }
      try {
        const response = await axios({
          method: "PUT",
          url: "/api/draftApplications",
          params: { id: target.id, version: state.version },
          headers: activity.headers,
          data: payload,
        });
        state.version = response.data.version;
        // Stryker disable all : cache invalidation is not observable from here
        queryClient.invalidateQueries({
          queryKey: ["/api/draftApplications/mine"],
        });
        // Stryker restore all
        return true;
      } catch (error) {
        if (isConflict(error)) {
          state.blocked = target;
          setConflictFor(target);
        } else if (shouldToastBackendError(error)) {
          // The applicant may be counting on the save, but it must not get in the way of typing.
          toast(`Your draft could not be saved: ${apiErrorMessage(error)}`);
        } else {
          console.error("Backend request failed", error);
        }
        return false;
      }
    };
    const result = state.queue.then(run);
    state.queue = result;
    return result;
  };

  return {
    /** The draft, once it has been opened; null before, and if it could not be. */
    draft,
    /** The draft could not be opened, most likely because applications are closed. */
    failed,
    /** The draft has been saved from somewhere else, so nothing more is saved from here. */
    conflicted: conflictFor !== null && conflictFor === draft,
    /** The other people with the draft open too (the user's own other tabs included), as the server last said. */
    others: activity.others,
    /** The quiet save while the form is filled in. */
    autosave: (payload: ApplicationPayload) => {
      void save(payload);
    },
    /** Save Draft: saves, then takes the applicant home, unless the save was refused. */
    saveAndLeave: async (payload: ApplicationPayload) => {
      if (await save(payload)) {
        onSavedAndLeft();
      }
    },
    /** Fetches the draft as it now stands; the form should start again from what comes back. */
    reload: async () => {
      // Also looks again for an application: the draft is gone if it was submitted elsewhere.
      queryClient.invalidateQueries({ queryKey: ["/api/applications/mine"] });
      await queryClient.refetchQueries({ queryKey: openKey });
    },
    /** The application was submitted: the draft is gone, so save nothing more to it. */
    stop: () => {
      saves.current.stopped = true;
    },
  };
}
