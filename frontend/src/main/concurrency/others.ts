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
 * - only the user's own other tabs: "You are also editing this page in another tab or window."
 * - one other person: "A (Name) is also editing this page."
 * - others and the user: "You and A (Name) are also editing this page in other windows or tabs."
 * - two or three people are joined with commas and "and"; more than three people are named three,
 *   then counted: "A, B, C and 2 others".
 *
 * The labels are put in as they are. They are text, never markup; whatever shows this sentence must
 * show it as text.
 */
export function describeOthers(others: OtherClient[], noun: string): string {
  const you = others.some((other) => other.samePerson);
  const people = others
    .filter((other) => !other.samePerson)
    .map((other) => other.label);

  if (people.length === 0) {
    return you
      ? `You are also editing this ${noun} in another tab or window.`
      : "";
  }

  const named = people.slice(0, MAX_NAMED);
  const leftOver = people.length - named.length;
  const names = you ? ["You", ...named] : named;
  // Anyone left over means three were named, so this already covers them.
  const many = names.length > 1;
  const where = you ? " in other windows or tabs" : "";
  return `${joinNames(names, leftOver)} ${many ? "are" : "is"} also editing this ${noun}${where}.`;
}

/** What the heartbeat's answer said, read defensively: anything unexpected is left out. */
export type Presence = {
  others: OtherClient[];
  /** How long to wait before the next heartbeat, if the answer said. */
  intervalMs?: number;
};

/** Reads the JSON body of a heartbeat's answer. */
export function readPresence(data: unknown): Presence {
  const body = (data ?? {}) as { others?: unknown; heartbeatSeconds?: unknown };
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
  return { others, intervalMs };
}
