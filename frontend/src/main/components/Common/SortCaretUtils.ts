import type { Header } from "@tanstack/react-table";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSortCaret(header: Header<any, unknown>): string {
  if (!header.column.getCanSort()) return "";
  if (header.column.getIsSorted() === "asc") {
    return "🔼";
  }
  if (header.column.getIsSorted() === "desc") {
    return "🔽";
  }
  return "";
}
