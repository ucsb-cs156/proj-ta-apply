import { Dropdown, Form } from "react-bootstrap";

export type ColumnChoice = { id: string; label: string };

type ColumnVisibilityControlProps = {
  /** Every column that may be hidden, in table order. */
  choices: ColumnChoice[];
  /** The ids currently hidden. */
  hidden: string[];
  onToggle: (columnId: string, hidden: boolean) => void;
  testIdPrefix?: string;
};

/**
 * A "Columns" menu of checkboxes, one per hideable column (issue #185): unticking hides the column
 * and ticking brings it back. "Select All" shows every column at once and "Select None" hides them
 * all (the columns outside the menu, such as ids and action links, always stay). The menu stays
 * open while boxes are ticked, so several can be changed in one visit.
 */
export default function ColumnVisibilityControl({
  choices,
  hidden,
  onToggle,
  testIdPrefix = "ColumnVisibilityControl",
}: ColumnVisibilityControlProps): React.JSX.Element {
  const hiddenHere = choices.filter((choice) => hidden.includes(choice.id));
  const shownHere = choices.filter((choice) => !hidden.includes(choice.id));
  return (
    <Dropdown autoClose="outside" data-testid={testIdPrefix}>
      <Dropdown.Toggle
        variant="outline-secondary"
        size="sm"
        id={`${testIdPrefix}-toggle`}
        data-testid={`${testIdPrefix}-toggle`}
      >
        Columns
        {hiddenHere.length > 0 && ` (${hiddenHere.length} hidden)`}
      </Dropdown.Toggle>
      <Dropdown.Menu>
        <Dropdown.Item
          as="button"
          disabled={hiddenHere.length === 0}
          onClick={() =>
            hiddenHere.forEach((choice) => onToggle(choice.id, false))
          }
          data-testid={`${testIdPrefix}-select-all`}
        >
          Select All
        </Dropdown.Item>
        <Dropdown.Item
          as="button"
          disabled={shownHere.length === 0}
          onClick={() =>
            shownHere.forEach((choice) => onToggle(choice.id, true))
          }
          data-testid={`${testIdPrefix}-select-none`}
        >
          Select None
        </Dropdown.Item>
        <Dropdown.Divider />
        {choices.map((choice) => (
          <Dropdown.ItemText key={choice.id}>
            <Form.Check
              type="checkbox"
              id={`${testIdPrefix}-${choice.id}`}
              label={choice.label}
              checked={!hidden.includes(choice.id)}
              onChange={(e) => onToggle(choice.id, !e.target.checked)}
              data-testid={`${testIdPrefix}-${choice.id}`}
            />
          </Dropdown.ItemText>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
}
