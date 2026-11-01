import { useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { toast } from "react-toastify";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { useBackendMutation } from "main/utils/useBackend";
import { STEPS_QUERY_KEY } from "main/utils/recruitmentSteps";
import {
  ALLOCATION_VISIBILITY_NOTE,
  ALLOCATION_VISIBILITY_OPTIONS,
  allocationVisibilityOf,
  allocationVisibilityToast,
  type AllocationVisibility,
} from "main/utils/allocations";

type AllocationVisibilityModalProps = {
  recruitment: Recruitment;
  show: boolean;
  onHide: () => void;
  testIdPrefix?: string;
};

/**
 * Chooses who may see a recruitment's allocations (issues #178 and #224): three radio buttons,
 * each explained in a sentence. Save sends the choice, which the backend records in the
 * recruitment's audit trail, then re-reads the recruitment list and closes; Cancel sends nothing.
 * Used from the Recruitment Courses page, and from the admin card's diagram later (issue #233).
 */
export default function AllocationVisibilityModal({
  recruitment,
  show,
  onHide,
  testIdPrefix = "AllocationVisibilityModal",
}: AllocationVisibilityModalProps): React.JSX.Element {
  const current = allocationVisibilityOf(recruitment);
  const [selected, setSelected] = useState<AllocationVisibility>(current);

  const mutation = useBackendMutation<AllocationVisibility, Recruitment>(
    (visibility) => ({
      url: "/api/admin/recruitments/allocationVisibility",
      method: "PUT",
      params: { id: recruitment.id, visibility },
    }),
    {
      onSuccess: (_data, visibility) => {
        toast(allocationVisibilityToast(visibility));
        onHide();
      },
    },
    ["/api/admin/recruitments/all", STEPS_QUERY_KEY],
  );

  return (
    <Modal
      show={show}
      onHide={onHide}
      onShow={() => setSelected(current)}
      centered
      data-testid={testIdPrefix}
    >
      <Modal.Header closeButton>
        <Modal.Title>Allocation Visibility</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>Who may see the allocations of this recruitment&apos;s courses?</p>
        <Form>
          {ALLOCATION_VISIBILITY_OPTIONS.map((option) => (
            <Form.Check
              key={option.value}
              type="radio"
              id={`${testIdPrefix}-${option.value}`}
              name={`${testIdPrefix}-visibility`}
              className="mb-2"
              checked={selected === option.value}
              onChange={() => setSelected(option.value)}
              label={
                <>
                  <strong>{option.name}.</strong> {option.explanation}
                </>
              }
              data-testid={`${testIdPrefix}-${option.value}`}
            />
          ))}
        </Form>
        <p className="text-muted mb-0" data-testid={`${testIdPrefix}-note`}>
          {ALLOCATION_VISIBILITY_NOTE}
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="secondary"
          onClick={onHide}
          data-testid={`${testIdPrefix}-cancel`}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(selected)}
          data-testid={`${testIdPrefix}-save`}
        >
          Save
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
