/** A value longer than this is cut short in the table, with a link to the whole of it. */
export const LONG_VALUE = 30;

/** How much of a long value the table shows before the "..." */
export const SHOWN_PREFIX = 15;

export const isLong = (value: string): boolean => value.length > LONG_VALUE;

/** The first characters of a long value, followed by an ellipsis. */
export const abbreviate = (value: string): string =>
  `${value.substring(0, SHOWN_PREFIX)}...`;

/** The two id columns of a row; exactly one is set (the table has a check constraint). */
export type AppIds = {
  ulaApplicationId: number | null;
  taApplicationId: number | null;
};

/** The id of the application a row belongs to, whichever kind it is; null only for bad data. */
export const appId = (row: AppIds): number | null => {
  if (row.taApplicationId !== null) {
    return row.taApplicationId;
  }
  return row.ulaApplicationId;
};

/** Which application a row belongs to, as "TA 7" or "ULA 9"; blank only for bad data. */
export const appLabel = (row: AppIds): string => {
  if (row.taApplicationId !== null) {
    return `TA ${row.taApplicationId}`;
  }
  if (row.ulaApplicationId !== null) {
    return `ULA ${row.ulaApplicationId}`;
  }
  return "";
};

/** The columns the Audit Trail page can be sorted by, as the backend names them. */
export type SortColumn =
  | "id"
  | "editedAt"
  | "ulaApplicationId"
  | "taApplicationId"
  | "fieldName"
  | "oldValue"
  | "newValue";

export const SORT_OPTIONS: { value: SortColumn; label: string }[] = [
  { value: "id", label: "id" },
  { value: "editedAt", label: "Edited" },
  { value: "taApplicationId", label: "App (TA id)" },
  { value: "ulaApplicationId", label: "App (ULA id)" },
  { value: "fieldName", label: "Field" },
  { value: "oldValue", label: "Old Value" },
  { value: "newValue", label: "New Value" },
];
