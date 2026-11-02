import { useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { useBackendMutation } from "main/utils/useBackend";
import { apiErrorMessage } from "main/utils/apiError";

/** A fake application count must be between this many and {@link MAX_PER_COURSE} per course. */
export const MIN_PER_COURSE = 2;
export const MAX_PER_COURSE = 10;

export type FakeCoverage = "ALL" | "SPARSE";

type Props = {
  recruitmentId: string | undefined;
  /** The recruitment's courses that have not been removed; the count's range scales with it. */
  courseCount: number;
  testIdPrefix?: string;
};

/**
 * Developer Mode's controls for a recruitment's applications (issue #219): create fake
 * applications, which runs as a job, and delete the fake ones. Shown in the footer's Developer
 * Mode slot, so they appear only while Developer Mode is on.
 */
export default function FakeApplicationsControls({
  recruitmentId,
  courseCount,
  // Stryker disable next-line all : only a default test id
  testIdPrefix = "FakeApplicationsControls",
}: Props): React.JSX.Element {
  const queryClient = useQueryClient();
  const min = MIN_PER_COURSE * courseCount;
  const max = MAX_PER_COURSE * courseCount;

  const [showCreate, setShowCreate] = useState(false);
  const [showLaunched, setShowLaunched] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  // Stryker disable next-line all : both are set when the form opens
  const [count, setCount] = useState("");
  // Stryker disable next-line all : both are set when the form opens
  const [coverage, setCoverage] = useState<FakeCoverage>("ALL");

  const refreshApplications = () =>
    queryClient.invalidateQueries({
      queryKey: ["/api/admin/applications/all"],
    });

  const createMutation = useBackendMutation<
    { count: number; coverage: FakeCoverage },
    unknown
  >(
    ({ count, coverage }) => ({
      url: "/api/admin/developer/fakeApplications",
      method: "POST",
      params: { recruitmentId, count, coverage },
    }),
    {
      onSuccess: () => {
        setShowCreate(false);
        setShowLaunched(true);
      },
      onError: (error) => toast(apiErrorMessage(error)),
    },
  );

  const deleteMutation = useBackendMutation<void, { deleted: number }>(
    () => ({
      url: "/api/admin/developer/fakeApplications",
      method: "DELETE",
      params: { recruitmentId },
    }),
    {
      onSuccess: (result) => {
        setShowDelete(false);
        toast(
          `Deleted ${result.deleted} fake ${result.deleted === 1 ? "application" : "applications"}.`,
        );
        refreshApplications();
      },
      onError: (error) => toast(apiErrorMessage(error)),
    },
  );

  const openCreate = () => {
    // Two per course, which is also the least that may be asked for.
    setCount(String(MIN_PER_COURSE * courseCount));
    setCoverage("ALL");
    setShowCreate(true);
  };

  const countNumber = Number(count);
  const countValid =
    Number.isInteger(countNumber) && countNumber >= min && countNumber <= max;

  const closeLaunched = () => {
    setShowLaunched(false);
    refreshApplications();
  };

  return (
    <span data-testid={testIdPrefix}>
      <Button
        size="sm"
        variant="outline-warning"
        className="me-2"
        onClick={openCreate}
        data-testid={`${testIdPrefix}-create`}
      >
        Create Fake Applications
      </Button>
      <Button
        size="sm"
        variant="outline-danger"
        onClick={() => setShowDelete(true)}
        data-testid={`${testIdPrefix}-delete`}
      >
        Delete Fake Applications
      </Button>

      <Modal
        show={showCreate}
        onHide={() => setShowCreate(false)}
        centered
        data-testid={`${testIdPrefix}-create-modal`}
      >
        <Modal.Header closeButton>
          <Modal.Title>Create Fake Applications</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {courseCount === 0 ? (
            <p data-testid={`${testIdPrefix}-no-courses`}>
              This recruitment has no courses yet, so there is nothing for fake
              applicants to apply to.
            </p>
          ) : (
            <>
              <Form.Group className="mb-3" controlId="fake-applications-count">
                <Form.Label>How many applications</Form.Label>
                <Form.Control
                  type="number"
                  min={min}
                  max={max}
                  value={count}
                  onChange={(event) => setCount(event.target.value)}
                  isInvalid={!countValid}
                  data-testid={`${testIdPrefix}-count`}
                />
                <Form.Text data-testid={`${testIdPrefix}-count-help`}>
                  Between {min} and {max}: {MIN_PER_COURSE} to {MAX_PER_COURSE}{" "}
                  for each of this recruitment&apos;s {courseCount}{" "}
                  {courseCount === 1 ? "course" : "courses"}.
                </Form.Text>
              </Form.Group>
              <Form.Group>
                <Form.Check
                  type="radio"
                  id="fake-applications-coverage-all"
                  name="fake-applications-coverage"
                  label="Cover all courses with a reasonable number of applicants"
                  checked={coverage === "ALL"}
                  onChange={() => setCoverage("ALL")}
                  data-testid={`${testIdPrefix}-coverage-all`}
                />
                <Form.Check
                  type="radio"
                  id="fake-applications-coverage-sparse"
                  name="fake-applications-coverage"
                  label="Leave some courses with few or no applicants"
                  checked={coverage === "SPARSE"}
                  onChange={() => setCoverage("SPARSE")}
                  data-testid={`${testIdPrefix}-coverage-sparse`}
                />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="primary"
            disabled={
              courseCount === 0 || !countValid || createMutation.isPending
            }
            onClick={() =>
              createMutation.mutate({ count: countNumber, coverage })
            }
            data-testid={`${testIdPrefix}-create-confirm`}
          >
            Create Fake Applications
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShowCreate(false)}
            data-testid={`${testIdPrefix}-create-cancel`}
          >
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showLaunched}
        onHide={closeLaunched}
        centered
        data-testid={`${testIdPrefix}-launched-modal`}
      >
        <Modal.Header closeButton>
          <Modal.Title>Fake applications are being entered</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Fake applications are being entered; see the{" "}
            <Link to="/admin/jobs" data-testid={`${testIdPrefix}-jobs-link`}>
              Jobs page
            </Link>{" "}
            for details. Refresh the page a few times, and they should all
            appear.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={closeLaunched}
            data-testid={`${testIdPrefix}-launched-close`}
          >
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showDelete}
        onHide={() => setShowDelete(false)}
        centered
        data-testid={`${testIdPrefix}-delete-modal`}
      >
        <Modal.Header closeButton>
          <Modal.Title>Delete Fake Applications</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            This deletes every fake application in this recruitment, with its
            change history. Real applications and the admin&apos;s test
            applications are not touched. This cannot be undone.
          </p>
          <p className="mb-0">Are you sure?</p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="danger"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
            data-testid={`${testIdPrefix}-delete-confirm`}
          >
            Yes, delete them
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShowDelete(false)}
            data-testid={`${testIdPrefix}-delete-cancel`}
          >
            No, keep them
          </Button>
        </Modal.Footer>
      </Modal>
    </span>
  );
}
