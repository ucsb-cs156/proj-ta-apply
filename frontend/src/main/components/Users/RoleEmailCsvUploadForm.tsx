import { useForm } from "react-hook-form";
import { Button, Form, InputGroup } from "react-bootstrap";
import RequiredField from "main/components/Common/RequiredField";

export type RoleEmailCsvUploadFormFields = {
  upload: FileList;
};

type RoleEmailCsvUploadFormProps = {
  submitAction: (data: RoleEmailCsvUploadFormFields) => void;
  label: string;
  testIdPrefix: string;
};

/**
 * Upload form for bulk-adding email addresses to a role table. Written to be shared between role
 * pages (it once served grad students and instructors) so each behaves identically; only the
 * label and test id prefix differ.
 */
export default function RoleEmailCsvUploadForm({
  submitAction,
  label,
  testIdPrefix,
}: RoleEmailCsvUploadFormProps): React.JSX.Element {
  // Stryker disable all
  const {
    register,
    formState: { errors },
    handleSubmit,
  } = useForm<RoleEmailCsvUploadFormFields>();
  // Stryker restore all

  // Unique per instance, so two of these forms could coexist on one page.
  const inputId = `${testIdPrefix}-upload-input`;

  return (
    <Form onSubmit={handleSubmit(submitAction)}>
      <Form.Group className="mb-2">
        <Form.Label htmlFor={inputId}>
          {label} <RequiredField />
        </Form.Label>
        {/* Natural width (issue #87): the file picker and the Upload button side by side. */}
        <InputGroup size="sm" className="d-inline-flex w-auto" hasValidation>
          <Form.Control
            data-testid={testIdPrefix + "-upload"}
            id={inputId}
            type="file"
            accept=".csv"
            isInvalid={Boolean(errors.upload)}
            {...register("upload", { required: true })}
          />
          <Button
            type="submit"
            variant="outline-primary"
            data-testid={testIdPrefix + "-submit"}
          >
            Upload
          </Button>
          <Form.Control.Feedback type="invalid">
            {errors.upload && "A CSV file is required. "}
          </Form.Control.Feedback>
        </InputGroup>
        <Form.Text muted className="d-block">
          The file needs a header row with a column named <code>email</code>.
          Addresses already on the list are skipped, so re-uploading is safe.
        </Form.Text>
      </Form.Group>
    </Form>
  );
}
