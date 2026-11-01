import { useState } from "react";
import { Alert, Button, Modal } from "react-bootstrap";
import { Link } from "react-router";
import { toast } from "react-toastify";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { useBackendMutation } from "main/utils/useBackend";
import { apiErrorMessage } from "main/utils/apiError";
import {
  publishModalText,
  unmetPrerequisite,
} from "main/utils/publishedAssignments";

type PublishAssignmentsPanelProps = {
  recruitment: Recruitment;
  testIdPrefix?: string;
};

/**
 * The very bottom of the Recruitment Courses page (issue #180): the Publish Assignments button and
 * its confirmation, or, once published, a line saying so with a link to the assignments page.
 */
export default function PublishAssignmentsPanel({
  recruitment,
  testIdPrefix = "PublishAssignmentsPanel",
}: PublishAssignmentsPanelProps): React.JSX.Element {
  const [showModal, setShowModal] = useState(false);
  // The backend's reason for refusing, kept in the modal rather than toasted (issue #237).
  const [refusal, setRefusal] = useState<string | null>(null);
  // What is known without asking: ranking and applications must be closed first.
  const blocked = unmetPrerequisite(recruitment);

  const mutation = useBackendMutation<void, Recruitment>(
    () => ({
      url: "/api/admin/recruitments/assignmentsPublished",
      method: "PUT",
      params: { id: recruitment.id, published: true },
    }),
    {
      onSuccess: () => {
        setShowModal(false);
        toast("Assignments published.");
      },
      onError: (error) => setRefusal(apiErrorMessage(error)),
    },
    ["/api/admin/recruitments/all"],
  );

  if (recruitment.assignmentsPublished === true) {
    return (
      <p className="mt-4" data-testid={`${testIdPrefix}-published`}>
        Assignments are published.{" "}
        <Link to={`/recruitments/${recruitment.id}/assignments`}>
          Open the assignments page
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="mt-4" data-testid={testIdPrefix}>
      <Button
        variant="outline-dark"
        onClick={() => {
          setRefusal(null);
          setShowModal(true);
        }}
        data-testid={`${testIdPrefix}-button`}
      >
        Publish Assignments
      </Button>
      <Modal
        show={showModal}
        onHide={() => setShowModal(false)}
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
            onClick={() => setShowModal(false)}
            data-testid={`${testIdPrefix}-cancel`}
          >
            No
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
