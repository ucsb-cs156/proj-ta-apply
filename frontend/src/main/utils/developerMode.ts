import { useBackend } from "main/utils/useBackend";

/**
 * What GET /api/developerMode answers (issue #217): whether the Developer Mode switch exists on
 * this instance (the ENABLE_DEVELOPER_MODE environment flag) and whether it is switched on.
 */
export type DeveloperModeStatus = {
  available: boolean;
  on: boolean;
};

/** The query key every page shares, so a flip of the switch refreshes the footer badge too. */
export const DEVELOPER_MODE_KEY = "/api/developerMode";

export const DEVELOPER_MODE_OFF: DeveloperModeStatus = {
  available: false,
  on: false,
};

/**
 * The current state of the switch. Read without toasts, since the footer asks on every page,
 * signed in or not; until the answer arrives it counts as off.
 */
export function useDeveloperMode() {
  return useBackend<DeveloperModeStatus>(
    [DEVELOPER_MODE_KEY],
    { method: "GET", url: DEVELOPER_MODE_KEY },
    DEVELOPER_MODE_OFF,
    true,
  );
}
