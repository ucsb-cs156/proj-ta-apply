import { Badge, Button, Card, OverlayTrigger, Tooltip } from "react-bootstrap";
import { Link } from "react-router";
import RecruitmentStepsPanel from "main/components/Recruitments/RecruitmentStepsPanel";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { TrashIcon } from "main/components/Common/Icons";
import { applicationsText } from "main/utils/adminApplications";
import { DATE_KEYS } from "main/utils/recruitmentSort";
import type {
  RecruitmentStepAction,
  RecruitmentStepsData,
} from "main/utils/recruitmentSteps";
import { useRememberedOpen } from "main/utils/useRememberedOpen";

export const DELETE_TOOLTIP = "Delete this Recruitment";

/**
 * The localStorage keys are this prefix, the quarter as yyyyq and the type, such as
 * "adminRecruitmentCard.20261.TA", so a recreated recruitment keeps the setting.
 */
export const RECRUITMENT_CARD_STORAGE_PREFIX = "adminRecruitmentCard.";

type RecruitmentCardLayoutProps = {
  recruitment: Recruitment;
  applicationCount?: number;
  /** The recruitment's live steps; the panel is left out while they are not known. */
  steps?: RecruitmentStepsData;
  /** Whether the steps panel opens expanded (the most recent TA and ULA recruitments do). */
  defaultExpanded?: boolean;
  /**
   * Whether the card itself starts open the first time this browser shows it (issue #379); after
   * that it is as the admin left it. Open unless told otherwise.
   */
  defaultOpen?: boolean;
  onChangeDeadline: (recruitment: Recruitment) => void;
  onDeleteRequested: (recruitment: Recruitment) => void;
  onAction?: (action: RecruitmentStepAction) => void;
  onNavigate?: (href: string) => void;
  testIdPrefix?: string;
};

/**
 * The admin recruitment card as docs/design/AdminUserInterfaceDesign.md lays it out, nested since
 * issue #379 inside its quarter's card (AdminQuarterCard), so its header names only the type: the
 * top row is one button that opens and closes the card (a caret, "TA" or "ULA" in the large font,
 * the status badges and the application count; aria-expanded for keyboard users) with the trash
 * icon beside it, outside the toggle. Open, the card shows the dates panel with its Change button
 * beside the Faculty Ranking Deadline; the live Recruitment Steps diagram in its collapsible
 * panel; and the button row: Courses, Draft Applications, Applications, Make Assignments (the admin
 * page where candidates are assigned to slots) and View Assignments (the read-only assignments
 * page), and Download Rankings CSV once faculty rankings have been opened (issues #358, #317),
 * and, pushed to the right edge of the row and apart from those workflow buttons, Change History
 * (issue #390), the page of every change to the recruitment itself. Everything else the old card
 * footer offered is reached through the diagram or has moved to the Courses and Applications
 * pages. Designed in Storybook first (issue #230); issue #233 puts it on the home page. Whether the
 * card is open is remembered in this browser per quarter and type (useRememberedOpen).
 */
export default function RecruitmentCardLayout({
  recruitment,
  applicationCount = 0,
  steps,
  defaultExpanded = false,
  defaultOpen = true,
  onChangeDeadline,
  onDeleteRequested,
  onAction,
  onNavigate,
  testIdPrefix = "RecruitmentCardLayout",
}: RecruitmentCardLayoutProps): React.JSX.Element {
  const id = (suffix: string) => `${testIdPrefix}-${suffix}`;
  const applicationsOpen = recruitment.applicationStatus === "OPEN";
  const reviewsOpen = recruitment.reviewStatus === "Open";
  const [open, toggle] = useRememberedOpen(
    `${RECRUITMENT_CARD_STORAGE_PREFIX}${recruitment.quarter}.${recruitment.type}`,
    defaultOpen,
  );
  return (
    <Card className="mb-3 w-100" data-testid={id("card")}>
      <Card.Header className="d-flex align-items-center p-0">
        <button
          type="button"
          className="btn btn-link flex-grow-1 text-start text-decoration-none text-reset d-flex align-items-center flex-wrap gap-3 px-3 py-2"
          aria-expanded={open}
          onClick={toggle}
          data-testid={id("toggle")}
        >
          <span aria-hidden="true" data-testid={id("caret")}>
            {open ? "▾" : "▸"}
          </span>
          <strong className="fs-5" data-testid={id("type")}>
            {recruitment.type}
          </strong>
          <Badge
            bg={applicationsOpen ? "success" : "secondary"}
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
        </button>
        <OverlayTrigger
          placement="top"
          overlay={
            <Tooltip id={id("delete-tooltip")}>{DELETE_TOOLTIP}</Tooltip>
          }
        >
          <Button
            variant="outline-danger"
            size="sm"
            className="me-3"
            aria-label={DELETE_TOOLTIP}
            onClick={() => onDeleteRequested(recruitment)}
            data-testid={id("delete-button")}
          >
            <TrashIcon />
          </Button>
        </OverlayTrigger>
      </Card.Header>
      {open && (
        <>
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
                <dd
                  className="mb-1"
                  data-testid={id("facultyReviewOpeningDate")}
                >
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
              className="btn btn-outline-info"
              to={`/admin/recruitments/${recruitment.id}/draft-applications`}
              data-testid={id("draft-applications-button")}
            >
              Draft Applications
            </Link>
            <Link
              className="btn btn-info"
              to={`/admin/recruitments/${recruitment.id}/applications`}
              data-testid={id("applications-button")}
            >
              Applications
            </Link>
            {/* Issue #317: the two assignment pages, named as steps 8 and 9 of the diagram name them. */}
            <Link
              className="btn btn-outline-success"
              to={`/admin/recruitments/${recruitment.id}/assignments`}
              data-testid={id("make-assignments-button")}
            >
              Make Assignments
            </Link>
            <Link
              className="btn btn-success"
              to={`/recruitments/${recruitment.id}/assignments`}
              data-testid={id("view-assignments-button")}
            >
              View Assignments
            </Link>
            {/* The faculty rankings exist only once the review has been opened (issue #358). */}
            {recruitment.reviewStatus !== "NotStarted" && (
              <a
                className="btn btn-outline-primary"
                href={`/api/admin/rankings/csv?recruitmentId=${recruitment.id}`}
                download={`rankings-${recruitment.id}.csv`}
                data-testid={id("rankings-csv-button")}
              >
                Download Rankings CSV
              </a>
            )}
            {/* Issue #390: the recruitment's own change history, flush right, apart from the workflow. */}
            <Link
              className="btn btn-outline-secondary ms-auto"
              to={`/admin/recruitments/${recruitment.id}/history`}
              data-testid={id("change-history-button")}
            >
              Change History
            </Link>
          </Card.Footer>
        </>
      )}
    </Card>
  );
}
