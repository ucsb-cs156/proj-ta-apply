import { Badge, Button, Card, OverlayTrigger, Tooltip } from "react-bootstrap";
import { Link } from "react-router";
import type { Application } from "main/components/Applications/ApplicationTable";
import type { StudentRecruitment } from "main/components/Recruitments/RecruitmentTable";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import { DATE_KEYS } from "main/utils/recruitmentSort";
import { applicationFor } from "main/utils/studentRecruitments";
import {
  DRAFT_WARNING,
  draftFor,
  type DraftApplication,
} from "main/utils/draftApplications";

/** The button for an applicant who cancelled while applications are still open (issue #318). */
export const RESTART_LABEL = "Start a new application";

/** On the greyed-out Apply button of a closed recruitment. */
export const NOT_OPEN_TOOLTIP = "Applications are not open yet";

type StudentRecruitmentCardsProps = {
  /** The open and recently closed recruitments, in the order to show them. */
  recruitments: StudentRecruitment[];
  /** The student's own applications, to tell which recruitments they applied to. */
  applications: Application[];
  /** The student's drafts: applications started and not yet submitted (issue #270). */
  drafts?: DraftApplication[];
  onCancelRequested?: (
    application: Application,
    recruitment: StudentRecruitment,
  ) => void;
  testIdPrefix?: string;
};

/**
 * One card per current or recent recruitment, as a student sees it (issue #107): the same header
 * and dates as the admin's cards, a badge saying whether they have applied, and the buttons that
 * fit: Apply to be a TA (or ULA) or, for an application begun and not submitted, Continue editing
 * draft application with a warning that it is not yet complete (issue #270); View submitted
 * application or View/Comment; and Cancel my Application. After a cancellation, while applications
 * are open, Start a new application begins again from scratch (issue #318).
 */
export default function StudentRecruitmentCards({
  recruitments,
  applications,
  // Stryker disable next-line all : don't test default value of empty list
  drafts = [],
  onCancelRequested = () => {},
  testIdPrefix = "StudentRecruitmentCards",
}: StudentRecruitmentCardsProps): React.JSX.Element {
  const list = Array.isArray(recruitments) ? recruitments : [];
  const applicationList = Array.isArray(applications) ? applications : [];
  // Stryker disable next-line all : don't test default value of empty list
  const draftList = Array.isArray(drafts) ? drafts : [];

  return (
    <div data-testid={testIdPrefix}>
      {list.map((recruitment) => {
        const id = (suffix: string) =>
          `${testIdPrefix}-card-${recruitment.id}-${suffix}`;
        const open = recruitment.applicationStatus === "OPEN";
        const application = applicationFor(applicationList, recruitment.id);
        const cancelled = application?.status === "CANCELLED";
        const draft = draftFor(draftList, recruitment.id);
        // Nothing submitted, or only a cancelled application: the applicant may begin one while
        // applications are open (issue #318).
        const mayApply = application === undefined || cancelled;
        const applyLabel = `Apply to be a ${recruitment.type}`;
        const badge = cancelled
          ? { bg: "secondary", text: "Application cancelled" }
          : application
            ? { bg: "success", text: "Application on File" }
            : draft
              ? { bg: "warning", text: "Draft application, not submitted" }
              : { bg: "secondary", text: "No application submitted yet" };
        return (
          <Card
            key={recruitment.id}
            className="mb-3"
            style={{ maxWidth: "48rem" }}
            data-testid={id("card")}
          >
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
                bg={badge.bg}
                text={badge.bg === "warning" ? "dark" : undefined}
                className="ms-auto"
                data-testid={id("applied")}
              >
                {badge.text}
              </Badge>
            </Card.Header>
            <Card.Body>
              <dl className="row mb-0">
                {DATE_KEYS.map(({ key, label }) => (
                  <div className="col-sm-6 d-flex" key={key}>
                    <dt className="me-2">{label}:</dt>
                    <dd className="mb-1" data-testid={id(key)}>
                      {recruitment[key] ?? ""}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card.Body>
            <Card.Footer className="d-flex flex-wrap gap-2">
              {mayApply && open && draft !== undefined && (
                <div>
                  <Link
                    className="btn btn-success"
                    to={`/apply/${recruitment.id}`}
                    data-testid={id("draft")}
                  >
                    Continue editing draft application
                  </Link>
                  <div
                    className="text-danger mt-2"
                    data-testid={id("draft-warning")}
                  >
                    {DRAFT_WARNING}
                  </div>
                </div>
              )}
              {cancelled && open && draft === undefined && (
                <Link
                  className="btn btn-success"
                  to={`/apply/${recruitment.id}`}
                  data-testid={id("restart")}
                >
                  {RESTART_LABEL}
                </Link>
              )}
              {application === undefined &&
                (open ? (
                  draft === undefined && (
                    <Link
                      className="btn btn-success"
                      to={`/apply/${recruitment.id}`}
                      data-testid={id("apply")}
                    >
                      {applyLabel}
                    </Link>
                  )
                ) : (
                  <OverlayTrigger
                    placement="top"
                    overlay={
                      <Tooltip id={id("apply-tooltip")}>
                        {NOT_OPEN_TOOLTIP}
                      </Tooltip>
                    }
                  >
                    {/* A disabled button gets no mouse events, so the wrapper carries the tooltip. */}
                    <span
                      className="d-inline-block"
                      tabIndex={0}
                      data-testid={id("apply-wrapper")}
                    >
                      <Button
                        variant="secondary"
                        disabled
                        style={{ pointerEvents: "none" }}
                        data-testid={id("apply")}
                      >
                        {applyLabel}
                      </Button>
                    </span>
                  </OverlayTrigger>
                ))}
              {application !== undefined && (
                <Link
                  className={
                    cancelled ? "btn btn-outline-secondary" : "btn btn-success"
                  }
                  to={`/applications/${application.id}`}
                  data-testid={id("view")}
                >
                  {cancelled
                    ? "View my Application"
                    : open
                      ? "View submitted application"
                      : "View/Comment on My Application"}
                </Link>
              )}
              {application !== undefined && !cancelled && (
                <Button
                  variant="danger"
                  className="ms-auto"
                  onClick={() => onCancelRequested(application, recruitment)}
                  data-testid={id("cancel")}
                >
                  Cancel my Application
                </Button>
              )}
            </Card.Footer>
          </Card>
        );
      })}
    </div>
  );
}
