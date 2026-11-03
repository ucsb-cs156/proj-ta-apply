/**
 * Every date and time the app shows, and every "today" it works out, is in Pacific time (issue
 * #293), whatever zone the browser is in. This is the one place that knows how; the rest of the
 * front end calls these rather than `toLocaleString`, `new Date()` and the like. The backend's
 * counterpart is `AppTime`.
 *
 * <p>What the server sends comes in two kinds. A date-time column holds Pacific wall-clock time and
 * is sent with no zone ("2026-11-01T19:30:00"); it is shown as it reads. An exact instant (when a
 * user was last online) is sent with a zone ("2026-11-02T03:30:00Z"); it is converted to Pacific.
 */

/** The app's time zone: UC Santa Barbara's. */
export const PACIFIC_TIME_ZONE = "America/Los_Angeles";

type Parts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: PACIFIC_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

/** The Pacific wall-clock reading of an instant. */
const pacificParts = (instant: Date): Parts => {
  const found: Record<string, number> = {};
  for (const part of FORMAT.formatToParts(instant)) {
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

/** A stamp that names its zone: "...Z" or "...-08:00". */
const HAS_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/;
const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;

/** "11/1/2026, 7:30:00 PM": the form the tables show a date and time in. */
const render = (p: Parts): string => {
  const hour12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  const suffix = p.hour < 12 ? "AM" : "PM";
  return `${p.month}/${p.day}/${p.year}, ${hour12}:${pad(p.minute)}:${pad(p.second)} ${suffix}`;
};

/**
 * A stamp from the API as Pacific date and time, like "11/1/2026, 7:30:00 PM". Blank when there is
 * none; a value that is not a stamp at all comes back as it is.
 */
export const formatPacificDateTime = (
  stamp: string | null | undefined,
): string => {
  if (!stamp) {
    return "";
  }
  if (HAS_ZONE.test(stamp)) {
    const instant = new Date(stamp);
    return Number.isNaN(instant.getTime())
      ? stamp
      : render(pacificParts(instant));
  }
  const wall = WALL_CLOCK.exec(stamp);
  if (!wall) {
    return stamp;
  }
  return render({
    year: Number(wall[1]),
    month: Number(wall[2]),
    day: Number(wall[3]),
    hour: Number(wall[4]),
    minute: Number(wall[5]),
    second: Number(wall[6] ?? 0),
  });
};

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
