import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { yyyyqToQyy } from "main/utils/quarterUtilities";

/** What POST /api/admin/applications/legacy/upload reports back. */
export type LegacyImportResult = {
  inserted: number;
  alreadyPresent: number;
  skipped: number;
  /** One line per skipped row, saying which row and why. */
  problems: string[];
  /** Knowledge topics that were not on the TA topics list and were added to it by the import. */
  addedTopics: string[];
};

export const LEGACY_IMPORT_URL = "/api/admin/applications/legacy/upload";

/** Where the Help page documents the legacy export's shape. */
export const LEGACY_CSV_HELP_PATH = "/help/csv#legacy-ta-applications";

/** A quarter an import can go into: a TA recruitment, shown as the admin says it (W26). */
export type QuarterOption = { quarter: string; label: string };

/** The TA recruitments, most recent quarter first; legacy data is TA data, so ULA ones are out. */
export const taQuarterOptions = (
  recruitments: Recruitment[],
): QuarterOption[] =>
  recruitments
    .filter((r) => r.type === "TA")
    .sort((a, b) => b.quarter.localeCompare(a.quarter))
    .map((r) => ({ quarter: r.quarter, label: yyyyqToQyy(r.quarter) }));

const plural = (n: number, one: string, many: string): string =>
  `${n} ${n === 1 ? one : many}`;

/** The toast after an import, naming every skipped row so the admin can fix the file. */
export const importSummary = (result: LegacyImportResult): string => {
  let message = `Import complete: ${plural(result.inserted, "application", "applications")} added, ${result.alreadyPresent} already present, ${plural(result.skipped, "row", "rows")} skipped`;
  if (result.problems.length > 0) {
    message += ` (${result.problems.join("; ")})`;
  }
  return message;
};
