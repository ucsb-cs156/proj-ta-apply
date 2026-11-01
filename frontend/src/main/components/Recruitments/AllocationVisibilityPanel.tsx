import { useState } from "react";
import { Button } from "react-bootstrap";
import AllocationVisibilityModal from "main/components/Recruitments/AllocationVisibilityModal";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import {
  allocationVisibilityName,
  allocationVisibilityOf,
} from "main/utils/allocations";

type AllocationVisibilityPanelProps = {
  recruitment: Recruitment;
  testIdPrefix?: string;
};

/**
 * The line under the hiring target on the Recruitment Courses page (issues #178 and #224) that says
 * who may see the allocations, with a Change button that opens the Allocation Visibility modal.
 */
export default function AllocationVisibilityPanel({
  recruitment,
  testIdPrefix = "AllocationVisibilityPanel",
}: AllocationVisibilityPanelProps): React.JSX.Element {
  const [showModal, setShowModal] = useState(false);

  return (
    <div
      className="d-flex align-items-center flex-wrap gap-2 mb-3"
      data-testid={testIdPrefix}
    >
      <span data-testid={`${testIdPrefix}-message`}>
        Allocation visibility:{" "}
        <strong>
          {allocationVisibilityName(allocationVisibilityOf(recruitment))}
        </strong>
        .
      </span>
      <Button
        size="sm"
        variant="outline-primary"
        onClick={() => setShowModal(true)}
        data-testid={`${testIdPrefix}-change`}
      >
        Change
      </Button>
      <AllocationVisibilityModal
        recruitment={recruitment}
        show={showModal}
        onHide={() => setShowModal(false)}
        testIdPrefix={`${testIdPrefix}-modal`}
      />
    </div>
  );
}
