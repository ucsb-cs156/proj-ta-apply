import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { yyyyqToQyy } from "main/utils/quarterUtilities";

export type ImportType = "TA" | "ULA";

/** What the two import endpoints report back. */
export type LegacyImportResult = {
  inserted: number;
  alreadyPresent: number;
  skipped: number;
  /** One line per skipped row, saying which row and why. */
  problems: string[];
  /** Topics that were not on the form type's topics list and were added to it by the import. */
  addedTopics: string[];
  /** ULA only: activities that were not on the ULA interests list and were added to it. */
  addedInterests?: string[];
};

/** The legacy PHP TA application's export goes to one endpoint, the ULA form's responses to another. */
export const LEGACY_IMPORT_URL = "/api/admin/applications/legacy/upload";
export const LEGACY_ULA_IMPORT_URL =
  "/api/admin/applications/legacy-ula/upload";

export const importUrl = (type: ImportType): string =>
  type === "ULA" ? LEGACY_ULA_IMPORT_URL : LEGACY_IMPORT_URL;

/** Where the Help page documents each export's shape. */
export const LEGACY_CSV_HELP_PATH = "/help/csv#legacy-ta-applications";
export const LEGACY_ULA_CSV_HELP_PATH = "/help/csv#legacy-ula-applications";

export const helpPath = (type: ImportType): string =>
  type === "ULA" ? LEGACY_ULA_CSV_HELP_PATH : LEGACY_CSV_HELP_PATH;

/** The lists an import may add to, whose cached copies the page refetches afterwards. */
export const listsToRefresh = (type: ImportType): string[] =>
  type === "ULA"
    ? [
        "/api/admin/settings/ula-topics/all",
        "/api/admin/settings/ula-interests/all",
      ]
    : ["/api/admin/settings/ta-topics/all"];

/** A quarter an import can go into: a recruitment of the form's type, shown as the admin says it. */
export type QuarterOption = { quarter: string; label: string };

/** The recruitments of one type, most recent quarter first. */
export const quarterOptions = (
  recruitments: Recruitment[],
  type: ImportType,
): QuarterOption[] =>
  recruitments
    .filter((r) => r.type === type)
    .sort((a, b) => b.quarter.localeCompare(a.quarter))
    .map((r) => ({ quarter: r.quarter, label: yyyyqToQyy(r.quarter) }));

/** The TA recruitments, most recent quarter first; legacy data is TA data, so ULA ones are out. */
export const taQuarterOptions = (
  recruitments: Recruitment[],
): QuarterOption[] => quarterOptions(recruitments, "TA");

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
