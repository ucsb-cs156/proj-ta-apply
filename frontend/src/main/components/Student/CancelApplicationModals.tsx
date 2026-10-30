import { useState } from "react";
import { Button, Form } from "react-bootstrap";
import Modal from "react-bootstrap/Modal";

type CancelApplicationModalsProps = {
  /** Shown while true; the parent remounts the component (key) for each new request. */
  show: boolean;
  /** Names the application, e.g. "TA positions, W26". */
  recruitmentName: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
  testIdPrefix?: string;
};

export const REASON_PROMPT =
  'Your application is not cancelled yet. Please provide a brief explanation of your reason for cancelling your application (e.g. "found other employment", "taking a quarter off from school", etc.) and press "Yes, Cancel my Application".';

/**
 * The two-step confirmation before an applicant cancels an application (issue #107): first a plain
 * "are you sure", then a second modal that asks for a brief reason and only then cancels.
 */
export default function CancelApplicationModals({
  show,
  recruitmentName,
  onConfirm,
  onClose,
  testIdPrefix = "CancelApplicationModals",
}: CancelApplicationModalsProps): React.JSX.Element {
  const [step, setStep] = useState<1 | 2>(1);
  const [reason, setReason] = useState("");
  const id = (name: string) => `${testIdPrefix}-${name}`;

  return (
    <>
      <Modal
        show={show && step === 1}
        onHide={onClose}
        centered={true}
        data-testid={id("step1")}
      >
        <Modal.Header closeButton>
          Cancel my application: {recruitmentName}
        </Modal.Header>
        <Modal.Body>
          <p className="mb-0" data-testid={id("step1-body")}>
            Are you sure? This cannot be undone.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={onClose}
            data-testid={id("step1-no")}
          >
            No, do not cancel my application
          </Button>
          <Button
            variant="danger"
            onClick={() => setStep(2)}
            data-testid={id("step1-yes")}
          >
            Yes, Cancel
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={show && step === 2}
        onHide={onClose}
        centered={true}
        data-testid={id("step2")}
      >
        <Modal.Header closeButton>
          Cancel my application: {recruitmentName}
        </Modal.Header>
        <Modal.Body>
          <p data-testid={id("step2-body")}>{REASON_PROMPT}</p>
          <Form.Group>
            <Form.Label htmlFor={id("reason")}>
              Reason for cancelling
            </Form.Label>
            <Form.Control
              id={id("reason")}
              data-testid={id("reason")}
              as="textarea"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={onClose}
            data-testid={id("step2-no")}
          >
            No, don&apos;t cancel my application
          </Button>
          <Button
            variant="danger"
            disabled={reason.trim() === ""}
            onClick={() => onConfirm(reason.trim())}
            data-testid={id("step2-yes")}
          >
            Yes, Cancel my Application
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
