import type { ReactNode } from "react";
import { Table } from "react-bootstrap";

export type DetailsColumn = {
  /** The heading; each word goes on its own line so the column is no wider than its value. */
  label: string;
  /** What the cell shows. */
  value: ReactNode;
  /** The value as plain text, to decide whether the heading is longer than it. */
  text: string;
  /** A test id for the value cell. */
  testId?: string;
};

type DetailsTableProps = {
  columns: DetailsColumn[];
  testIdPrefix?: string;
};

/** The heading is longer than the value it labels, so it is shown at 80% size (issue #205). */
const isLongHeading = (label: string, text: string): boolean =>
  label.length > text.length;

/**
 * A one-row table of details: a heading row and a single row of values, sized to its content
 * (issue #205). Multi-word headings are stacked one word per line, and a heading longer than its
 * value is shown at 80% of the heading size, so the table stays narrow and short.
 */
export default function DetailsTable({
  columns,
  testIdPrefix = "DetailsTable",
}: DetailsTableProps): React.JSX.Element {
  return (
    <Table
      size="sm"
      bordered
      className="w-auto align-middle"
      data-testid={testIdPrefix}
    >
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={column.label}
              className="text-center"
              style={
                isLongHeading(column.label, column.text)
                  ? { fontSize: "80%" }
                  : undefined
              }
              data-testid={`${testIdPrefix}-heading-${column.label}`}
            >
              {column.label.split(" ").map((word, index) => (
                // Stryker disable next-line all : React key property not exposed in dom
                <span key={word + index}>
                  {index > 0 && <br />}
                  {word}
                </span>
              ))}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {columns.map((column) => (
            <td
              key={column.label}
              style={{ whiteSpace: "nowrap" }}
              data-testid={column.testId}
            >
              {column.value}
            </td>
          ))}
        </tr>
      </tbody>
    </Table>
  );
}
