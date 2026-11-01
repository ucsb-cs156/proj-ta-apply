import { useState } from "react";
import { Button } from "react-bootstrap";
import { Link } from "react-router";
import PublishAssignmentsModal from "main/components/Recruitments/PublishAssignmentsModal";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";

type PublishAssignmentsPanelProps = {
  recruitment: Recruitment;
  testIdPrefix?: string;
};

/**
 * The very bottom of the Recruitment Courses page (issue #180): the Publish Assignments button and
 * its confirmation, or, once published, a line saying so with a link to the assignments page.
 */
export default function PublishAssignmentsPanel({
  recruitment,
  testIdPrefix = "PublishAssignmentsPanel",
}: PublishAssignmentsPanelProps): React.JSX.Element {
  const [showModal, setShowModal] = useState(false);

  if (recruitment.assignmentsPublished === true) {
    return (
      <p className="mt-4" data-testid={`${testIdPrefix}-published`}>
        Assignments are published.{" "}
        <Link to={`/recruitments/${recruitment.id}/assignments`}>
          Open the assignments page
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="mt-4" data-testid={testIdPrefix}>
      <Button
        variant="outline-dark"
        onClick={() => setShowModal(true)}
        data-testid={`${testIdPrefix}-button`}
      >
        Publish Assignments
      </Button>
      <PublishAssignmentsModal
        recruitment={recruitment}
        show={showModal}
        onHide={() => setShowModal(false)}
        testIdPrefix={testIdPrefix}
      />
    </div>
  );
}
