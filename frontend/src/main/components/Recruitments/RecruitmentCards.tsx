import { useState } from "react";
import {
  Badge,
  Button,
  ButtonGroup,
  Card,
  Form,
  Modal,
  OverlayTrigger,
  Tooltip,
} from "react-bootstrap";
import { Link } from "react-router";
import { TrashIcon } from "main/components/Common/Icons";
import { applicationsText } from "main/utils/adminApplications";
import { useBackendMutation } from "main/utils/useBackend";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import {
  DATE_KEYS,
  SORT_KEYS,
  sortRecruitments,
  type SortKey,
} from "main/utils/recruitmentSort";
import {
  CLOSE_APPLICATIONS_TOOLTIP,
  CLOSE_REVIEWS_TOOLTIP,
  MORE_ABOUT_TEXT,
  OPEN_APPLICATIONS_TOOLTIP,
  OPEN_REVIEWS_CONFIRMATION,
  CLOSE_REVIEWS_CONFIRMATION,
  earlyCloseWarning,
  OPEN_REVIEWS_TOOLTIP,
  statusConfirmation,
} from "main/utils/recruitmentActions";
import {
  defaultReviewDeadline,
  isBeforeDeadline,
} from "main/utils/workingDays";

/** On the Test button of each card. */
export const TEST_APPLICATION_TOOLTIP =
  "Submit a test application to see what the form looks like to applicants";

/** On the trash icon of each card (issue #108). */
export const DELETE_TOOLTIP = "Delete this Recruitment";

type ReviewModal = { recruitment: Recruitment; mode: "open" | "editDeadline" };

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
 * application count in its header with a trash icon at the right (issue #108), the dates in its
 * body and the application and faculty-review actions in its footer.
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
    { onSuccess: () => setStatusModal(null) },
    ["/api/admin/recruitments/all"],
  );
  // The recruitment whose Open/Close Applications button was clicked, while the modal asks
  // "Are you sure?" (issue #186); null when the modal is closed.
  const [statusModal, setStatusModal] = useState<Recruitment | null>(null);

  const [reviewModal, setReviewModal] = useState<ReviewModal | null>(null);
  // The recruitment whose faculty reviews are about to be closed (issue #211), while the
  // confirmation is open.
  const [closeReviewsModal, setCloseReviewsModal] =
    useState<Recruitment | null>(null);
  const [deadline, setDeadline] = useState("");
  const [deadlineError, setDeadlineError] = useState("");

  const reviewStatusMutation = useBackendMutation<
    { recruitment: Recruitment; status: "Open" | "Closed"; deadline?: string },
    unknown
  >(
    ({ recruitment, status, deadline: rankingDeadline }) => ({
      url: "/api/admin/recruitments/reviewStatus",
      method: "PUT",
      params: {
        id: recruitment.id,
        status,
        ...(rankingDeadline ? { facultyRankingDeadline: rankingDeadline } : {}),
      },
    }),
    {
      onSuccess: () => {
        setReviewModal(null);
        setCloseReviewsModal(null);
      },
    },
    ["/api/admin/recruitments/all"],
  );

  const deadlineMutation = useBackendMutation<
    { recruitment: Recruitment; deadline: string },
    unknown
  >(
    ({ recruitment, deadline: rankingDeadline }) => ({
      url: "/api/admin/recruitments/facultyRankingDeadline",
      method: "PUT",
      params: {
        id: recruitment.id,
        facultyRankingDeadline: rankingDeadline,
      },
    }),
    { onSuccess: () => setReviewModal(null) },
    ["/api/admin/recruitments/all"],
  );

  const openReviewModal = (
    recruitment: Recruitment,
    mode: ReviewModal["mode"],
  ) => {
    // Opening proposes five working days from today (issue #211); the admin may change it.
    setDeadline(
      mode === "open"
        ? defaultReviewDeadline()
        : // Stryker disable next-line StringLiteral : a date box shows any non-date as empty anyway
          (recruitment.facultyRankingDeadline ?? ""),
    );
    setDeadlineError("");
    setReviewModal({ recruitment, mode });
  };

  const submitReviewDate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reviewModal) return;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(deadline) ||
      Number.isNaN(Date.parse(deadline))
    ) {
      setDeadlineError("Enter a valid deadline.");
      return;
    }

    if (reviewModal.mode === "open") {
      reviewStatusMutation.mutate({
        recruitment: reviewModal.recruitment,
        status: "Open",
        deadline,
      });
    } else {
      deadlineMutation.mutate({
        recruitment: reviewModal.recruitment,
        deadline,
      });
    }
  };
  const savingReviewChanges =
    reviewStatusMutation.isPending || deadlineMutation.isPending;

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
    <div data-testid={`${testIdPrefix}-cards`}>
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
        const reviewsOpen = recruitment.reviewStatus === "Open";
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
                  <dd
                    className="mb-1"
                    data-testid={id("facultyRankingDeadline")}
                  >
                    {recruitment.facultyRankingDeadline ?? ""}
                  </dd>
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 ms-2"
                    onClick={() => openReviewModal(recruitment, "editDeadline")}
                    data-testid={id("edit-faculty-ranking-deadline")}
                  >
                    Change
                  </Button>
                </div>
              </dl>
            </Card.Body>
            <Card.Footer className="d-flex flex-wrap gap-2">
              <OverlayTrigger
                placement="top"
                overlay={
                  <Tooltip id={id("status-tooltip")}>
                    {open
                      ? CLOSE_APPLICATIONS_TOOLTIP
                      : OPEN_APPLICATIONS_TOOLTIP}
                  </Tooltip>
                }
              >
                <Button
                  variant={open ? "warning" : "success"}
                  onClick={() => setStatusModal(recruitment)}
                  data-testid={id("status-button")}
                >
                  {open ? "Close Applications" : "Open Applications"}
                </Button>
              </OverlayTrigger>
              <OverlayTrigger
                placement="top"
                overlay={
                  <Tooltip id={id("review-status-tooltip")}>
                    {reviewsOpen ? CLOSE_REVIEWS_TOOLTIP : OPEN_REVIEWS_TOOLTIP}
                  </Tooltip>
                }
              >
                {reviewsOpen ? (
                  <Button
                    variant="warning"
                    onClick={() => setCloseReviewsModal(recruitment)}
                    data-testid={id("review-status-button")}
                  >
                    Close Faculty Reviews
                  </Button>
                ) : (
                  <Button
                    variant="success"
                    onClick={() => openReviewModal(recruitment, "open")}
                    data-testid={id("review-status-button")}
                  >
                    Open Faculty Reviews
                  </Button>
                )}
              </OverlayTrigger>
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
              <a
                className="btn btn-outline-secondary"
                href={`/api/admin/rankings/csv?recruitmentId=${recruitment.id}`}
                download={`rankings-${recruitment.id}.csv`}
                data-testid={id("rankings-csv-button")}
              >
                Download Rankings CSV
              </a>
              <Link
                className="btn btn-info"
                to={`/admin/recruitments/${recruitment.id}/applications`}
                data-testid={id("review-button")}
              >
                Review Applications
              </Link>
              <Link
                className="btn btn-dark"
                to={`/admin/recruitments/${recruitment.id}/assignments`}
                data-testid={id("assignments-button")}
              >
                Assignments
              </Link>
              {recruitment.assignmentsPublished === true && (
                <Link
                  className="btn btn-outline-dark"
                  to={`/recruitments/${recruitment.id}/assignments`}
                  data-testid={id("published-assignments-button")}
                >
                  Published Assignments
                </Link>
              )}
            </Card.Footer>
          </Card>
        );
      })}
      <Modal
        show={statusModal !== null}
        onHide={() => setStatusModal(null)}
        centered
        data-testid={`${testIdPrefix}-status-modal`}
      >
        {statusModal !== null &&
          (() => {
            const closing = statusModal.applicationStatus === "OPEN";
            const confirmation = statusConfirmation(closing);
            return (
              <>
                <Modal.Header closeButton>
                  <Modal.Title>
                    {confirmation.title}: {yyyyqToQyy(statusModal.quarter)}{" "}
                    {statusModal.type}
                  </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                  <p data-testid={`${testIdPrefix}-status-modal-explanation`}>
                    {confirmation.explanation}{" "}
                    <a
                      href={confirmation.helpLink}
                      target="_blank"
                      rel="noreferrer"
                      data-testid={`${testIdPrefix}-status-modal-help`}
                    >
                      {MORE_ABOUT_TEXT}
                    </a>
                  </p>
                  <p className="fw-bold mb-0">Are you sure?</p>
                </Modal.Body>
                <Modal.Footer>
                  <Button
                    variant="secondary"
                    onClick={() => setStatusModal(null)}
                    data-testid={`${testIdPrefix}-status-modal-no`}
                  >
                    {confirmation.no}
                  </Button>
                  <Button
                    variant={closing ? "warning" : "success"}
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate(statusModal)}
                    data-testid={`${testIdPrefix}-status-modal-yes`}
                  >
                    {confirmation.yes}
                  </Button>
                </Modal.Footer>
              </>
            );
          })()}
      </Modal>
      <Modal
        show={closeReviewsModal !== null}
        onHide={() => setCloseReviewsModal(null)}
        centered
        data-testid={`${testIdPrefix}-close-reviews-modal`}
      >
        {closeReviewsModal !== null && (
          <>
            <Modal.Header closeButton>
              <Modal.Title>
                {CLOSE_REVIEWS_CONFIRMATION.title}:{" "}
                {yyyyqToQyy(closeReviewsModal.quarter)} {closeReviewsModal.type}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <p data-testid={`${testIdPrefix}-close-reviews-explanation`}>
                {CLOSE_REVIEWS_CONFIRMATION.explanation}{" "}
                <a
                  href={CLOSE_REVIEWS_CONFIRMATION.helpLink}
                  target="_blank"
                  rel="noreferrer"
                  data-testid={`${testIdPrefix}-close-reviews-help`}
                >
                  {MORE_ABOUT_TEXT}
                </a>
              </p>
              {isBeforeDeadline(closeReviewsModal.facultyRankingDeadline) && (
                <p
                  className="text-danger fw-bold"
                  role="alert"
                  data-testid={`${testIdPrefix}-close-reviews-early`}
                >
                  <span aria-hidden="true">&#9888; </span>
                  {earlyCloseWarning(
                    closeReviewsModal.facultyRankingDeadline as string,
                  )}
                </p>
              )}
              <p className="fw-bold mb-0">Are you sure?</p>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="secondary"
                onClick={() => setCloseReviewsModal(null)}
                data-testid={`${testIdPrefix}-close-reviews-no`}
              >
                {CLOSE_REVIEWS_CONFIRMATION.no}
              </Button>
              <Button
                variant="warning"
                disabled={reviewStatusMutation.isPending}
                onClick={() =>
                  reviewStatusMutation.mutate({
                    recruitment: closeReviewsModal,
                    status: "Closed",
                  })
                }
                data-testid={`${testIdPrefix}-close-reviews-yes`}
              >
                {CLOSE_REVIEWS_CONFIRMATION.yes}
              </Button>
            </Modal.Footer>
          </>
        )}
      </Modal>
      <Modal
        show={reviewModal !== null}
        onHide={() => setReviewModal(null)}
        centered
        data-testid={`${testIdPrefix}-faculty-review-modal`}
      >
        <Form onSubmit={submitReviewDate}>
          <Modal.Header closeButton>
            <Modal.Title>
              {reviewModal?.mode === "open"
                ? "Open Faculty Reviews"
                : "Change Faculty Ranking Deadline"}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {reviewModal?.mode === "open" && (
              <p data-testid={`${testIdPrefix}-faculty-review-explanation`}>
                {OPEN_REVIEWS_CONFIRMATION.explanation}{" "}
                <a
                  href={OPEN_REVIEWS_CONFIRMATION.helpLink}
                  target="_blank"
                  rel="noreferrer"
                  data-testid={`${testIdPrefix}-faculty-review-help`}
                >
                  {MORE_ABOUT_TEXT}
                </a>
              </p>
            )}
            <Form.Group controlId={`${testIdPrefix}-faculty-ranking-deadline`}>
              <Form.Label>Faculty ranking deadline</Form.Label>
              <Form.Control
                type="date"
                required
                value={deadline}
                onChange={(event) => {
                  setDeadline(event.target.value);
                  setDeadlineError("");
                }}
                isInvalid={deadlineError !== ""}
                data-testid={`${testIdPrefix}-faculty-ranking-deadline-input`}
              />
              <Form.Control.Feedback type="invalid">
                {deadlineError || "Enter a deadline."}
              </Form.Control.Feedback>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() => setReviewModal(null)}
              data-testid={`${testIdPrefix}-faculty-review-cancel`}
            >
              {reviewModal?.mode === "open"
                ? OPEN_REVIEWS_CONFIRMATION.no
                : "Cancel"}
            </Button>
            <Button
              variant={reviewModal?.mode === "open" ? "success" : "primary"}
              type="submit"
              disabled={savingReviewChanges}
              data-testid={`${testIdPrefix}-faculty-review-save`}
            >
              {reviewModal?.mode === "open"
                ? OPEN_REVIEWS_CONFIRMATION.yes
                : "Save Deadline"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
