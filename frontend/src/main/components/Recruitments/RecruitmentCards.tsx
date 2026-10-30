import { useState } from "react";
import {
  Badge,
  Button,
  ButtonGroup,
  Card,
  OverlayTrigger,
  Tooltip,
} from "react-bootstrap";
import { Link } from "react-router";
import { TrashIcon } from "main/components/Common/Icons";
import { useBackendMutation } from "main/utils/useBackend";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import {
  DATE_KEYS,
  SORT_KEYS,
  sortRecruitments,
  type SortKey,
} from "main/utils/recruitmentSort";

/** On the Test button of each card. */
export const TEST_APPLICATION_TOOLTIP =
  "Submit a test application to see what the form looks like to applicants";

/** On the trash icon of each card (issue #108). */
export const DELETE_TOOLTIP = "Delete this Recruitment";

/** "15 applications", for the card header. */
export const applicationsText = (count: number): string =>
  `${count} ${count === 1 ? "application" : "applications"}`;

type RecruitmentCardsProps = {
  recruitments: Recruitment[];
  /** Recruitment id to its number of applications on file; a missing id counts as none. */
  applicationCounts?: Record<string, number>;
  onDeleteRequested?: (recruitment: Recruitment) => void;
  testIdPrefix?: string;
};

/**
 * One card per recruitment with a Sort by bar above (issue #86): the recruitments table had
 * thirteen columns and overflowed a laptop screen. Each card has the quarter, type, status and
 * application count in its header with a trash icon at the right (issue #108), the four dates in
 * its body and the five actions in its footer.
 */
export default function RecruitmentCards({
  recruitments,
  applicationCounts = {},
  onDeleteRequested = () => {},
  testIdPrefix = "RecruitmentCards",
}: RecruitmentCardsProps): React.JSX.Element {
  // Newest quarter first, as the table listed them.
  const [sortKey, setSortKey] = useState<SortKey>("quarter");
  const [descending, setDescending] = useState(true);

  const statusMutation = useBackendMutation<Recruitment, unknown>(
    (recruitment) => ({
      url: "/api/admin/recruitments/status",
      method: "PUT",
      params: {
        id: recruitment.id,
        // The button always moves it to the other state.
        status: recruitment.applicationStatus === "OPEN" ? "CLOSED" : "OPEN",
      },
    }),
    {},
    ["/api/admin/recruitments/all"],
  );

  const sortBy = (key: SortKey) => {
    if (key === sortKey) {
      setDescending(!descending);
    } else {
      setSortKey(key);
      setDescending(false);
    }
  };

  const sorted = sortRecruitments(
    Array.isArray(recruitments) ? recruitments : [],
    sortKey,
    descending,
  );

  return (
    <div data-testid={testIdPrefix}>
      <div className="d-flex align-items-center flex-wrap gap-2 mb-3">
        <span id={`${testIdPrefix}-sort-label`}>Sort by</span>
        <ButtonGroup
          size="sm"
          aria-labelledby={`${testIdPrefix}-sort-label`}
          data-testid={`${testIdPrefix}-sort-bar`}
        >
          {SORT_KEYS.map(({ key, label }) => {
            const active = key === sortKey;
            return (
              <Button
                key={key}
                variant={active ? "primary" : "outline-primary"}
                aria-pressed={active}
                onClick={() => sortBy(key)}
                data-testid={`${testIdPrefix}-sort-${key}`}
              >
                {label}
                {active && (descending ? " ▼" : " ▲")}
              </Button>
            );
          })}
        </ButtonGroup>
      </div>

      {sorted.length === 0 && (
        <p className="text-muted" data-testid={`${testIdPrefix}-empty`}>
          No recruitments yet.
        </p>
      )}

      {sorted.map((recruitment, index) => {
        const id = (suffix: string) =>
          `${testIdPrefix}-card-${index}-${suffix}`;
        const open = recruitment.applicationStatus === "OPEN";
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
              <span data-testid={id("applications")}>
                {applicationsText(applicationCounts[recruitment.id] ?? 0)}
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
              <Button
                variant={open ? "warning" : "success"}
                onClick={() => statusMutation.mutate(recruitment)}
                data-testid={id("status-button")}
              >
                {open ? "Close Applications" : "Open Applications"}
              </Button>
              <Link
                className="btn btn-primary"
                to={`/admin/recruitments/${recruitment.id}/courses`}
                data-testid={id("courses-button")}
              >
                Courses
              </Link>
              <Link
                className="btn btn-secondary"
                to={`/admin/recruitments/${recruitment.id}/test-application`}
                title={TEST_APPLICATION_TOOLTIP}
                data-testid={id("test-button")}
              >
                Test Application
              </Link>
              {/* A plain link, so the browser saves the file itself; the backend names it after
                  the recruitment and lays the columns out for its type. */}
              <a
                className="btn btn-outline-secondary"
                href={`/api/admin/applications/csv?recruitmentId=${recruitment.id}`}
                download={`applications-${recruitment.id}.csv`}
                data-testid={id("csv-button")}
              >
                Download CSV
              </a>
              <Link
                className="btn btn-info"
                to={`/admin/recruitments/${recruitment.id}/applications`}
                data-testid={id("review-button")}
              >
                Review Applications
              </Link>
            </Card.Footer>
          </Card>
        );
      })}
    </div>
  );
}
