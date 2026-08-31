import Modal from "react-bootstrap/Modal";
import { Button } from "react-bootstrap";

type CourseDeleteModalProps = {
  /** The course being deleted, or null when the modal is closed. */
  courseId: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Confirmation before removing a course. Modeled on the delete modals in proj-scaffold, with the
 * course named in the body so an admin can see which row they are about to remove.
 */
export default function CourseDeleteModal({
  courseId,
  onConfirm,
  onCancel,
}: CourseDeleteModalProps): React.JSX.Element {
  return (
    <Modal
      show={courseId !== null}
      onHide={onCancel}
      centered={true}
      data-testid="CourseDeleteModal"
    >
      <Modal.Header closeButton>Delete Course</Modal.Header>
      <Modal.Body>
        <p data-testid="CourseDeleteModal-body">
          Are you sure you want to delete{" "}
          <span style={{ whiteSpace: "pre", fontFamily: "monospace" }}>
            {courseId}
          </span>
          ?
        </p>
        <p className="text-muted mb-0">
          Its TA and ULA settings will be lost. Populating a quarter in which it
          was offered will add it back with both boxes unticked.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="secondary"
          onClick={onCancel}
          data-testid="CourseDeleteModal-cancel"
        >
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={onConfirm}
          data-testid="CourseDeleteModal-confirm"
        >
          Delete
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
