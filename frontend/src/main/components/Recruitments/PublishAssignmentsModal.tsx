import { useState } from "react";
import { Alert, Button, Modal } from "react-bootstrap";
import { toast } from "react-toastify";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { useBackendMutation } from "main/utils/useBackend";
import { apiErrorMessage } from "main/utils/apiError";
import {
  publishModalText,
  unmetPrerequisite,
} from "main/utils/publishedAssignments";
import { STEPS_QUERY_KEY } from "main/utils/recruitmentSteps";

type PublishAssignmentsModalProps = {
  recruitment: Recruitment;
  show: boolean;
  onHide: () => void;
  testIdPrefix?: string;
};

/**
 * The Publish Assignments confirmation (issue #180): what publishing does, and Yes or No. Yes
 * publishes, toasts, re-reads the recruitment list and each recruitment's steps, and closes. Used
 * at the bottom of the Recruitment Courses page and from step 9 of the admin card's diagram
 * (issue #233).
 */
export default function PublishAssignmentsModal({
  recruitment,
  show,
  onHide,
  // Stryker disable next-line StringLiteral : every caller passes its own prefix
  testIdPrefix = "PublishAssignmentsModal",
}: PublishAssignmentsModalProps): React.JSX.Element {
  // The backend's reason for refusing, kept in the modal rather than toasted (issue #237).
  const [refusal, setRefusal] = useState<string | null>(null);
  // What is known without asking: ranking and applications must be closed first.
  const blocked = unmetPrerequisite(recruitment);
  const hide = () => {
    setRefusal(null);
    onHide();
  };

  const mutation = useBackendMutation<void, Recruitment>(
    () => ({
      url: "/api/admin/recruitments/assignmentsPublished",
      method: "PUT",
      params: { id: recruitment.id, published: true },
    }),
    {
      onSuccess: () => {
        hide();
        toast("Assignments published.");
      },
      onError: (error) => setRefusal(apiErrorMessage(error)),
    },
    ["/api/admin/recruitments/all", STEPS_QUERY_KEY],
  );

  return (
    <Modal
      show={show}
      onHide={hide}
      centered
      data-testid={`${testIdPrefix}-modal`}
    >
      <Modal.Header closeButton>
        <Modal.Title>Publish Assignments</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {publishModalText(recruitment.type).map((paragraph, i) => (
          <p key={i} className={i === 2 ? "mb-0" : undefined}>
            {paragraph}
          </p>
        ))}
        {(blocked ?? refusal) !== null && (
          <Alert
            variant="danger"
            className="mb-0 mt-3"
            data-testid={`${testIdPrefix}-refusal`}
          >
            {blocked ?? refusal}
          </Alert>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="primary"
          disabled={mutation.isPending || blocked !== null}
          onClick={() => {
            setRefusal(null);
            mutation.mutate();
          }}
          data-testid={`${testIdPrefix}-confirm`}
        >
          Yes
        </Button>
        <Button
          variant="secondary"
          onClick={hide}
          data-testid={`${testIdPrefix}-cancel`}
        >
          No
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
