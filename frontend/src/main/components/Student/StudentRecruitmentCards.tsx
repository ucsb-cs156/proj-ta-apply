import { Badge, Button, Card, OverlayTrigger, Tooltip } from "react-bootstrap";
import { Link } from "react-router";
import type { Application } from "main/components/Applications/ApplicationTable";
import type { StudentRecruitment } from "main/components/Recruitments/RecruitmentTable";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import { DATE_KEYS } from "main/utils/recruitmentSort";
import { applicationFor } from "main/utils/studentRecruitments";

/** On the greyed-out Apply Now button of a closed recruitment. */
export const NOT_OPEN_TOOLTIP = "Applications are not open yet";

type StudentRecruitmentCardsProps = {
  /** The open and recently closed recruitments, in the order to show them. */
  recruitments: StudentRecruitment[];
  /** The student's own applications, to tell which recruitments they applied to. */
  applications: Application[];
  onCancelRequested?: (
    application: Application,
    recruitment: StudentRecruitment,
  ) => void;
  testIdPrefix?: string;
};

/**
 * One card per current or recent recruitment, as a student sees it (issue #107): the same header
 * and dates as the admin's cards, a badge saying whether they have applied, and the buttons that
 * fit: Apply Now, View/Edit or View/Comment, and Cancel my Application.
 */
export default function StudentRecruitmentCards({
  recruitments,
  applications,
  onCancelRequested = () => {},
  testIdPrefix = "StudentRecruitmentCards",
}: StudentRecruitmentCardsProps): React.JSX.Element {
  const list = Array.isArray(recruitments) ? recruitments : [];
  const applicationList = Array.isArray(applications) ? applications : [];

  return (
    <div data-testid={testIdPrefix}>
      {list.map((recruitment) => {
        const id = (suffix: string) =>
          `${testIdPrefix}-card-${recruitment.id}-${suffix}`;
        const open = recruitment.applicationStatus === "OPEN";
        const application = applicationFor(applicationList, recruitment.id);
        const cancelled = application?.status === "CANCELLED";
        const badge = cancelled
          ? { bg: "secondary", text: "Application cancelled" }
          : application
            ? { bg: "success", text: "Application on File" }
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
              {application === undefined &&
                (open ? (
                  <Link
                    className="btn btn-success"
                    to={`/apply/${recruitment.id}`}
                    data-testid={id("apply")}
                  >
                    Apply Now
                  </Link>
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
                        Apply Now
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
                      ? "View/Edit my Application"
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
