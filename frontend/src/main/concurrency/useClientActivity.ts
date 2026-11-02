import { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  CLIENT_ID_HEADER,
  HEARTBEAT_SECONDS_HEADER,
  OTHER_CLIENTS_ACTIVE_HEADER,
  headerValue,
} from "./headers";

/** Until the server says otherwise: three heartbeats to the server's default minute. */
export const DEFAULT_HEARTBEAT_MS = 20_000;

type ClientActivityOptions = {
  /**
   * Where to POST a heartbeat to, or null until the thing being edited is open. The heartbeat sends
   * this client's identifier and changes nothing.
   */
  heartbeatUrl: string | null;
  /** The time between heartbeats until the server says how often it wants them. */
  defaultIntervalMs?: number;
};

/**
 * Lets the server tell this tab or window whether another one is working on the same thing
 * (issue #273). Nothing here knows what the thing is.
 *
 * The tab makes a random identifier for itself, `crypto.randomUUID()`, and keeps it in memory only,
 * so that a duplicated or restored tab does not inherit another's. The caller sends
 * {@link headers} with every request it makes about the thing, and hands each response's headers
 * to {@link observe}. A heartbeat is sent as soon as there is a URL, and then as often as the
 * server asks, so that a tab that is open and idle is seen too. If a response says that others are
 * active, {@link othersActive} is true; it is false again when a later response says they are gone.
 *
 * A heartbeat that fails is not worth bothering anyone about, and is tried again at the next time.
 */
export function useClientActivity({
  heartbeatUrl,
  defaultIntervalMs = DEFAULT_HEARTBEAT_MS,
}: ClientActivityOptions) {
  // Made once, with the headers that carry it, so neither ever changes during the life of the hook.
  const [{ clientId, headers }] = useState(() => {
    const id = crypto.randomUUID();
    return { clientId: id, headers: { [CLIENT_ID_HEADER]: id } };
  });
  const [othersActive, setOthersActive] = useState(false);
  const intervalMs = useRef(defaultIntervalMs);

  // Takes in what a response says about other clients and about the heartbeat. It uses only a
  // state setter and a ref, which never change, so one function serves for the life of the hook.
  const [observe] = useState(() => (responseHeaders: unknown) => {
    const others = headerValue(responseHeaders, OTHER_CLIENTS_ACTIVE_HEADER);
    if (others !== undefined) {
      setOthersActive(others === "true");
    }
    const seconds = Number(
      headerValue(responseHeaders, HEARTBEAT_SECONDS_HEADER),
    );
    if (Number.isFinite(seconds) && seconds > 0) {
      intervalMs.current = seconds * 1000;
    }
  });

  useEffect(() => {
    if (heartbeatUrl === null) {
      return;
    }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const beat = async () => {
      try {
        const response = await axios({
          method: "POST",
          url: heartbeatUrl,
          headers: { [CLIENT_ID_HEADER]: clientId },
        });
        if (!stopped) {
          observe(response.headers);
        }
      } catch {
        // Missed; the next one tries again.
      }
      if (!stopped) {
        timer = setTimeout(beat, intervalMs.current);
      }
    };
    void beat();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [heartbeatUrl, clientId, observe]);

  return {
    /** This tab's identifier. */
    clientId,
    /** Send these with every request about the thing. */
    headers,
    /** Give each response's headers to this. */
    observe,
    /** Another tab or window was working on the same thing when the server last answered. */
    othersActive,
  };
}
