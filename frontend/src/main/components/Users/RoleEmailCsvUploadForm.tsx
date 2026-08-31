import { useForm } from "react-hook-form";
import { Button, Form } from "react-bootstrap";

export type RoleEmailCsvUploadFormFields = {
  upload: FileList;
};

type RoleEmailCsvUploadFormProps = {
  submitAction: (data: RoleEmailCsvUploadFormFields) => void;
  label: string;
  testIdPrefix: string;
};

/**
 * Upload form for bulk-adding email addresses to one of the role tables. Shared by the grad
 * students and instructors pages so both behave identically; only the label and test id prefix
 * differ.
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
        <Form.Label htmlFor={inputId}>{label}</Form.Label>
        <Form.Control
          data-testid={testIdPrefix + "-upload"}
          id={inputId}
          type="file"
          accept=".csv"
          isInvalid={Boolean(errors.upload)}
          {...register("upload", { required: true })}
        />
        <Form.Control.Feedback type="invalid">
          {errors.upload && "A CSV file is required. "}
        </Form.Control.Feedback>
        <Form.Text muted>
          The file needs a header row with a column named <code>email</code>.
          Addresses already on the list are skipped, so re-uploading is safe.
        </Form.Text>
      </Form.Group>
      <Button
        type="submit"
        data-testid={testIdPrefix + "-submit"}
        className="mt-3"
      >
        Upload
      </Button>
    </Form>
  );
}
