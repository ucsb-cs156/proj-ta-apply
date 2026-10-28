import RequiredField from "main/components/Common/RequiredField";

/**
 * The sentence that tells a user what the RequiredField mark means. Inline, so it can be dropped
 * into a paragraph or a card header; forms typically show it once, above their first field.
 */
export default function RequiredFieldExplanation(): React.JSX.Element {
  return (
    <span
      className="required-field-explanation"
      data-testid="RequiredFieldExplanation"
    >
      Fields marked <RequiredField /> are required.
    </span>
  );
}
