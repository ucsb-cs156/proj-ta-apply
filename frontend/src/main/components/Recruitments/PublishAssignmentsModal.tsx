import { Button, Modal } from "react-bootstrap";
import { toast } from "react-toastify";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { useBackendMutation } from "main/utils/useBackend";
import { publishModalText } from "main/utils/publishedAssignments";
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
  const mutation = useBackendMutation<void, Recruitment>(
    () => ({
      url: "/api/admin/recruitments/assignmentsPublished",
      method: "PUT",
      params: { id: recruitment.id, published: true },
    }),
    {
      onSuccess: () => {
        onHide();
        toast("Assignments published.");
      },
    },
    ["/api/admin/recruitments/all", STEPS_QUERY_KEY],
  );

  return (
    <Modal
      show={show}
      onHide={onHide}
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
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="primary"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
          data-testid={`${testIdPrefix}-confirm`}
        >
          Yes
        </Button>
        <Button
          variant="secondary"
          onClick={onHide}
          data-testid={`${testIdPrefix}-cancel`}
        >
          No
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
