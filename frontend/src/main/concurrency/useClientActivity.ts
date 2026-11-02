import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { CLIENT_ID_HEADER } from "./headers";
import { readPresence, type OtherClient } from "./others";

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
 * Lets the server tell this tab or window who else is working on the same thing (issue #273).
 * Nothing here knows what the thing is.
 *
 * The tab makes a random identifier for itself, `crypto.randomUUID()`, and keeps it in memory only,
 * so that a duplicated or restored tab does not inherit another's. The caller sends {@link headers}
 * with every request it makes about the thing, which is how the server knows that tab is there. A
 * heartbeat is sent as soon as there is a URL, and then as often as the server asks, so that a tab
 * that is open and idle is seen too. The answer to each heartbeat lists the other people active on
 * the thing: {@link others}, empty when there is no one. It is replaced by every answer, so the
 * names go when the others have.
 *
 * A heartbeat that fails is not worth bothering anyone about, and is tried again at the next time.
 * The caller must be allowed to use the thing, or the server will refuse the heartbeat.
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
  const [others, setOthers] = useState<OtherClient[]>([]);
  const intervalMs = useRef(defaultIntervalMs);

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
          const presence = readPresence(response.data);
          setOthers(presence.others);
          intervalMs.current = presence.intervalMs ?? intervalMs.current;
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
  }, [heartbeatUrl, clientId]);

  return {
    /** This tab's identifier. */
    clientId,
    /** Send these with every request about the thing. */
    headers,
    /** The other people the server last said were working on the same thing. */
    others,
  };
}
