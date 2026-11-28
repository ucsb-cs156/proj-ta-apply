/**
 * Every date and time the app shows, and every "today" it works out, is in the app's time zone
 * (issue #293), whatever zone the browser is in. This is the one place that knows how; the rest of
 * the front end calls these rather than `toLocaleString`, `new Date()` and the like. The backend's
 * counterpart is `AppTime`.
 *
 * <p>The zone is Pacific, UC Santa Barbara's, unless the server says otherwise (issue #513): the
 * backend's `app.timeZone` property reaches the browser as `timeZone` in `/api/systemInfo`, and
 * `useSystemInfo` hands it to `setAppTimeZone` as soon as it arrives. Until then, and on an instance
 * that configures nothing, the zone is Pacific.
 *
 * <p>What the server sends comes in two kinds. A date-time column holds the app zone's wall-clock
 * time and is sent with no zone ("2026-11-01T19:30:00"); it is shown as it reads. An exact instant
 * (when a user was last online) is sent with a zone ("2026-11-02T03:30:00Z"); it is converted.
 */

/** The zone the app runs in unless the server names another: UC Santa Barbara's. */
export const PACIFIC_TIME_ZONE = "America/Los_Angeles";

type Parts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** A formatter that reads an instant on the wall clock of `timeZone`; throws on a bad zone. */
const formatterFor = (timeZone: string): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });

let zone = PACIFIC_TIME_ZONE;
let format = formatterFor(zone);

/** The zone every reading below is in: Pacific until the server names another (issue #513). */
export const appTimeZone = (): string => zone;

/**
 * Makes `timeZone` (an IANA id such as "America/Los_Angeles") the zone every reading below is in,
 * from then on; the server's answer in `/api/systemInfo`. Nothing, or a value that is not a zone
 * id, leaves the zone as it is: the app keeps working in the last good zone rather than failing.
 */
export const setAppTimeZone = (timeZone: string | null | undefined): void => {
  if (!timeZone || timeZone === zone) {
    return;
  }
  try {
    format = formatterFor(timeZone);
  } catch {
    return;
  }
  zone = timeZone;
};

/** The app-zone wall-clock reading of an instant. */
const pacificParts = (instant: Date): Parts => {
  const found: Record<string, number> = {};
  for (const part of format.formatToParts(instant)) {
    found[part.type] = Number(part.value);
  }
  return {
    year: found.year,
    month: found.month,
    day: found.day,
    hour: found.hour,
    minute: found.minute,
    second: found.second,
  };
};

const pad = (n: number): string => String(n).padStart(2, "0");

/**
 * A Date whose local year, month, day and time are the Pacific ones right now (or at `now`). The
 * date helpers elsewhere read a day off a Date with getFullYear, getMonth and getDate; given this,
 * they read Pacific's day instead of the browser's, which differs late in the evening for anyone
 * east of California. Use it for "today", never for an instant to compare or store.
 */
export const pacificWallClock = (now: Date = new Date()): Date => {
  const p = pacificParts(now);
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
};

/** Today in Pacific time as YYYY-MM-DD, comparable to the dates the API returns as strings. */
export const pacificTodayIso = (now: Date = new Date()): string => {
  const p = pacificParts(now);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
};

/** The Pacific wall clock at an instant as "YYYY-MM-DDTHH:mm", the form a datetime-local box takes. */
export const pacificNowLocalIso = (now: Date = new Date()): string => {
  const p = pacificParts(now);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
};

/** How many calendar days ahead the soft offer deadline box is set by default (issue #485). */
export const SOFT_OFFER_DEADLINE_DAYS = 5;

/**
 * The default soft offer deadline (issue #485): 5:00 pm Pacific, five calendar days after today's
 * Pacific date, as a datetime-local value.
 */
export const defaultSoftOfferDeadline = (now: Date = new Date()): string => {
  const p = pacificParts(now);
  // The Date constructor carries a day past the month's end into the next month.
  const day = new Date(p.year, p.month - 1, p.day + SOFT_OFFER_DEADLINE_DAYS);
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T17:00`;
};

/** Whether a datetime-local value is well formed and later than the Pacific clock now. */
export const isFutureWallClock = (
  value: string,
  now: Date = new Date(),
): boolean =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) &&
  value > pacificNowLocalIso(now);

/** A stamp that names its zone: "...Z" or "...-08:00". */
const HAS_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/;
const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;

/** The hour on a 12-hour clock: 0 and 12 are both 12. */
const hour12 = (hour: number): number => (hour % 12 === 0 ? 12 : hour % 12);

/** "AM" before noon, "PM" from noon on. */
const meridiem = (hour: number): string => (hour < 12 ? "AM" : "PM");

/** "11/1/2026, 7:30:00 PM": the form the tables show a date and time in. */
const render = (p: Parts): string =>
  `${p.month}/${p.day}/${p.year}, ${hour12(p.hour)}:${pad(p.minute)}:${pad(p.second)} ${meridiem(p.hour)}`;

/**
 * The Pacific wall-clock reading of a stamp from the API, of either kind (zone-less Pacific, or an
 * instant with a zone, which is converted). Null when the text is not a stamp at all.
 */
const parseStamp = (stamp: string): Parts | null => {
  if (HAS_ZONE.test(stamp)) {
    const instant = new Date(stamp);
    return Number.isNaN(instant.getTime()) ? null : pacificParts(instant);
  }
  const wall = WALL_CLOCK.exec(stamp);
  if (!wall) {
    return null;
  }
  return {
    year: Number(wall[1]),
    month: Number(wall[2]),
    day: Number(wall[3]),
    hour: Number(wall[4]),
    minute: Number(wall[5]),
    second: Number(wall[6] ?? 0),
  };
};

/**
 * A stamp from the API shown through `show`. Blank when there is none; a value that is not a stamp
 * at all comes back as it is.
 */
const formatStamp = (
  stamp: string | null | undefined,
  show: (p: Parts) => string,
): string => {
  if (!stamp) {
    return "";
  }
  const p = parseStamp(stamp);
  return p ? show(p) : stamp;
};

/**
 * A stamp from the API as Pacific date and time, like "11/1/2026, 7:30:00 PM". Blank when there is
 * none; a value that is not a stamp at all comes back as it is.
 */
export const formatPacificDateTime = (
  stamp: string | null | undefined,
): string => formatStamp(stamp, render);

/**
 * The Pacific date of a stamp from the API in the short form `mm/dd/yy`, like "11/21/26" (issue
 * #509: the first line under a stamped checkbox). Blank when there is none; a value that is not a
 * stamp at all comes back as it is.
 */
export const formatPacificShortDate = (
  stamp: string | null | undefined,
): string =>
  formatStamp(
    stamp,
    (p) => `${pad(p.month)}/${pad(p.day)}/${pad(p.year % 100)}`,
  );

/**
 * The Pacific time of day of a stamp from the API in the short form `h:mm AM/PM`, like "8:05 AM"
 * (issue #509: the second line under a stamped checkbox). Twelve-hour clock, no leading zero on the
 * hour, two-digit minutes, no seconds. Blank when there is none; a value that is not a stamp at all
 * comes back as it is.
 */
export const formatPacificShortTime = (
  stamp: string | null | undefined,
): string =>
  formatStamp(
    stamp,
    (p) => `${hour12(p.hour)}:${pad(p.minute)} ${meridiem(p.hour)}`,
  );

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026-01-20" as "January 20, 2026": a calendar date, which has no time zone to convert. */
export const formatLongDate = (iso: string): string => {
  const [year, month, day] = iso.split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
};
