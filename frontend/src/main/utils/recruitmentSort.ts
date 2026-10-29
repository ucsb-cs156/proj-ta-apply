import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";

/** The fields a card shows, in the order of the Sort by bar. */
export const SORT_KEYS = [
  { key: "quarter", label: "Quarter" },
  { key: "type", label: "Type" },
  { key: "applicationStatus", label: "Status" },
  { key: "tentativeOpeningDate", label: "Tentative Opening" },
  { key: "primaryConsiderationDate", label: "Primary Consideration" },
  { key: "actualOpeningDate", label: "Actually Opened" },
  { key: "actualClosingDate", label: "Actually Closed" },
] as const;

export type SortKey = (typeof SORT_KEYS)[number]["key"];

/** The four dates, shown in the body of each card. */
export const DATE_KEYS = SORT_KEYS.slice(3);

/**
 * The recruitments in the chosen order. A blank date reads as "", so it sorts before every real
 * date when ascending and after them when descending. Ties keep the backend's order: newest
 * quarter first, then TA before ULA.
 */
export function sortRecruitments(
  recruitments: Recruitment[],
  key: SortKey,
  descending: boolean,
): Recruitment[] {
  const text = (recruitment: Recruitment): string => recruitment[key] ?? "";
  return [...recruitments].sort((a, b) => {
    const byKey = text(a).localeCompare(text(b));
    if (byKey !== 0) {
      return descending ? -byKey : byKey;
    }
    return b.quarter.localeCompare(a.quarter) || a.type.localeCompare(b.type);
  });
}
