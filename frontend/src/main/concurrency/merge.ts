import type { OtherClient } from "./others";

/** What one heartbeat last said: who else is there, and this tab's place among them. */
export type Standing = {
  others: OtherClient[];
  newest: boolean;
  arrivedAt: number;
};

/**
 * One standing out of several, for a page that is one tab on several things at once (the Combined
 * Allocation page, issue #358, which heartbeats for each recruitment of the quarter). Nothing here
 * knows what the things are.
 *
 * - The others are everyone any of the things named, each person once: the server names a person
 *   once per thing, so someone with both things open (another copy of the same page) comes twice.
 * - The tab is the newest only if every thing says so. Of two tabs that share a thing, the one that
 *   came later is then the only one that can be asked, so no tab waits on another that waits on it.
 * - It arrived when it last arrived anywhere, so that arriving afresh on any thing, after being
 *   quiet for longer than the server waits, asks the question afresh.
 *
 * Only the standings of things the page is actually on belong here: a hook without a URL never
 * hears from the server, and its silence would otherwise count as "not the newest".
 */
export function mergeStandings(standings: Standing[]): Standing {
  const people = new Map<string, OtherClient>();
  standings.forEach((standing) =>
    standing.others.forEach((other) => {
      const key = `${other.samePerson}|${other.admin === true}|${other.label}`;
      if (!people.has(key)) {
        people.set(key, other);
      }
    }),
  );
  return {
    others: [...people.values()],
    newest: standings.every((standing) => standing.newest),
    arrivedAt: Math.max(0, ...standings.map((standing) => standing.arrivedAt)),
  };
}
