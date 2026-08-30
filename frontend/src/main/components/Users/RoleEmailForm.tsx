import { Button, Form } from "react-bootstrap";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";

export type RoleEmailFormFields = {
  email: string;
};

type RoleEmailFormProps = {
  submitAction: (data: RoleEmailFormFields) => void;
  buttonLabel?: string;
};

export default function RoleEmailForm({
  submitAction,
  buttonLabel = "Create",
}: RoleEmailFormProps): React.JSX.Element {
  // Stryker disable all
  const {
    register,
    formState: { errors },
    handleSubmit,
  } = useForm<RoleEmailFormFields>();
  // Stryker restore all

  const navigate = useNavigate();

  const testIdPrefix = "RoleEmailForm";

  // Stryker disable next-line Regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return (
    <Form onSubmit={handleSubmit(submitAction)}>
      <Form.Group className="mb-3">
        <Form.Label htmlFor="email">Email</Form.Label>
        <Form.Control
          // Stryker disable next-line all
          data-testid={testIdPrefix + "-email"}
          id="email"
          type="text"
          isInvalid={Boolean(errors.email)}
          {...register("email", {
            required: "Email is required.",
            pattern: emailRegex,
          })}
        />
        <Form.Control.Feedback type="invalid">
          {errors.email && "A valid email is required."}
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
