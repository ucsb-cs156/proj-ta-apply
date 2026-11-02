import { useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { Link } from "react-router";
import { toast } from "react-toastify";
import { useBackendMutation } from "main/utils/useBackend";
import { apiErrorMessage } from "main/utils/apiError";
import {
  FAKE_RANKING_SCOPES,
  type FakeRankingScope,
} from "main/utils/fakeRankings";

type FakeRankingsModalProps = {
  recruitmentId: number | string;
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
  onHide,
  // Stryker disable next-line all : only a default test id
  testIdPrefix = "FakeRankingsModal",
}: FakeRankingsModalProps): React.JSX.Element {
  const [scope, setScope] = useState<FakeRankingScope>("ALL");
  const [includeNotInterested, setIncludeNotInterested] = useState(false);
  const [launched, setLaunched] = useState(false);

  const launch = useBackendMutation<
    { scope: FakeRankingScope; includeNotInterested: boolean },
    unknown
  >(
    (params) => ({
      url: "/api/admin/developer/fakeRankings",
      method: "POST",
      params: { recruitmentId, ...params },
    }),
    {
      onSuccess: () => setLaunched(true),
      onError: (error) => toast(apiErrorMessage(error)),
    },
    ["/api/instructor/recruitments/admin-course-rankings"],
  );

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
          onClick={() => launch.mutate({ scope, includeNotInterested })}
          data-testid={`${testIdPrefix}-create`}
        >
          Create Fake Rankings
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
