import type { Application } from "main/components/Applications/ApplicationTable";
import type { StudentRecruitment } from "main/components/Recruitments/RecruitmentTable";
import { isRecentlyClosed, todayIso } from "main/utils/applicationAccess";
import { sortRecruitments } from "main/utils/recruitmentSort";

const DAY_MS = 24 * 60 * 60 * 1000;

const utcMidnight = (iso: string): number => {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
};

/** Whole days from today until an ISO date; negative once it has passed. */
export function daysUntil(iso: string, today: string = todayIso()): number {
  return Math.round((utcMidnight(iso) - utcMidnight(today)) / DAY_MS);
}

/** "12 days", "1 day", "today", or "any day now" once the tentative date has passed. */
export function opensInText(days: number): string {
  if (days < 0) return "any day now";
  if (days === 0) return "today";
  return days === 1 ? "1 day" : `${days} days`;
}

/** The student's application to one recruitment, if any. */
export const applicationFor = (
  applications: Application[],
  recruitmentId: number,
): Application | undefined =>
  applications.find((a) => a.recruitmentId === recruitmentId);

export type StudentRecruitments = {
  /** Not yet opened, soonest tentative opening first. */
  upcoming: StudentRecruitment[];
  /** Open, or closed within the last six months; newest quarter first. */
  current: StudentRecruitment[];
  /** Closed longer ago than that, and only those the student applied to; newest first. */
  past: StudentRecruitment[];
};

/**
 * Sorts every recruitment into the three parts of the student's home page (issue #107). An open
 * recruitment that has never been opened cannot exist (opening stamps the date), so the three are
 * disjoint; a past recruitment the student never applied to is left out altogether.
 */
export function classifyRecruitments(
  recruitments: StudentRecruitment[],
  applications: Application[],
  today: string = todayIso(),
): StudentRecruitments {
  const list = Array.isArray(recruitments) ? recruitments : [];
  const applicationList = Array.isArray(applications) ? applications : [];

  const upcoming = list.filter(
    (r) => r.applicationStatus !== "OPEN" && r.actualOpeningDate === null,
  );
  const current = list.filter(
    (r) => r.applicationStatus === "OPEN" || isRecentlyClosed(r, today),
  );
  const past = list.filter(
    (r) =>
      !upcoming.includes(r) &&
      !current.includes(r) &&
      applicationFor(applicationList, r.id) !== undefined,
  );
  return {
    upcoming: sortRecruitments(upcoming, "tentativeOpeningDate", false),
    current: sortRecruitments(current, "quarter", true),
    past: sortRecruitments(past, "quarter", true),
  };
}
