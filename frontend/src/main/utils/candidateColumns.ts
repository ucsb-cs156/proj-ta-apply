/** The columns an instructor can never hide on the ranking page: the rank input and the name. */
export const ALWAYS_SHOWN_CANDIDATE_COLUMNS = ["rank", "firstName", "lastName"];

/**
 * Where the hidden columns of a recruitment's candidate-ranking pages are remembered, in the
 * browser's local storage (issue #312): one list per recruitment and type (TA or ULA), shared by
 * all of the recruitment's courses.
 */
export const candidateColumnsStorageKey = (
  recruitmentId: string | number | undefined,
  type: "TA" | "ULA",
): string => `candidateRanking.hiddenColumns.${recruitmentId}.${type}`;

/**
 * The columns that may be hidden, in table order, with the label the Columns menu shows: every
 * column except the ranking input and the name, which stay so that the instructor can always
 * rank, and know whom they are ranking.
 */
export const candidateColumnChoices = (
  columns: { key: string; label: string }[],
): { id: string; label: string }[] =>
  columns
    .filter((column) => !ALWAYS_SHOWN_CANDIDATE_COLUMNS.includes(column.key))
    .map((column) => ({ id: column.key, label: column.label }));
