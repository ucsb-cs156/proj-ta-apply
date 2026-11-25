import { useState } from "react";
import { Alert, Button, Form, Modal } from "react-bootstrap";
import { toast } from "react-toastify";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { apiErrorMessage } from "main/utils/apiError";
import {
  CHANGE_DEADLINE_LABEL,
  DEADLINE_CHANGED_TOAST,
  DEADLINE_ERROR,
  SOFT_OFFERS_URL,
  SOFT_OFFER_RESULTS_URL,
  deadlineAsLocal,
} from "main/utils/softOffers";
import { HIRING_STAFF_RECRUITMENTS_URL } from "main/utils/hiringStaff";
import { isFutureWallClock } from "main/utils/pacificTime";
import { useBackendMutation } from "main/utils/useBackend";

type ChangeSoftOfferDeadlineModalProps = {
  recruitment: Recruitment;
  show: boolean;
  onHide: () => void;
  testIdPrefix?: string;
};

/**
 * Change Deadline on the Soft Offer Results page (issue #487): the deadline box, pre-filled with
 * the current deadline, saved through the same endpoint that released the soft offers (issue #485),
 * which once released changes only the deadline and records it in the Change History.
 */
export default function ChangeSoftOfferDeadlineModal({
  recruitment,
  show,
  onHide,
  // Stryker disable next-line StringLiteral : every caller passes its own prefix
  testIdPrefix = "ChangeSoftOfferDeadlineModal",
}: ChangeSoftOfferDeadlineModalProps): React.JSX.Element {
  const id = (suffix: string) => `${testIdPrefix}-${suffix}`;
  const [deadline, setDeadline] = useState(() =>
    deadlineAsLocal(recruitment.softOfferDeadline),
  );
  // Stryker disable next-line StringLiteral : the error is cleared whenever the box changes
  const [deadlineError, setDeadlineError] = useState("");
  const [refusal, setRefusal] = useState<string | null>(null);

  const mutation = useBackendMutation<string, Recruitment>(
    (chosen) => ({
      url: SOFT_OFFERS_URL,
      method: "PUT",
      params: { id: recruitment.id, deadline: chosen },
    }),
    {
      onSuccess: () => {
        onHide();
        toast(DEADLINE_CHANGED_TOAST);
      },
      onError: (error) => setRefusal(apiErrorMessage(error)),
    },
    // The admin's cards, the hiring staff's cards and the results page's own lookup (issue #505).
    [
      "/api/admin/recruitments/all",
      HIRING_STAFF_RECRUITMENTS_URL,
      SOFT_OFFER_RESULTS_URL,
    ],
  );

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    // Stryker disable next-line BlockStatement,CallExpression : the form is never really submitted in jsdom or the modal
    event.preventDefault();
    if (!isFutureWallClock(deadline)) {
      setDeadlineError(DEADLINE_ERROR);
      return;
    }
    setRefusal(null);
    mutation.mutate(deadline);
  };

  return (
    <Modal show={show} onHide={onHide} centered data-testid={id("modal")}>
      <Form onSubmit={submit}>
        <Modal.Header closeButton>
          <Modal.Title>{CHANGE_DEADLINE_LABEL}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p data-testid={id("explanation")}>
            Applicants are asked to answer their soft offer by this deadline;
            answers given after it are still accepted and marked late. The
            change is recorded in the recruitment&apos;s change history.
          </p>
          <Form.Group controlId={id("deadline")}>
            <Form.Label>Soft offer deadline</Form.Label>
            <Form.Control
              type="datetime-local"
              required
              value={deadline}
              onChange={(event) => {
                setDeadline(event.target.value);
                setDeadlineError("");
              }}
              isInvalid={deadlineError !== ""}
              data-testid={id("deadline-input")}
            />
            <Form.Control.Feedback
              type="invalid"
              data-testid={id("deadline-error")}
            >
              {deadlineError}
            </Form.Control.Feedback>
          </Form.Group>
          {refusal !== null && (
            <Alert
              variant="danger"
              className="mb-0 mt-3"
              data-testid={id("refusal")}
            >
              {refusal}
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={onHide}
            data-testid={id("cancel")}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={mutation.isPending}
            data-testid={id("confirm")}
          >
            Save Deadline
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
