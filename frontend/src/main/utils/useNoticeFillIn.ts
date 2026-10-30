import { useBackend } from "main/utils/useBackend";
import type { NoticeFillIn } from "main/utils/noticeFields";
import type { UcsbApiQuarter } from "main/utils/quarterCalendar";

/** The two fields of a recruitment the notice fill-in needs. */
export type FillInRecruitment = {
  quarter: string;
  primaryConsiderationDate?: string | null;
};

/**
 * What to fill a notice's fields with for a recruitment (issues #150 and #153): its quarter and
 * primary consideration date, and the quarter calendar's row for that quarter, fetched from
 * /api/quarters/one when the recruitment is known. A quarter not on file is a 404, answered
 * quietly, and leaves the calendar fields as written.
 */
export function useNoticeFillIn(
  recruitment: FillInRecruitment | null | undefined,
): NoticeFillIn | null {
  const yyyyq = recruitment?.quarter;
  const { data: calendar } = useBackend<UcsbApiQuarter | null>(
    ["/api/quarters/one", yyyyq],
    { method: "GET", url: "/api/quarters/one", params: { yyyyq } },
    null,
    true,
    // Stryker disable next-line all : the guard only avoids asking for a quarter nobody has named
    { enabled: Boolean(yyyyq) },
  );
  if (!recruitment) return null;
  return {
    quarter: recruitment.quarter,
    primaryConsiderationDate: recruitment.primaryConsiderationDate,
    calendar: calendar ?? null,
  };
}
