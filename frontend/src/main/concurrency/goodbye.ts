import { CLIENT_ID_HEADER } from "./headers";

/** The cookie the server puts its CSRF token in, and the header it expects it back in. */
const XSRF_COOKIE = "XSRF-TOKEN";
const XSRF_HEADER = "X-XSRF-TOKEN";

/** The value of a cookie of this page, or undefined if it has none by that name. */
function readCookie(name: string): string | undefined {
  const prefix = `${name}=`;
  const found = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(prefix));
  return found === undefined
    ? undefined
    : decodeURIComponent(found.slice(prefix.length));
}

/**
 * Tells the server this tab is leaving (issue #284), so that the others stop being warned about it
 * at once. `keepalive` lets the request outlive the page, which is why this is `fetch` and not
 * axios, and why it is not `sendBeacon`, which could not carry the client's identifier or the
 * CSRF token as headers. It is sent with no wait for an answer, and a failure is of no interest:
 * the server forgets a tab that has gone quiet anyway.
 */
export function sendGoodbye(url: string, clientId: string): void {
  const headers: Record<string, string> = { [CLIENT_ID_HEADER]: clientId };
  const token = readCookie(XSRF_COOKIE);
  if (token !== undefined) {
    headers[XSRF_HEADER] = token;
  }
  fetch(url, {
    method: "POST",
    keepalive: true,
    credentials: "same-origin",
    headers,
  }).catch(() => {
    // Not delivered; the heartbeats stopping says the same, a little later.
  });
}
