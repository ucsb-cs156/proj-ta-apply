import { Button, Form } from "react-bootstrap";
import { useForm } from "react-hook-form";
import SingleQuarterDropdown from "main/components/Quarters/SingleQuarterDropdown";
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
};

export default function RecruitmentForm({
  quarters,
  submitAction,
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
      <div className="d-flex gap-3 align-items-start flex-wrap">
        <SingleQuarterDropdown
          quarters={quarters}
          quarter={quarter}
          setQuarter={setQuarter}
          controlId={`${testIdPrefix}.Quarter`}
          label="Quarter"
        />

        <Form.Group>
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

        <Form.Group>
          <Form.Label htmlFor={`${testIdPrefix}-tentativeOpeningDate`}>
            Tentative Opening Date
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

        <Form.Group>
          <Form.Label htmlFor={`${testIdPrefix}-primaryConsiderationDate`}>
            Primary Consideration Date
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

        <Button
          type="submit"
          className="mt-4"
          data-testid={`${testIdPrefix}-submit`}
        >
          Create
        </Button>
      </div>
    </Form>
  );
}
