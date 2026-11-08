import { useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { Link } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "react-toastify";
import { apiErrorMessage } from "main/utils/apiError";
import {
  FAKE_RANKING_SCOPES,
  type FakeRankingScope,
} from "main/utils/fakeRankings";

type FakeRankingsModalProps = {
  /**
   * The recruitment whose courses get rankings. Since issue #385 the modal is offered on one page
   * only, the recruitment's own Assignments page; it used to take a list, for the Combined
   * Allocation page's one-click job per recruitment of the quarter, which that issue removed.
   */
  recruitmentId: number | string;
  /** Something the page wants said about the recruitment, if anything (no applicants, say). */
  note?: string;
  onHide: () => void;
  testIdPrefix?: string;
};

/**
 * Developer Mode's Create Fake Rankings (issue #220): picks whether some or all of the courses get
 * rankings, and whether applicants who did not express interest are ranked too, then launches the
 * job that ranks candidates as the faculty would. Once launched it says where to follow the job.
 * Mounted only while open.
 */
export default function FakeRankingsModal({
  recruitmentId,
  note,
  onHide,
  // Stryker disable next-line all : only a default test id
  testIdPrefix = "FakeRankingsModal",
}: FakeRankingsModalProps): React.JSX.Element {
  const [scope, setScope] = useState<FakeRankingScope>("ALL");
  const [includeNotInterested, setIncludeNotInterested] = useState(false);
  const [launched, setLaunched] = useState(false);
  const queryClient = useQueryClient();

  const launch = useMutation({
    mutationFn: () =>
      axios({
        url: "/api/admin/developer/fakeRankings",
        method: "POST",
        params: { recruitmentId, scope, includeNotInterested },
      }),
    onSuccess: () => setLaunched(true),
    onError: (error) => toast(apiErrorMessage(error)),
    // Stryker disable next-line all : cache invalidation is not observable from here
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["/api/instructor/recruitments/admin-course-rankings"],
      }),
    retry: false,
  });

  if (launched) {
    return (
      <Modal
        show
        onHide={onHide}
        centered
        data-testid={`${testIdPrefix}-launched-modal`}
      >
        <Modal.Header closeButton>
          <Modal.Title>Fake rankings are being entered</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            The fake rankings are being entered by a background job. See the{" "}
            <Link to="/admin/jobs" data-testid={`${testIdPrefix}-jobs-link`}>
              Jobs page
            </Link>{" "}
            to follow it. The ranking counts update once it has finished.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={onHide}
            data-testid={`${testIdPrefix}-launched-close`}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    );
  }

  return (
    <Modal show onHide={onHide} centered data-testid={`${testIdPrefix}-modal`}>
      <Modal.Header closeButton>
        <Modal.Title>Create Fake Rankings</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>
          Ranks candidates as the faculty would: for each chosen course, as many
          interested candidates as its ranking target asks for. Courses that
          already have rankings are left alone.
        </p>
        {note !== undefined && (
          <p data-testid={`${testIdPrefix}-note`}>{note}</p>
        )}
        <Form.Group className="mb-3" data-testid={`${testIdPrefix}-scope`}>
          <Form.Label>Courses to rank</Form.Label>
          {FAKE_RANKING_SCOPES.map((choice) => (
            <Form.Check
              key={choice.value}
              type="radio"
              name={`${testIdPrefix}-scope`}
              id={`${testIdPrefix}-scope-${choice.value}`}
              label={choice.label}
              checked={scope === choice.value}
              onChange={() => setScope(choice.value)}
              data-testid={`${testIdPrefix}-scope-${choice.value}`}
            />
          ))}
        </Form.Group>
        <Form.Check
          type="checkbox"
          id={`${testIdPrefix}-not-interested`}
          label="Also rank one or two applicants who did not express interest in the course"
          checked={includeNotInterested}
          onChange={(event) => setIncludeNotInterested(event.target.checked)}
          data-testid={`${testIdPrefix}-not-interested`}
        />
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
          variant="success"
          disabled={launch.isPending}
          onClick={() => launch.mutate()}
          data-testid={`${testIdPrefix}-create`}
        >
          Create Fake Rankings
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
