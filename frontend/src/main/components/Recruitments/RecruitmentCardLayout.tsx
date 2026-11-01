import { Badge, Button, Card, OverlayTrigger, Tooltip } from "react-bootstrap";
import { Link } from "react-router";
import RecruitmentStepsPanel from "main/components/Recruitments/RecruitmentStepsPanel";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { TrashIcon } from "main/components/Common/Icons";
import { applicationsText } from "main/utils/adminApplications";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import { DATE_KEYS } from "main/utils/recruitmentSort";
import type {
  RecruitmentStepAction,
  RecruitmentStepsData,
} from "main/utils/recruitmentSteps";

export const DELETE_TOOLTIP = "Delete this Recruitment";

type RecruitmentCardLayoutProps = {
  recruitment: Recruitment;
  applicationCount?: number;
  /** The recruitment's live steps; the panel is left out while they are not known. */
  steps?: RecruitmentStepsData;
  /** Whether the steps panel opens expanded (the most recent TA and ULA recruitments do). */
  defaultExpanded?: boolean;
  onChangeDeadline: (recruitment: Recruitment) => void;
  onDeleteRequested: (recruitment: Recruitment) => void;
  onAction?: (action: RecruitmentStepAction) => void;
  onNavigate?: (href: string) => void;
  testIdPrefix?: string;
};

/**
 * The admin recruitment card as docs/design/AdminUserInterfaceDesign.md lays it out: the header
 * with quarter, type and status badges; the dates panel with its Change button beside the Faculty
 * Ranking Deadline; the live Recruitment Steps diagram in its collapsible panel; and the two
 * remaining buttons, Courses and Applications. Everything the old card footer offered is reached
 * through the diagram or has moved to the Courses and Applications pages. Designed in Storybook
 * first (issue #230); issue #233 puts it on the home page.
 */
export default function RecruitmentCardLayout({
  recruitment,
  applicationCount = 0,
  steps,
  defaultExpanded = false,
  onChangeDeadline,
  onDeleteRequested,
  onAction,
  onNavigate,
  testIdPrefix = "RecruitmentCardLayout",
}: RecruitmentCardLayoutProps): React.JSX.Element {
  const id = (suffix: string) => `${testIdPrefix}-${suffix}`;
  const open = recruitment.applicationStatus === "OPEN";
  const reviewsOpen = recruitment.reviewStatus === "Open";
  return (
    <Card className="mb-3 w-100" data-testid={id("card")}>
      <Card.Header className="d-flex align-items-center flex-wrap gap-3">
        <strong className="fs-5" data-testid={id("quarter")}>
          {yyyyqToQyy(recruitment.quarter)}
        </strong>
        <span data-testid={id("type")}>{recruitment.type}</span>
        <Badge
          bg={open ? "success" : "secondary"}
          data-testid={id("applicationStatus")}
        >
          {recruitment.applicationStatus}
        </Badge>
        <Badge
          bg={reviewsOpen ? "success" : "secondary"}
          data-testid={id("reviewStatus")}
        >
          Faculty Reviews: {recruitment.reviewStatus}
        </Badge>
        {recruitment.assignmentsPublished === true && (
          <Badge bg="info" data-testid={id("assignmentsPublished")}>
            Assignments Published
          </Badge>
        )}
        <span data-testid={id("applications")}>
          {applicationsText(applicationCount)}
        </span>
        <OverlayTrigger
          placement="top"
          overlay={
            <Tooltip id={id("delete-tooltip")}>{DELETE_TOOLTIP}</Tooltip>
          }
        >
          <Button
            variant="outline-danger"
            size="sm"
            className="ms-auto"
            aria-label={DELETE_TOOLTIP}
            onClick={() => onDeleteRequested(recruitment)}
            data-testid={id("delete-button")}
          >
            <TrashIcon />
          </Button>
        </OverlayTrigger>
      </Card.Header>
      <Card.Body>
        <dl className="row mb-2" data-testid={id("dates")}>
          {DATE_KEYS.map(({ key, label }) => (
            <div className="col-sm-6 d-flex" key={key}>
              <dt className="me-2">{label}:</dt>
              <dd className="mb-1" data-testid={id(key)}>
                {recruitment[key] ?? ""}
              </dd>
            </div>
          ))}
          <div className="col-sm-6 d-flex">
            <dt className="me-2">Faculty Reviews Opened:</dt>
            <dd className="mb-1" data-testid={id("facultyReviewOpeningDate")}>
              {recruitment.facultyReviewOpeningDate ?? ""}
            </dd>
          </div>
          <div className="col-sm-6 d-flex align-items-start">
            <dt className="me-2">Faculty Ranking Deadline:</dt>
            <dd className="mb-1" data-testid={id("facultyRankingDeadline")}>
              {recruitment.facultyRankingDeadline ?? ""}
            </dd>
            <Button
              variant="link"
              size="sm"
              className="p-0 ms-2"
              onClick={() => onChangeDeadline(recruitment)}
              data-testid={id("edit-faculty-ranking-deadline")}
            >
              Change
            </Button>
          </div>
        </dl>
        {steps !== undefined && (
          <RecruitmentStepsPanel
            steps={steps}
            defaultExpanded={defaultExpanded}
            onAction={onAction}
            onNavigate={onNavigate}
            testIdPrefix={id("steps")}
          />
        )}
      </Card.Body>
      <Card.Footer className="d-flex flex-wrap gap-2">
        <Link
          className="btn btn-primary"
          to={`/admin/recruitments/${recruitment.id}/courses`}
          data-testid={id("courses-button")}
        >
          Courses
        </Link>
        <Link
          className="btn btn-info"
          to={`/admin/recruitments/${recruitment.id}/applications`}
          data-testid={id("applications-button")}
        >
          Applications
        </Link>
      </Card.Footer>
    </Card>
  );
}
