import { Button, Form } from "react-bootstrap";
import Modal from "react-bootstrap/Modal";
import { useForm } from "react-hook-form";
import SingleQuarterDropdown from "main/components/Quarters/SingleQuarterDropdown";
import RequiredField from "main/components/Common/RequiredField";
import RequiredFieldExplanation from "main/components/Common/RequiredFieldExplanation";
import { useState } from "react";

export type RecruitmentFormFields = {
  quarter: string;
  type: string;
  tentativeOpeningDate: string;
  primaryConsiderationDate: string;
};

type Quarter = { yyyyq: string; qyy: string };

type RecruitmentFormProps = {
  quarters: Quarter[];
  submitAction: (data: RecruitmentFormFields) => void;
  /** The Cancel button; the form lives in a modal (issue #108), so there is always one. */
  onCancel: () => void;
};

/**
 * The four fields of a new recruitment, laid out as a modal's body and footer: the page wraps it
 * in the Create New Recruitment modal, and a story or test can show it on its own.
 */
export default function RecruitmentForm({
  quarters,
  submitAction,
  onCancel,
}: RecruitmentFormProps): React.JSX.Element {
  // Stryker disable all
  const {
    register,
    formState: { errors },
    handleSubmit,
  } = useForm<RecruitmentFormFields>();
  // Stryker restore all

  // The quarter dropdown keeps its own state, so mirror it here for submission.
  const [quarter, setQuarter] = useState(quarters[0]?.yyyyq ?? "");

  const testIdPrefix = "RecruitmentForm";

  return (
    <Form onSubmit={handleSubmit((data) => submitAction({ ...data, quarter }))}>
      <Modal.Body>
        <p className="mb-2">
          <RequiredFieldExplanation />
        </p>
        <div className="mb-3">
          <SingleQuarterDropdown
            quarters={quarters}
            quarter={quarter}
            setQuarter={setQuarter}
            controlId={`${testIdPrefix}.Quarter`}
            label="Quarter"
          />
        </div>

        <Form.Group className="mb-3">
          <Form.Label htmlFor={`${testIdPrefix}-type`}>Type</Form.Label>
          <Form.Select
            id={`${testIdPrefix}-type`}
            data-testid={`${testIdPrefix}-type`}
            {...register("type")}
          >
            <option value="TA">TA</option>
            <option value="ULA">ULA</option>
          </Form.Select>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label htmlFor={`${testIdPrefix}-tentativeOpeningDate`}>
            Tentative Opening Date <RequiredField />
          </Form.Label>
          <Form.Control
            id={`${testIdPrefix}-tentativeOpeningDate`}
            data-testid={`${testIdPrefix}-tentativeOpeningDate`}
            type="date"
            isInvalid={Boolean(errors.tentativeOpeningDate)}
            {...register("tentativeOpeningDate", { required: true })}
          />
          <Form.Control.Feedback type="invalid">
            {errors.tentativeOpeningDate &&
              "A tentative opening date is required."}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label htmlFor={`${testIdPrefix}-primaryConsiderationDate`}>
            Primary Consideration Date <RequiredField />
          </Form.Label>
          <Form.Control
            id={`${testIdPrefix}-primaryConsiderationDate`}
            data-testid={`${testIdPrefix}-primaryConsiderationDate`}
            type="date"
            isInvalid={Boolean(errors.primaryConsiderationDate)}
            {...register("primaryConsiderationDate", { required: true })}
          />
          <Form.Control.Feedback type="invalid">
            {errors.primaryConsiderationDate &&
              "A primary consideration date is required."}
          </Form.Control.Feedback>
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="secondary"
          onClick={onCancel}
          data-testid={`${testIdPrefix}-cancel`}
        >
          Cancel
        </Button>
        <Button type="submit" data-testid={`${testIdPrefix}-submit`}>
          Create New Recruitment
        </Button>
      </Modal.Footer>
    </Form>
  );
}
