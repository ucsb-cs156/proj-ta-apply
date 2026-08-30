import { useForm } from "react-hook-form";
import { Button, Form } from "react-bootstrap";

export type GradStudentCSVUploadFormFields = {
  upload: FileList;
};

type GradStudentCSVUploadFormProps = {
  submitAction: (data: GradStudentCSVUploadFormFields) => void;
};

export default function GradStudentCSVUploadForm({
  submitAction,
}: GradStudentCSVUploadFormProps): React.JSX.Element {
  // Stryker disable all
  const {
    register,
    formState: { errors },
    handleSubmit,
  } = useForm<GradStudentCSVUploadFormFields>();
  // Stryker restore all

  const testIdPrefix = "GradStudentCSVUploadForm";

  return (
    <Form onSubmit={handleSubmit(submitAction)}>
      <Form.Group className="mb-2">
        <Form.Label htmlFor="upload">
          Upload Grad Student Emails (CSV)
        </Form.Label>
        <Form.Control
          data-testid={testIdPrefix + "-upload"}
          id="upload"
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
