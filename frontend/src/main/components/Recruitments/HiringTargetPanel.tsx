import { useState } from "react";
import { Form, Table } from "react-bootstrap";
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
  /** The view-only Courses page (issue #278): the target is shown as text, not a box. */
  readOnly?: boolean;
};

/**
 * The top of the Recruitment Courses page (issue #174): how many TAs or ULAs the recruitment
 * expects to hire, and under it how many of those have been allocated to courses and how many are
 * left. Since issue #320 the three are a small two-column table, the labels on the left and the
 * numbers on the right, right-aligned, with no header row and nothing to sort.
 *
 * The target itself is a box only when the panel is not read-only; the admin pages have shown it
 * read-only since issue #358, when the box moved to the Budget page. A valid number is saved as
 * soon as it is typed; an invalid one is never sent, and the stored value comes back when the box
 * loses focus.
 */
export default function HiringTargetPanel({
  recruitment,
  allocatedSoFar,
  testIdPrefix = "HiringTargetPanel",
  readOnly = false,
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

  const targetLabel = `Total number of ${type}s expected to be hired:`;
  const boxId = `${testIdPrefix}-totalHiringTarget`;

  /**
   * One row: its label on the left, its number (or the box, which keeps the plain
   * `-totalHiringTarget` test id) on the right.
   */
  const row = (
    id: string,
    label: React.ReactNode,
    value: React.ReactNode,
  ): React.JSX.Element => (
    <tr data-testid={`${testIdPrefix}-${id}-row`}>
      <td data-testid={`${testIdPrefix}-${id}-label`}>{label}</td>
      <td className="text-end" data-testid={`${testIdPrefix}-${id}-value`}>
        {value}
      </td>
    </tr>
  );

  return (
    <div className="mb-3" data-testid={testIdPrefix}>
      <Table
        size="sm"
        borderless
        className="w-auto mb-2 align-middle"
        data-testid={`${testIdPrefix}-table`}
      >
        <tbody>
          {readOnly
            ? row("totalHiringTarget", targetLabel, stored)
            : row(
                "totalHiringTarget",
                <Form.Label htmlFor={boxId} className="mb-0">
                  {targetLabel}
                </Form.Label>,
                <Form.Control
                  id={boxId}
                  type="number"
                  min={1}
                  step={1}
                  size="sm"
                  // A block, so it is pushed to the right edge of the numbers column by its margin.
                  className="ms-auto"
                  style={{ width: "6em" }}
                  value={draft ?? String(stored)}
                  isInvalid={draft !== null && !isValidHiringTarget(draft)}
                  onChange={(e) => onChange(e.target.value)}
                  onBlur={() => setDraft(null)}
                  data-testid={boxId}
                />,
              )}
          {row("allocated", "Allocated so far:", allocatedSoFar)}
          {row("left", `${type} allocations left to assign:`, left)}
        </tbody>
      </Table>
      {left < 0 && (
        <div className="text-danger" data-testid={`${testIdPrefix}-over`}>
          {OVER_ALLOCATED_MESSAGE}
        </div>
      )}
    </div>
  );
}
