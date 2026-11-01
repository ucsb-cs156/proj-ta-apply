import { Button } from "react-bootstrap";
import { toast } from "react-toastify";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { useBackendMutation } from "main/utils/useBackend";
import {
  ALLOCATIONS_HIDDEN_MESSAGE,
  ALLOCATIONS_HIDDEN_TOAST,
  ALLOCATIONS_SHOWN_MESSAGE,
  ALLOCATIONS_SHOWN_TOAST,
  HIDE_ALLOCATIONS_LABEL,
  RELEASE_ADVICE,
  RELEASE_ALL_LABEL,
  RELEASED_ALL_TOAST,
  SHOW_ALLOCATIONS_LABEL,
  WITHDRAW_ALL_LABEL,
  WITHDREW_ALL_TOAST,
} from "main/utils/allocations";

type AllocationVisibilityPanelProps = {
  recruitment: Recruitment;
  testIdPrefix?: string;
};

/**
 * The Faculty visibility panel under the hiring target on the Recruitment Courses page (issues
 * #178 and #224). Two controls: releasing (or withdrawing) every course's allocation to its own
 * instructor at once, and the global switch that shows every course's allocation to every faculty
 * member. Individual courses are released from the Released to faculty column of the table. The
 * backend records each change in the recruitment's audit trail; re-reading the recruitment and
 * course lists updates this panel, the table and the admin cards.
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
        toast(nextVisible ? ALLOCATIONS_SHOWN_TOAST : ALLOCATIONS_HIDDEN_TOAST),
    },
    ["/api/admin/recruitments/all"],
  );

  const releaseAll = useBackendMutation<boolean, unknown>(
    (released) => ({
      url: "/api/recruitmentcourses/allocationReleased/all",
      method: "PUT",
      params: { recruitmentId: recruitment.id, released },
    }),
    {
      onSuccess: (_data, released) =>
        toast(released ? RELEASED_ALL_TOAST : WITHDREW_ALL_TOAST),
    },
    ["/api/recruitmentcourses/all"],
  );

  return (
    <div className="mb-3" data-testid={testIdPrefix}>
      <h2 className="h5">Faculty visibility</h2>
      <p className="mb-2" data-testid={`${testIdPrefix}-advice`}>
        {RELEASE_ADVICE}
      </p>
      <div className="d-flex align-items-center flex-wrap gap-2 mb-2">
        <Button
          size="sm"
          variant="outline-primary"
          disabled={releaseAll.isPending}
          onClick={() => releaseAll.mutate(true)}
          data-testid={`${testIdPrefix}-release-all`}
        >
          {RELEASE_ALL_LABEL}
        </Button>
        <Button
          size="sm"
          variant="outline-secondary"
          disabled={releaseAll.isPending}
          onClick={() => releaseAll.mutate(false)}
          data-testid={`${testIdPrefix}-withdraw-all`}
        >
          {WITHDRAW_ALL_LABEL}
        </Button>
      </div>
      <div className="d-flex align-items-center flex-wrap gap-2">
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
    </div>
  );
}
