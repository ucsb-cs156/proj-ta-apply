import { Form } from "react-bootstrap";
import DateTimeStamp from "main/components/Common/DateTimeStamp";

export type StampedSelectOption = {
  /** What is stored and passed to `onChange`, like "DONE". */
  value: string;
  /** What the user reads, like "Done". */
  label: string;
};

export type StampedSelectProps = {
  /** The id of the select, which its label is tied to; unique on the page. */
  id: string;
  /** What is being chosen; the accessible name, shown above the select unless `hideLabel`. */
  label: string;
  /** The choices, offered after a blank one. */
  options: StampedSelectOption[];
  /** The chosen option's value, or null for the blank choice. */
  value: string | null;
  /** When the choice was made, as the API sends it, or null; shown under the select. */
  stamp: string | null;
  /** Called with the chosen option's value, or null when the blank choice is made. */
  onChange: (value: string | null) => void;
  disabled?: boolean;
  /**
   * Leave the label out of the layout (it stays the accessible name), for a select in a table whose
   * column heading already says what it is.
   */
  hideLabel?: boolean;
  /** Prefix of the test ids: `${testIdPrefix}`, `${testIdPrefix}-select`, `${testIdPrefix}-stamp-date`, ... */
  testIdPrefix?: string;
};

/**
 * A dropdown that remembers when its choice was made (issue #509: "New Hire form done (or not
 * needed)"): a blank choice and the given options, with the stamp's date and time under it in
 * small text when there is one.
 *
 * <p>Like StampedCheckbox, the component shows whatever stamp it is given and never makes one up;
 * the caller saves the chosen value, and the backend records the time.
 */
export default function StampedSelect({
  id,
  label,
  options,
  value,
  stamp,
  onChange,
  disabled = false,
  hideLabel = false,
  testIdPrefix = "StampedSelect",
}: StampedSelectProps): React.JSX.Element {
  return (
    <div data-testid={testIdPrefix}>
      {!hideLabel && <Form.Label htmlFor={id}>{label}</Form.Label>}
      <Form.Select
        id={id}
        aria-label={label}
        // Stryker disable next-line StringLiteral: React selects the first option, the blank one,
        // whenever the value matches no option, so any other literal here renders the same DOM.
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : e.target.value)
        }
        data-testid={`${testIdPrefix}-select`}
      >
        <option value=""></option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Form.Select>
      <DateTimeStamp stamp={stamp} testIdPrefix={`${testIdPrefix}-stamp`} />
    </div>
  );
}
