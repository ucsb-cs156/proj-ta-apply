import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";

/**
 * The same three phases the backend enforces, mirrored here so pages can show the right controls.
 * The backend remains the authority; this only decides what to render.
 */
export type Phase = "EDITABLE" | "COMMENTS_ONLY" | "VIEW_ONLY";

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
  // The deadline day itself still counts as open; it closes the day after.
  if (
    recruitment.primaryConsiderationDate &&
    today > recruitment.primaryConsiderationDate
  ) {
    return "COMMENTS_ONLY";
  }
  return "EDITABLE";
}
