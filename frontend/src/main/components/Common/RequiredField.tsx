/**
 * The mark placed beside the label of every field a user must fill in. Inline (a span containing
 * only inline content), so it can sit inside a label or a sentence.
 *
 * <p>This component and the .required-field rule in index.css are the one place to change how
 * required fields look throughout the app. Pair it with RequiredFieldExplanation on each form.
 */
export default function RequiredField(): React.JSX.Element {
  return (
    <span
      className="required-field"
      title="Required"
      data-testid="RequiredField"
    >
      *
    </span>
  );
}
