import { useState } from "react";
import { Form } from "react-bootstrap";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { useBackendMutation } from "main/utils/useBackend";
import {
  isValidHiringTarget,
  OVER_ALLOCATED_MESSAGE,
} from "main/utils/allocations";

type HiringTargetPanelProps = {
  recruitment: Recruitment;
  /** The sum of the allocations of the recruitment's courses, removed ones left out. */
  allocatedSoFar: number;
  testIdPrefix?: string;
};

/**
 * The top of the Recruitment Courses page (issue #174): how many TAs or ULAs the recruitment
 * expects to hire, editable, and under it how many of those have been allocated to courses and
 * how many are left. A valid number is saved as soon as it is typed; an invalid one is never
 * sent, and the stored value comes back when the box loses focus.
 */
export default function HiringTargetPanel({
  recruitment,
  allocatedSoFar,
  testIdPrefix = "HiringTargetPanel",
}: HiringTargetPanelProps): React.JSX.Element {
  // What is in the box while it has focus; null means "show the stored value". Cleared on blur,
  // so an invalid entry reverts and a saved one is simply the stored value again.
  const [draft, setDraft] = useState<string | null>(null);

  const stored = recruitment.totalHiringTarget ?? 1;
  const type = recruitment.type;
  const left = stored - allocatedSoFar;

  const mutation = useBackendMutation<number, Recruitment>(
    (totalHiringTarget) => ({
      url: "/api/admin/recruitments/totalHiringTarget",
      method: "PUT",
      params: { id: recruitment.id, totalHiringTarget },
    }),
    {},
    ["/api/admin/recruitments/all"],
  );

  const onChange = (value: string) => {
    setDraft(value);
    if (isValidHiringTarget(value)) {
      mutation.mutate(Number(value));
    }
  };

  return (
    <div className="mb-3" data-testid={testIdPrefix}>
      <Form.Group
        className="d-flex align-items-center gap-2"
        controlId={`${testIdPrefix}-totalHiringTarget`}
      >
        <Form.Label className="mb-0">
          Total number of {type}s expected to be hired:{" "}
        </Form.Label>
        <Form.Control
          type="number"
          min={1}
          step={1}
          size="sm"
          style={{ width: "6em" }}
          value={draft ?? String(stored)}
          isInvalid={draft !== null && !isValidHiringTarget(draft)}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setDraft(null)}
          data-testid={`${testIdPrefix}-totalHiringTarget`}
        />
      </Form.Group>
      <div data-testid={`${testIdPrefix}-allocated`}>
        Allocated so far: {allocatedSoFar}
      </div>
      <div data-testid={`${testIdPrefix}-left`}>
        {type} allocations left to assign: {left}
      </div>
      {left < 0 && (
        <div className="text-danger" data-testid={`${testIdPrefix}-over`}>
          {OVER_ALLOCATED_MESSAGE}
        </div>
      )}
    </div>
  );
}
