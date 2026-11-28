import { Form } from "react-bootstrap";
import DateTimeStamp from "main/components/Common/DateTimeStamp";

export type StampedCheckboxProps = {
  /** The id of the checkbox, which its label is tied to; unique on the page. */
  id: string;
  /** What the box means; the accessible name, shown beside the box unless `hideLabel`. */
  label: string;
  /** When the box was ticked, as the API sends it, or null: the box is checked iff there is a stamp. */
  stamp: string | null;
  /** Called with true when the box is ticked and false when it is unticked. */
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /**
   * Leave the label out of the layout (it stays the accessible name), for a box in a table whose
   * column heading already says what it is.
   */
  hideLabel?: boolean;
  /** Prefix of the test ids: `${testIdPrefix}`, `${testIdPrefix}-checkbox`, `${testIdPrefix}-stamp-date`, ... */
  testIdPrefix?: string;
};

/**
 * A checkbox that remembers when it was ticked (issue #509): checked when it has a stamp, with the
 * stamp's date and time under it in small text; unchecked, with nothing under it, when it has none.
 *
 * <p>The component shows whatever stamp it is given and never makes one up. Ticking calls
 * `onChange(true)` and unticking `onChange(false)`; the caller saves, and the backend records the
 * time, which comes back as the new stamp.
 */
export default function StampedCheckbox({
  id,
  label,
  stamp,
  onChange,
  disabled = false,
  hideLabel = false,
  testIdPrefix = "StampedCheckbox",
}: StampedCheckboxProps): React.JSX.Element {
  return (
    <div data-testid={testIdPrefix}>
      <Form.Check
        type="checkbox"
        id={id}
        label={hideLabel ? undefined : label}
        aria-label={label}
        checked={stamp !== null}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        data-testid={`${testIdPrefix}-checkbox`}
      />
      <DateTimeStamp stamp={stamp} testIdPrefix={`${testIdPrefix}-stamp`} />
    </div>
  );
}
