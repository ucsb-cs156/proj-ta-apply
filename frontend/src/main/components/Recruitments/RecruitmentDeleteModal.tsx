import Modal from "react-bootstrap/Modal";
import { Button } from "react-bootstrap";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";

type RecruitmentDeleteModalProps = {
  /** The recruitment being deleted, or null when the modal is closed. */
  recruitment: Recruitment | null;
  /** How many applications it has on file, which go with it. */
  applicationCount: number;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Confirmation before deleting a recruitment, which takes its course list and every application to
 * it along (the database cascades). Worded to make sure (issue #108), with the number of
 * applications at stake and a nudge towards the CSV download first.
 */
export default function RecruitmentDeleteModal({
  recruitment,
  applicationCount,
  onConfirm,
  onCancel,
}: RecruitmentDeleteModalProps): React.JSX.Element {
  const applications = `${applicationCount} ${applicationCount === 1 ? "application" : "applications"}`;
  return (
    <Modal
      show={recruitment !== null}
      onHide={onCancel}
      centered={true}
      data-testid="RecruitmentDeleteModal"
    >
      <Modal.Header closeButton>
        Delete the {recruitment?.type} recruitment for{" "}
        {recruitment ? yyyyqToQyy(recruitment.quarter) : ""}?
      </Modal.Header>
      <Modal.Body>
        <p data-testid="RecruitmentDeleteModal-body">
          Are you really sure? This permanently deletes ALL data for this
          recruitment, including the {applications} on file. Once they are gone,
          they cannot be retrieved. Please consider downloading a CSV of the
          data for this recruitment first if there is anything that should be
          saved.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="secondary"
          onClick={onCancel}
          data-testid="RecruitmentDeleteModal-cancel"
        >
          No, do not delete
        </Button>
        <Button
          variant="danger"
          onClick={onConfirm}
          data-testid="RecruitmentDeleteModal-confirm"
        >
          Yes, I am really sure. Delete this recruitment
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
