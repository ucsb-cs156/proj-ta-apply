/**
 * Who else is active on the same thing, and how to say so (issue #273). Pure functions: nothing
 * here knows what the thing is, or reads anything but its arguments.
 */

/** One other person active on the same thing, as the server's heartbeat answer lists them. */
export type OtherClient = {
  /** What to call them: for the people of this app, "email (Full Name)", or just the email. */
  label: string;
  /** They are the same person as the one asking: another tab or window of their own. */
  samePerson: boolean;
};

/** The sentence that follows the names, whoever they are. */
export const RISK_SENTENCE =
  "Please know that this is risky; we recommend closing all but one of these.";

/**
 * The sentence that follows the names whenever another person is involved, and on admin pages
 * (issue #298). The viewer cannot make another person's window close, so it advises rather than
 * asks.
 */
export const ADMIN_SENTENCE =
  "We recommend that only one admin edits this page at a time.";

/**
 * Which page the warning is on: "default" for an application or a faculty member's ranking, "admin"
 * for the admin pages (issue #298). It matters only when every other copy is the user's own: the
 * default pages then ask the user to close the extra copies, and the admin pages give the admin
 * sentence.
 */
export type Audience = "default" | "admin";

/**
 * The closing sentence. The risk sentence asks the user to close the extra copies, so it is used
 * only when every other copy is the user's own, on a default page. Otherwise (another person is
 * involved, or it is an admin page) it is the admin sentence.
 */
export function closingSentence(
  others: OtherClient[],
  audience?: Audience,
): string {
  const onlyYou = others.every((other) => other.samePerson);
  return audience === "admin" || !onlyYou ? ADMIN_SENTENCE : RISK_SENTENCE;
}

/** The most other people who are named; any more are counted. */
export const MAX_NAMED = 3;

/** "A", "A and B", "A, B and C", and with some left over, "A, B, C and 2 others". */
function joinNames(names: string[], leftOver: number): string {
  if (leftOver > 0) {
    const others = leftOver === 1 ? "1 other" : `${leftOver} others`;
    return `${names.join(", ")} and ${others}`;
  }
  if (names.length === 1) {
    return names[0];
  }
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * The sentence that says who else is editing the `noun` ("page", "application", "budget"), or the
 * empty string if no one is.
 *
 * For the tab that was already open (`already` false):
 * - only the user's own other tabs: "You are also editing this page in another tab or window."
 * - one other person: "A (Name) is also editing this page."
 * - others and the user: "You and A (Name) are also editing this page in other windows or tabs."
 *
 * For the tab that arrived later (`already` true), who is "already" there:
 * - "You already have this page open for editing in another tab or window."
 * - "A (Name) already has this page open for editing." (singular verb)
 * - "You and A (Name) already have this page open for editing in other windows or tabs."
 *
 * Two or three people are joined with commas and "and"; more than three people are named three,
 * then counted: "A, B, C and 2 others".
 *
 * The labels are put in as they are. They are text, never markup; whatever shows this sentence must
 * show it as text.
 */
export function describeOthers(
  others: OtherClient[],
  noun: string,
  already = false,
): string {
  const you = others.some((other) => other.samePerson);
  const people = others
    .filter((other) => !other.samePerson)
    .map((other) => other.label);

  if (people.length === 0) {
    if (!you) {
      return "";
    }
    return already
      ? `You already have this ${noun} open for editing in another tab or window.`
      : `You are also editing this ${noun} in another tab or window.`;
  }

  const named = people.slice(0, MAX_NAMED);
  const leftOver = people.length - named.length;
  const names = you ? ["You", ...named] : named;
  // Anyone left over means three were named, so this already covers them.
  const many = names.length > 1;
  const where = you ? " in other windows or tabs" : "";
  const who = joinNames(names, leftOver);
  return already
    ? `${who} already ${many ? "have" : "has"} this ${noun} open for editing${where}.`
    : `${who} ${many ? "are" : "is"} also editing this ${noun}${where}.`;
}

/**
 * The whole warning: who, then the audience's closing sentence; the empty string if no one else is
 * there. `already` is true for the tab that arrived later.
 */
export function warningMessage(
  others: OtherClient[],
  noun: string,
  audience?: Audience,
  already = false,
): string {
  const who = describeOthers(others, noun, already);
  return who === "" ? "" : `${who} ${closingSentence(others, audience)}`;
}

/** What the heartbeat's answer said, read defensively: anything unexpected is left out. */
export type Presence = {
  others: OtherClient[];
  /** How long to wait before the next heartbeat, if the answer said. */
  intervalMs?: number;
  /** This tab arrived after every other one, so it is the one asked to step aside (issue #284). */
  newest: boolean;
  /**
   * When this tab arrived, in milliseconds since the epoch, as the server counts it; 0 if unknown.
   * It changes when the tab arrives afresh, such as after being quiet for longer than the server
   * waits.
   */
  arrivedAt: number;
};

/** Reads the JSON body of a heartbeat's answer. */
export function readPresence(data: unknown): Presence {
  const body = (data ?? {}) as {
    others?: unknown;
    heartbeatSeconds?: unknown;
    newest?: unknown;
    arrivedAtMillis?: unknown;
  };
  const others = Array.isArray(body.others)
    ? body.others.filter(
        (other): other is OtherClient =>
          typeof other?.label === "string" &&
          other.label !== "" &&
          typeof other.samePerson === "boolean",
      )
    : [];
  // Number.isFinite is false for anything that is not a number, a string such as "20" included.
  const seconds = body.heartbeatSeconds as number;
  const intervalMs =
    Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined;
  const arrivedAtMillis = body.arrivedAtMillis as number;
  return {
    others,
    intervalMs,
    newest: body.newest === true,
    arrivedAt: Number.isFinite(arrivedAtMillis) ? arrivedAtMillis : 0,
  };
}
