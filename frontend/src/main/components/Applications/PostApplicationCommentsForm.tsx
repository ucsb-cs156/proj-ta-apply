import { Button, Form } from "react-bootstrap";
import { useForm } from "react-hook-form";

export type PostApplicationCommentsFields = {
  postApplicationComments: string;
};

type PostApplicationCommentsFormProps = {
  initialContents?: string | null;
  submitAction: (data: PostApplicationCommentsFields) => void;
  testIdPrefix?: string;
};

/**
 * Kept apart from the rest of the application on purpose: this is the one thing an applicant can
 * still change after the primary consideration date, so it gets its own form and its own button.
 */
export default function PostApplicationCommentsForm({
  initialContents,
  submitAction,
  testIdPrefix = "PostApplicationCommentsForm",
}: PostApplicationCommentsFormProps): React.JSX.Element {
  // Stryker disable all
  const { register, handleSubmit } = useForm<PostApplicationCommentsFields>({
    defaultValues: { postApplicationComments: initialContents ?? "" },
  });
  // Stryker restore all

  return (
    <Form onSubmit={handleSubmit(submitAction)}>
      <Form.Group className="mb-3">
        <Form.Label htmlFor={`${testIdPrefix}-postApplicationComments`}>
          Post Application Comments
        </Form.Label>
        <Form.Control
          id={`${testIdPrefix}-postApplicationComments`}
          data-testid={`${testIdPrefix}-postApplicationComments`}
          as="textarea"
          rows={3}
          {...register("postApplicationComments")}
        />
        <Form.Text muted>
          Anything that has changed since you applied, such as coursework you
          have since finished.
        </Form.Text>
      </Form.Group>
      <Button type="submit" data-testid={`${testIdPrefix}-submit`}>
        Save Comments
      </Button>
    </Form>
  );
}
