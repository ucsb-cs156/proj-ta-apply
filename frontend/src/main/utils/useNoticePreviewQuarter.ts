import { useState } from "react";
import {
  defaultPreviewQuarter,
  fillNoticeFields,
} from "main/utils/noticeFields";
import type { UcsbApiQuarter } from "main/utils/quarterCalendar";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import { useBackend } from "main/utils/useBackend";

/** What a versioned notice's preview is filled in for, and the box that chooses it. */
export type NoticePreviewQuarter = {
  /** The chosen quarter, YYYYQ. */
  previewQuarter: string;
  setPreviewQuarter: (quarter: string) => void;
  /** The quarters on file, plus the chosen one if it is not among them, so the box always shows it. */
  quarterOptions: string[];
  /** The chosen quarter's calendar row, or null when it is not on file. */
  calendar: UcsbApiQuarter | null;
  /** The recruitment of this type for the chosen quarter, if any. */
  recruitment: Recruitment | undefined;
  /** The chosen quarter as QYY, for the notes beside the box. */
  previewQyy: string;
  /** The text with its fields filled in for the chosen quarter. */
  fill: (text: string) => string;
};

/**
 * Issue #192: the preview of a versioned notice is filled in for a chosen quarter, by default the
 * one after today's, from the quarter calendar on file and that quarter's recruitment of the given
 * type, if any. Shared by the Notices, Terms and Conditions cards and the Soft Offer Notices card
 * (issue #484).
 */
export function useNoticePreviewQuarter(
  type: "TA" | "ULA",
): NoticePreviewQuarter {
  const { data: calendarRows } = useBackend<UcsbApiQuarter[]>(
    // Stryker disable next-line all : the query key is only observable through invalidation
    ["/api/admin/quarters/all", "desc"],
    {
      // Stryker disable next-line all : GET is axios's default method
      method: "GET",
      url: "/api/admin/quarters/all",
      params: { direction: "desc" },
    },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );
  const { data: recruitments } = useBackend<Recruitment[]>(
    // Stryker disable next-line all : the query key is only observable through invalidation
    ["/api/admin/recruitments/all"],
    // Stryker disable next-line all : GET is axios's default method
    { method: "GET", url: "/api/admin/recruitments/all" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );
  const [previewQuarter, setPreviewQuarter] = useState(() =>
    defaultPreviewQuarter(),
  );
  // Stryker disable next-line all : the query's initial data is an empty list, never undefined
  const calendars = calendarRows ?? [];
  const quarterOptions = calendars.some((row) => row.quarter === previewQuarter)
    ? calendars.map((row) => row.quarter)
    : [previewQuarter, ...calendars.map((row) => row.quarter)];
  const calendar =
    calendars.find((row) => row.quarter === previewQuarter) ?? null;
  // Stryker disable next-line all : the query's initial data is an empty list, never undefined
  const recruitment = (recruitments ?? []).find(
    (r) => r.quarter === previewQuarter && r.type === type,
  );
  const fill = (text: string) =>
    fillNoticeFields(text, {
      quarter: previewQuarter,
      primaryConsiderationDate: recruitment?.primaryConsiderationDate,
      calendar,
    });
  return {
    previewQuarter,
    setPreviewQuarter,
    quarterOptions,
    calendar,
    recruitment,
    previewQyy: yyyyqToQyy(previewQuarter),
    fill,
  };
}
