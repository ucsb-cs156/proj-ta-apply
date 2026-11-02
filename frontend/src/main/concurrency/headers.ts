/**
 * The one HTTP header the multi-tab warning sends (issue #273). It matches the server's
 * `ConcurrencyHeaders`. Nothing comes back in headers: what the server has to say, including who
 * else is active, is the JSON body of the heartbeat's answer (see `others.ts`).
 */

/** Request: the random identifier this tab or window made for itself. */
export const CLIENT_ID_HEADER = "X-Client-Id";
