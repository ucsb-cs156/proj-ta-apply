import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";

/**
 * What an applicant may do with an application, mirrored from the backend so pages can show the
 * right controls. The backend remains the authority; this only decides what to render.
 *
 * <p>EDITABLE: open, and the primary consideration date has not passed. LATE: open, but past that
 * date; the whole application may still be edited (issue #98), and the post-application comments
 * box is offered too, as the place for what has changed since applying. COMMENTS_ONLY: closed
 * within the last six months (issue #107); only the comments may change. VIEW_ONLY: closed longer
 * ago than that, so nothing may change.
 */
export type Phase = "EDITABLE" | "LATE" | "COMMENTS_ONLY" | "VIEW_ONLY";

/** How long after closing a recruitment still counts as recent; the backend uses the same. */
export const RECENT_MONTHS = 6;

/** Today as YYYY-MM-DD in local time, comparable to the dates the API returns as strings. */
export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * An ISO date plus some calendar months, as the backend's LocalDate.plusMonths works: a day past
 * the end of the shorter month lands on its last day (2026-08-31 plus one month is 2026-09-30).
 */
export function addMonthsIso(iso: string, months: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const total = year * 12 + (month - 1) + months;
  const newYear = Math.floor(total / 12);
  const newMonth = total - newYear * 12;
  const lastDay = new Date(newYear, newMonth + 1, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${newYear}-${pad(newMonth + 1)}-${pad(Math.min(day, lastDay))}`;
}

/**
 * Whether a recruitment closed within the last six months, counting the day six months on as
 * still recent. An open recruitment, or one with no recorded closing date, is not recently closed.
 */
export function isRecentlyClosed(
  recruitment: Recruitment | undefined | null,
  today: string = todayIso(),
): boolean {
  if (
    !recruitment ||
    recruitment.applicationStatus === "OPEN" ||
    !recruitment.actualClosingDate
  ) {
    return false;
  }
  return today <= addMonthsIso(recruitment.actualClosingDate, RECENT_MONTHS);
}

export function phaseOf(
  recruitment: Recruitment | undefined | null,
  today: string = todayIso(),
): Phase {
  // Without a recruitment there is nothing to justify showing an edit control.
  if (!recruitment) return "VIEW_ONLY";
  if (recruitment.applicationStatus !== "OPEN") {
    return isRecentlyClosed(recruitment, today) ? "COMMENTS_ONLY" : "VIEW_ONLY";
  }
  // The deadline day itself still counts as before the deadline; LATE starts the day after.
  if (
    recruitment.primaryConsiderationDate &&
    today > recruitment.primaryConsiderationDate
  ) {
    return "LATE";
  }
  return "EDITABLE";
}

/** Whether the whole application may still be edited, which is so in both of the open phases. */
export const isEditable = (phase: Phase): boolean =>
  phase === "EDITABLE" || phase === "LATE";

/**
 * Why editing is no longer offered, for the tooltip on the disabled Edit button. The backend
 * records only the date applications closed, not the time.
 */
export function closedExplanation(
  recruitment: Recruitment | undefined | null,
): string {
  const closedOn = recruitment?.actualClosingDate;
  return closedOn
    ? `Applications were closed on ${closedOn}.`
    : "Applications are closed.";
}
