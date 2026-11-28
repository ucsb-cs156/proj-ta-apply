// Funding Sources (issue #512, part 1): the admin-maintained list of abbreviations the financial
// office staff put on ULA hiring records, each with an explanation. These are the constants of the
// Admin → Funding Sources pages; the Funding dropdown on Soft Offer Results is part 2.

export type FundingSource = {
  abbreviation: string;
  explanation: string;
};

export const FUNDING_SOURCES_LABEL = "Funding Sources";

export const FUNDING_SOURCES_ALL_URL = "/api/admin/fundingSources/all";
export const FUNDING_SOURCES_POST_URL = "/api/admin/fundingSources/post";
export const FUNDING_SOURCES_PUT_URL = "/api/admin/fundingSources/put";
export const FUNDING_SOURCES_DELETE_URL = "/api/admin/fundingSources/delete";

export const FUNDING_SOURCES_PATH = "/admin/fundingSources";
export const FUNDING_SOURCES_CREATE_PATH = "/admin/fundingSources/create";
/** The route pattern; {@link fundingSourceEditPath} fills in one abbreviation. */
export const FUNDING_SOURCES_EDIT_PATH =
  "/admin/fundingSources/edit/:abbreviation";

/** The longest abbreviation the column holds; the backend's ABBREVIATION_MAX is the same. */
export const ABBREVIATION_MAX = 10;

/** Shown under the heading on the Funding Sources page. */
export const FUNDING_SOURCES_NOTE =
  "The abbreviation is what the Funding dropdown on Soft Offer Results and its CSV show; the explanation says what it means. An abbreviation cannot be changed once created: to change one, delete it and create another.";

/** The edit page for one source; the abbreviation is URL-encoded, since it is typed by hand. */
export const fundingSourceEditPath = (abbreviation: string): string =>
  `/admin/fundingSources/edit/${encodeURIComponent(abbreviation)}`;

/** The toast after creating one. */
export const fundingSourceCreatedToast = (abbreviation: string): string =>
  `New funding source created - abbreviation: ${abbreviation}`;

/** The toast after saving a changed explanation. */
export const fundingSourceUpdatedToast = (abbreviation: string): string =>
  `Funding source updated - abbreviation: ${abbreviation}`;

/** Plain code-point order, case-sensitive like the key itself and like the backend's sort. */
export const compareFundingSources = (
  a: FundingSource,
  b: FundingSource,
): number =>
  a.abbreviation < b.abbreviation
    ? -1
    : a.abbreviation > b.abbreviation
      ? 1
      : 0;

/**
 * The list in abbreviation order, leaving its input as it was. The query behind the pages starts
 * with an empty list, so its data is never undefined in practice; the type says it may be.
 */
export const sortFundingSources = (
  sources: FundingSource[] | undefined,
): FundingSource[] => [...(sources ?? [])].sort(compareFundingSources);

/** The source with this abbreviation, or undefined when the list has none (or is not here yet). */
export const findFundingSource = (
  sources: FundingSource[] | undefined,
  abbreviation: string | undefined,
): FundingSource | undefined =>
  (sources ?? []).find((source) => source.abbreviation === abbreviation);
