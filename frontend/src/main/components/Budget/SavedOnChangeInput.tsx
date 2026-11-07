import { useState } from "react";
import { Form, InputGroup } from "react-bootstrap";

type SavedOnChangeInputProps = {
  /** The control id, also used as the test id. */
  id: string;
  /**
   * The label over the box. Left out when the label is elsewhere, as in a table cell of its own
   * (issue #388): then that `<label htmlFor={id}>` is the box's label.
   */
  label?: string;
  /** The stored value as it belongs in the box; what comes back on blur. */
  stored: string;
  isValid: (value: string) => boolean;
  /** Called with every valid value as it is typed. */
  onSave: (value: string) => void;
  disabled?: boolean;
  /** Text before the box, such as "$". */
  prefix?: string;
  width?: string;
  /** Shown under the label, in small print, while the box is enabled. */
  hint?: string;
  /** Said beside the box while what is typed in it is not valid. */
  invalidMessage?: string;
  /** Hover text (a tooltip) over the label and the box. */
  title?: string;
  /** The box on the same line, right after the label, instead of under it (issue #358). */
  inline?: boolean;
};

/**
 * A box whose value is saved as soon as it is typed, as on the Recruitment Courses page (issue
 * #174): a valid value is sent at once, an invalid one is flagged and never sent, and the stored
 * value comes back when the box loses focus. Used for every figure on the Budget for Quarter page
 * (issue #177).
 */
export default function SavedOnChangeInput({
  id,
  label,
  stored,
  isValid,
  onSave,
  disabled = false,
  prefix,
  width = "10em",
  hint,
  invalidMessage,
  title,
  inline = false,
}: SavedOnChangeInputProps): React.JSX.Element {
  // What is in the box while it has focus; null means "show the stored value".
  const [draft, setDraft] = useState<string | null>(null);

  const onChange = (value: string) => {
    setDraft(value);
    if (isValid(value)) {
      onSave(value);
    }
  };

  return (
    <Form.Group
      className={
        inline
          ? "mb-2 d-flex align-items-center gap-2 flex-wrap"
          : label === undefined
            ? "mb-0"
            : "mb-2"
      }
      controlId={id}
      title={title}
    >
      {label !== undefined && <Form.Label className="mb-0">{label}</Form.Label>}
      <InputGroup size="sm" style={{ width }}>
        {prefix !== undefined && <InputGroup.Text>{prefix}</InputGroup.Text>}
        <Form.Control
          type="text"
          inputMode="decimal"
          value={disabled ? "" : (draft ?? stored)}
          disabled={disabled}
          isInvalid={draft !== null && !isValid(draft)}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setDraft(null)}
          data-testid={id}
        />
        {invalidMessage !== undefined && (
          <Form.Control.Feedback type="invalid" data-testid={`${id}-invalid`}>
            {invalidMessage}
          </Form.Control.Feedback>
        )}
      </InputGroup>
      {hint !== undefined && (
        <Form.Text className="text-muted" data-testid={`${id}-hint`}>
          {hint}
        </Form.Text>
      )}
    </Form.Group>
  );
}
