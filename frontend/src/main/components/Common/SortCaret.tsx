import type { Header } from "@tanstack/react-table";
import { getSortCaret } from "main/components/Common/SortCaretUtils";

type SortCaretProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  header: Header<any, unknown>;
  testId?: string;
};

export default function SortCaret({
  header,
  testId = "testid",
}: SortCaretProps): React.JSX.Element {
  return (
    <span data-testid={`${testId}-header-${header.column.id}-sort-carets`}>
      {getSortCaret(header)}
    </span>
  );
}
