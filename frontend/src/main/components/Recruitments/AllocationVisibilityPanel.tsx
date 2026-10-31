import { Button } from "react-bootstrap";
import { toast } from "react-toastify";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { useBackendMutation } from "main/utils/useBackend";
import {
  ALLOCATIONS_HIDDEN_MESSAGE,
  ALLOCATIONS_SHOWN_MESSAGE,
  HIDE_ALLOCATIONS_LABEL,
  SHOW_ALLOCATIONS_LABEL,
} from "main/utils/allocations";

type AllocationVisibilityPanelProps = {
  recruitment: Recruitment;
  testIdPrefix?: string;
};

/**
 * Under the hiring target on the Recruitment Courses page (issue #178): whether the per-course
 * allocations are currently hidden from or shown to faculty, and a button that flips it. The
 * backend records the flip in the recruitment's audit trail, and re-reading the recruitment list
 * updates this panel and the admin cards.
 */
export default function AllocationVisibilityPanel({
  recruitment,
  testIdPrefix = "AllocationVisibilityPanel",
}: AllocationVisibilityPanelProps): React.JSX.Element {
  const visible = recruitment.allocationsVisibleToFaculty === true;

  const mutation = useBackendMutation<boolean, Recruitment>(
    (nextVisible) => ({
      url: "/api/admin/recruitments/allocationsVisibleToFaculty",
      method: "PUT",
      params: { id: recruitment.id, visible: nextVisible },
    }),
    {
      onSuccess: (_data, nextVisible) =>
        toast(
          nextVisible
            ? "Allocations are now shown to faculty."
            : "Allocations are now hidden from faculty.",
        ),
    },
    ["/api/admin/recruitments/all"],
  );

  return (
    <div
      className="mb-3 d-flex align-items-center flex-wrap gap-2"
      data-testid={testIdPrefix}
    >
      <span data-testid={`${testIdPrefix}-message`}>
        {visible ? ALLOCATIONS_SHOWN_MESSAGE : ALLOCATIONS_HIDDEN_MESSAGE}
      </span>
      <Button
        size="sm"
        variant={visible ? "outline-secondary" : "outline-primary"}
        onClick={() => mutation.mutate(!visible)}
        data-testid={`${testIdPrefix}-toggle`}
      >
        {visible ? HIDE_ALLOCATIONS_LABEL : SHOW_ALLOCATIONS_LABEL}
      </Button>
    </div>
  );
}
