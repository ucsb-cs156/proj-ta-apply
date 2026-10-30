import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";

/**
 * What an applicant may do with an application, mirrored from the backend so pages can show the
 * right controls. The backend remains the authority; this only decides what to render.
 *
 * <p>EDITABLE: open, and the primary consideration date has not passed. LATE: open, but past that
 * date; the whole application may still be edited (issue #98), and the post-application comments
 * box is offered too, as the place for what has changed since applying. VIEW_ONLY: closed, so
 * nothing may change.
 */
export type Phase = "EDITABLE" | "LATE" | "VIEW_ONLY";

/** Today as YYYY-MM-DD in local time, comparable to the dates the API returns as strings. */
export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function phaseOf(
  recruitment: Recruitment | undefined | null,
  today: string = todayIso(),
): Phase {
  // Without a recruitment there is nothing to justify showing an edit control.
  if (!recruitment) return "VIEW_ONLY";
  if (recruitment.applicationStatus !== "OPEN") return "VIEW_ONLY";
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
export const isEditable = (phase: Phase): boolean => phase !== "VIEW_ONLY";

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
