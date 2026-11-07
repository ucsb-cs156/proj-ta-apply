import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { CLIENT_ID_HEADER } from "./headers";
import { sendGoodbye } from "./goodbye";
import { readPresence, type OtherClient } from "./others";

/** Until the server says otherwise: the server's own default of one heartbeat every 5 seconds. */
export const DEFAULT_HEARTBEAT_MS = 5_000;

type ClientActivityOptions = {
  /**
   * Where to POST a heartbeat to, or null until the thing being edited is open. The heartbeat sends
   * this client's identifier and changes nothing.
   */
  heartbeatUrl: string | null;
  /**
   * Where to POST a goodbye to when this tab leaves: when the page is hidden for good (`pagehide`)
   * and when the hook goes away because the app moved to another page. Null sends none.
   */
  leaveUrl?: string | null;
  /** The time between heartbeats until the server says how often it wants them. */
  defaultIntervalMs?: number;
  /**
   * An identifier to use instead of making one: for a page that is one tab on several things at
   * once (the Combined Allocation page, issue #358, which is on every recruitment of a quarter), so
   * that a second hook heartbeats, says goodbye and signs the saves as the same tab as the first.
   * Read when the hook is first rendered, like the identifier it stands in for.
   */
  clientId?: string;
};

/** What the server last said about the other tabs, and about this tab's place among them. */
type Standing = { others: OtherClient[]; newest: boolean; arrivedAt: number };

const ALONE: Standing = { others: [], newest: false, arrivedAt: 0 };

/**
 * Lets the server tell this tab or window who else is working on the same thing (issues #273,
 * #284). Nothing here knows what the thing is.
 *
 * The tab makes a random identifier for itself, `crypto.randomUUID()`, and keeps it in memory only,
 * so that a duplicated or restored tab does not inherit another's. The caller sends {@link headers}
 * with every request it makes about the thing, which is how the server knows that tab is there. A
 * heartbeat is sent as soon as there is a URL, and then as often as the server asks, so that a tab
 * that is open and idle is seen too. The answer to each heartbeat lists the other people active on
 * the thing: {@link others}, empty when there is no one, and says whether this tab arrived after
 * all of them: {@link newest}. It is replaced by every answer, so the names go when the others
 * have.
 *
 * A tab that leaves says so (`leaveUrl`), on `pagehide`, which fires when the page is closed or
 * navigated away from, and when the hook goes away, which is how moving to another page of the app
 * looks. `fetch` with `keepalive` sends it, so that it outlives the page. Delivery is not
 * guaranteed (a crash, a killed mobile tab, a lost network), so the server also forgets a tab that
 * stops sending heartbeats. If the browser brings the page back from its back/forward cache
 * (`pageshow` with `persisted`), the tab announces itself again at once.
 *
 * Browsers slow the timers of hidden tabs, so a tab left in the background may heartbeat late. If
 * it is later than the server waits, the server forgets it, the others' warning goes for a while,
 * and when the tab beats again it arrives afresh, as the newest. That is acceptable: the warning
 * returns within a heartbeat, and the returning tab is the one that is asked to step aside.
 *
 * A heartbeat that fails is not worth bothering anyone about, and is tried again at the next time.
 * The caller must be allowed to use the thing, or the server will refuse the heartbeat.
 */
export function useClientActivity({
  heartbeatUrl,
  leaveUrl = null,
  defaultIntervalMs = DEFAULT_HEARTBEAT_MS,
  clientId: sharedClientId,
}: ClientActivityOptions) {
  // Made once, with the headers that carry it, so neither ever changes during the life of the hook.
  const [{ clientId, headers }] = useState(() => {
    const id = sharedClientId ?? crypto.randomUUID();
    return { clientId: id, headers: { [CLIENT_ID_HEADER]: id } };
  });
  const [standing, setStanding] = useState<Standing>(ALONE);
  const intervalMs = useRef(defaultIntervalMs);

  useEffect(() => {
    if (heartbeatUrl === null) {
      return;
    }
    let stopped = false;
    // The page has been hidden for good, or into the cache, and says nothing until it is back.
    let away = false;
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
          setStanding({
            others: presence.others,
            newest: presence.newest,
            arrivedAt: presence.arrivedAt,
          });
          intervalMs.current = presence.intervalMs ?? intervalMs.current;
        }
      } catch {
        // Missed; the next one tries again.
      }
      if (!stopped && !away) {
        timer = setTimeout(beat, intervalMs.current);
      }
    };
    const goodbye = () => {
      if (leaveUrl !== null) {
        sendGoodbye(leaveUrl, clientId);
      }
    };
    const onPageHide = () => {
      away = true;
      clearTimeout(timer);
      goodbye();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        away = false;
        void beat();
      }
    };
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    void beat();
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      // Moving to another page of the app fires no pagehide, so this is its goodbye.
      goodbye();
    };
  }, [heartbeatUrl, leaveUrl, clientId]);

  /** Says goodbye now, for a caller that is about to take the user away. */
  const leave = useCallback(() => {
    if (leaveUrl !== null) {
      sendGoodbye(leaveUrl, clientId);
    }
  }, [leaveUrl, clientId]);

  return {
    /** This tab's identifier. */
    clientId,
    /** Send these with every request about the thing. */
    headers,
    /** The other people the server last said were working on the same thing. */
    others: standing.others,
    /** The server last said this tab arrived after every other one. */
    newest: standing.newest,
    /** When the server counts this tab as having arrived (ms since the epoch); 0 if not yet known. */
    arrivedAt: standing.arrivedAt,
    leave,
  };
}
