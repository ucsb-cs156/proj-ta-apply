import Modal from "react-bootstrap/Modal";
import { Button } from "react-bootstrap";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";

type RecruitmentDeleteModalProps = {
  /** The recruitment being deleted, or null when the modal is closed. */
  recruitment: Recruitment | null;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Confirmation before deleting a recruitment, which takes its course list with it. */
export default function RecruitmentDeleteModal({
  recruitment,
  onConfirm,
  onCancel,
}: RecruitmentDeleteModalProps): React.JSX.Element {
  return (
    <Modal
      show={recruitment !== null}
      onHide={onCancel}
      centered={true}
      data-testid="RecruitmentDeleteModal"
    >
      <Modal.Header closeButton>Delete Recruitment</Modal.Header>
      <Modal.Body>
        <p data-testid="RecruitmentDeleteModal-body">
          Are you sure you want to delete the {recruitment?.type} recruitment
          for {recruitment ? yyyyqToQyy(recruitment.quarter) : ""}?
        </p>
        <p className="text-muted mb-0">
          Its course list goes with it, including any courses you removed by
          hand.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="secondary"
          onClick={onCancel}
          data-testid="RecruitmentDeleteModal-cancel"
        >
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={onConfirm}
          data-testid="RecruitmentDeleteModal-confirm"
        >
          Delete
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
