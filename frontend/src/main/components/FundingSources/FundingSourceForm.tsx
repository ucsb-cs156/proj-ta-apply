import { Button, Form } from "react-bootstrap";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import RequiredField from "main/components/Common/RequiredField";
import RequiredFieldExplanation from "main/components/Common/RequiredFieldExplanation";
import {
  ABBREVIATION_MAX,
  type FundingSource,
} from "main/utils/fundingSources";

export type FundingSourceFormFields = FundingSource;

type FundingSourceFormProps = {
  /** The source being edited; absent on the create page. */
  initialContents?: FundingSourceFormFields;
  /** Called with both values trimmed. */
  submitAction: (data: FundingSourceFormFields) => void;
  buttonLabel?: string;
  /**
   * On the edit page the abbreviation is the key, and hiring records will refer to it, so it is
   * shown but cannot be changed; to change one, delete it and create another.
   */
  abbreviationReadOnly?: boolean;
};

export const ABBREVIATION_REQUIRED = "Abbreviation is required.";
export const ABBREVIATION_TOO_LONG = `Abbreviation is at most ${ABBREVIATION_MAX} characters.`;
export const EXPLANATION_REQUIRED = "Explanation is required.";
export const ABBREVIATION_FIXED_NOTE =
  "The abbreviation cannot be changed. To change it, delete this funding source and create another.";

/**
 * The create and edit form of a funding source (issue #512): an abbreviation (required, at most
 * ABBREVIATION_MAX characters, trimmed) and an explanation (required, trimmed).
 */
export default function FundingSourceForm({
  initialContents,
  submitAction,
  buttonLabel = "Create",
  abbreviationReadOnly = false,
}: FundingSourceFormProps): React.JSX.Element {
  // Stryker disable all
  const {
    register,
    formState: { errors },
    handleSubmit,
  } = useForm<FundingSourceFormFields>({ defaultValues: initialContents });
  // Stryker restore all

  const navigate = useNavigate();

  const testIdPrefix = "FundingSourceForm";

  const onSubmit = (data: FundingSourceFormFields) =>
    submitAction({
      abbreviation: data.abbreviation.trim(),
      explanation: data.explanation.trim(),
    });

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <p className="mb-2">
        <RequiredFieldExplanation />
      </p>
      <Form.Group className="mb-3">
        <Form.Label htmlFor="abbreviation">
          Abbreviation <RequiredField />
        </Form.Label>
        <Form.Control
          data-testid={testIdPrefix + "-abbreviation"}
          id="abbreviation"
          type="text"
          readOnly={abbreviationReadOnly}
          isInvalid={Boolean(errors.abbreviation)}
          {...register("abbreviation", {
            validate: {
              required: (value) => value.trim() !== "" || ABBREVIATION_REQUIRED,
              maxLength: (value) =>
                value.trim().length <= ABBREVIATION_MAX ||
                ABBREVIATION_TOO_LONG,
            },
          })}
        />
        <Form.Control.Feedback type="invalid">
          {errors.abbreviation?.message}
        </Form.Control.Feedback>
        {abbreviationReadOnly && (
          <Form.Text data-testid={testIdPrefix + "-abbreviation-note"}>
            {ABBREVIATION_FIXED_NOTE}
          </Form.Text>
        )}
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label htmlFor="explanation">
          Explanation <RequiredField />
        </Form.Label>
        <Form.Control
          data-testid={testIdPrefix + "-explanation"}
          id="explanation"
          type="text"
          maxLength={255}
          isInvalid={Boolean(errors.explanation)}
          {...register("explanation", {
            validate: (value) => value.trim() !== "" || EXPLANATION_REQUIRED,
          })}
        />
        <Form.Control.Feedback type="invalid">
          {errors.explanation?.message}
        </Form.Control.Feedback>
      </Form.Group>

      <Button type="submit" data-testid={testIdPrefix + "-submit"}>
        {buttonLabel}
      </Button>
      <Button
        variant="Secondary"
        onClick={() => navigate(-1)}
        data-testid={testIdPrefix + "-cancel"}
      >
        Cancel
      </Button>
    </Form>
  );
}
