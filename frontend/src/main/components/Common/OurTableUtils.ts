import type { ReactNode } from "react";

// Columns may be given in the old react-table v7 style ({ Header, accessor })
// or the current v8 style ({ header, accessorKey }), so this accepts either
// shape and can't be typed more narrowly than that. A header is usually a
// string, but may be any React node, e.g. a heading on two lines.
export type LegacyColumn = Record<string, unknown> & {
  Header?: string;
  header?: ReactNode;
  accessor?: string;
  accessorKey?: string;
};

export function convertOldStyleColumnsToNewStyle(
  oldStyleColumns: LegacyColumn[],
): LegacyColumn[] {
  const result: LegacyColumn[] = [];
  for (const col of oldStyleColumns) {
    const newCol = {
      id: col.accessor || col.accessorKey, // Use accessor or accessorKey as id
      header: col.Header || col.header, // Use Header or header for the column title
      accessorKey: col.accessor || col.accessorKey, // Use accessor or accessorKey
      ...col,
    };
    result.push({ ...newCol });
  }
  return result;
}
