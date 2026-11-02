/**
 * The HTTP headers the multi-tab warning speaks (issue #273). They match the server's
 * `ConcurrencyHeaders`.
 */

/** Request: the random identifier this tab or window made for itself. */
export const CLIENT_ID_HEADER = "X-Client-Id";

/** Response: "true" if some other client was seen on the same thing recently. */
export const OTHER_CLIENTS_ACTIVE_HEADER = "X-Other-Clients-Active";

/** Response: how often, in seconds, to send a heartbeat. */
export const HEARTBEAT_SECONDS_HEADER = "X-Heartbeat-Seconds";

/**
 * The value of a response header, whatever the case it came in, or undefined. Takes the headers
 * object from an axios response, or any plain object of strings.
 */
export function headerValue(
  headers: unknown,
  name: string,
): string | undefined {
  if (headers === null || typeof headers !== "object") {
    return undefined;
  }
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted && value != null) {
      return String(value);
    }
  }
  return undefined;
}
