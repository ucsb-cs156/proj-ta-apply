/** A value longer than this is cut short in the table, with a link to the whole of it. */
export const LONG_VALUE = 30;

/** How much of a long value the table shows before the "..." */
export const SHOWN_PREFIX = 15;

export const isLong = (value: string): boolean => value.length > LONG_VALUE;

/** The first characters of a long value, followed by an ellipsis. */
export const abbreviate = (value: string): string =>
  `${value.substring(0, SHOWN_PREFIX)}...`;

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
  { value: "ulaApplicationId", label: "ULA Application" },
  { value: "taApplicationId", label: "TA Application" },
  { value: "fieldName", label: "Field" },
  { value: "oldValue", label: "Old Value" },
  { value: "newValue", label: "New Value" },
];
