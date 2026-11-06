import { useEffect, useState } from "react";
import { Button, ButtonGroup, Form, Modal } from "react-bootstrap";
import { toast } from "react-toastify";
import { useNavigate } from "react-router";
import AllocationVisibilityModal from "main/components/Recruitments/AllocationVisibilityModal";
import PublishAssignmentsModal from "main/components/Recruitments/PublishAssignmentsModal";
import AdminBudgetCard from "main/components/Recruitments/AdminBudgetCard";
import RecruitmentCardLayout from "main/components/Recruitments/RecruitmentCardLayout";
import { useBackendMutation } from "main/utils/useBackend";
import { useRefreshingBackend } from "main/utils/useRefreshingBackend";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import {
  SORT_KEYS,
  sortRecruitments,
  type SortKey,
} from "main/utils/recruitmentSort";
import {
  MORE_ABOUT_TEXT,
  OPEN_REVIEWS_CONFIRMATION,
  CLOSE_REVIEWS_CONFIRMATION,
  STALE_CONFIRMATION_MESSAGE,
  earlyCloseWarning,
  statusConfirmation,
} from "main/utils/recruitmentActions";
import {
  STEPS_QUERY_KEY,
  HOME_PAGE_QUERY_KEYS,
  type RecruitmentStepAction,
  type RecruitmentStepsData,
} from "main/utils/recruitmentSteps";
import {
  defaultReviewDeadline,
  isBeforeDeadline,
} from "main/utils/workingDays";

/** Re-read after every change: the recruitment list, and every recruitment's steps. */
const REFRESH_KEYS = [
  "/api/admin/recruitments/all",
  STEPS_QUERY_KEY,
  ...HOME_PAGE_QUERY_KEYS,
];

/**
 * The id of the most recent recruitment (by quarter, then id) of one type, whose diagram starts
 * expanded; every other recruitment's starts collapsed (docs/design/AdminUserInterfaceDesign.md).
 */
const latestOfType = (
  recruitments: Recruitment[],
  type: Recruitment["type"],
): number | undefined => {
  // Stryker disable next-line EqualityOperator : the two types are expanded symmetrically, so swapping them changes nothing
  const ofType = recruitments.filter((r) => r.type === type);
  return ofType.sort(
    (a, b) => b.quarter.localeCompare(a.quarter) || b.id - a.id,
  )[0]?.id;
};

/**
 * The recruitments grouped by quarter, the quarters in the order each first appears in the sorted
 * list (so a quarter's budget card moves with it), each group keeping the sorted order within it.
 * Each group also names the quarter's TA and ULA recruitment: the one with the highest id if
 * there were ever more than one (the backend allows only one of each per quarter).
 */
type QuarterGroup = {
  quarter: string;
  items: { recruitment: Recruitment; index: number }[];
  ta?: Recruitment;
  ula?: Recruitment;
};

const groupByQuarter = (sorted: Recruitment[]): QuarterGroup[] => {
  const groups = new Map<string, QuarterGroup>();
  sorted.forEach((recruitment, index) => {
    const group = groups.get(recruitment.quarter) ?? {
      quarter: recruitment.quarter,
      items: [],
    };
    group.items.push({ recruitment, index });
    const field = recruitment.type === "TA" ? "ta" : "ula";
    const current = group[field];
    // Stryker disable next-line EqualityOperator : two recruitments never share an id, so > and >= agree
    if (current === undefined || recruitment.id > current.id) {
      group[field] = recruitment;
    }
    groups.set(recruitment.quarter, group);
  });
  return [...groups.values()];
};

type AdminRecruitmentCardProps = {
  recruitment: Recruitment;
  applicationCount: number;
  defaultExpanded: boolean;
  onChangeDeadline: (recruitment: Recruitment) => void;
  onDeleteRequested: (recruitment: Recruitment) => void;
  onAction: (recruitment: Recruitment, action: RecruitmentStepAction) => void;
  testIdPrefix: string;
};

/**
 * One recruitment's card with its live steps (issue #233): fetches the steps, then lays the card
 * out with RecruitmentCardLayout. A component of its own because each card needs its own query.
 */
function AdminRecruitmentCard({
  recruitment,
  applicationCount,
  defaultExpanded,
  onChangeDeadline,
  onDeleteRequested,
  onAction,
  testIdPrefix,
}: AdminRecruitmentCardProps): React.JSX.Element {
  const navigate = useNavigate();
  const { data: steps } = useRefreshingBackend<
    RecruitmentStepsData | undefined
  >(
    [STEPS_QUERY_KEY, recruitment.id],
    {
      // Stryker disable next-line StringLiteral : axios defaults to GET
      method: "GET",
      url: `/api/admin/recruitments/${recruitment.id}/steps`,
    },
    undefined,
  );
  return (
    <RecruitmentCardLayout
      recruitment={recruitment}
      applicationCount={applicationCount}
      steps={steps}
      defaultExpanded={defaultExpanded}
      onChangeDeadline={onChangeDeadline}
      onDeleteRequested={onDeleteRequested}
      onAction={(action) => onAction(recruitment, action)}
      onNavigate={navigate}
      testIdPrefix={testIdPrefix}
    />
  );
}

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
 * thirteen columns and overflowed a laptop screen. Each card (RecruitmentCardLayout) has the
 * quarter, type, status and application count in its header with a trash icon at the right
 * (issue #108), the dates in its body, the live Recruitment Steps diagram in a collapsible panel
 * (issue #233) and the Courses and Applications buttons in its footer. The diagram's actions open
 * the confirmation modals defined here, the Allocation Visibility modal and the Publish
 * Assignments modal.
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
    REFRESH_KEYS,
  );
  // The recruitment whose Open/Close Applications button was clicked, while the modal asks
  // "Are you sure?" (issue #186); null when the modal is closed.
  const [statusModal, setStatusModal] = useState<Recruitment | null>(null);

  const [reviewModal, setReviewModal] = useState<ReviewModal | null>(null);
  // The recruitment whose faculty reviews are about to be closed (issue #211), while the
  // confirmation is open.
  const [closeReviewsModal, setCloseReviewsModal] =
    useState<Recruitment | null>(null);
  // Stryker disable next-line StringLiteral : the box is always set when the modal opens
  const [deadline, setDeadline] = useState("");
  // Stryker disable next-line StringLiteral : the error is cleared whenever the modal opens or the box changes
  const [deadlineError, setDeadlineError] = useState("");
  // The recruitment whose Allocation Visibility or Publish Assignments modal is open (issue
  // #233), by id so the modal always shows the latest data; null when closed.
  const [visibilityId, setVisibilityId] = useState<number | null>(null);
  const [publishId, setPublishId] = useState<number | null>(null);

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
    REFRESH_KEYS,
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
    REFRESH_KEYS,
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
    // Stryker disable next-line BlockStatement,CallExpression : the form is never really submitted in jsdom or the modal
    event.preventDefault();
    if (!reviewModal) return;
    if (
      // Stryker disable next-line Regex,LogicalOperator : a date box only ever holds a well-formed date or an empty string
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

  // What a click on a box of the diagram does. The two applications steps share one modal and so
  // do the two faculty-review steps: which way it goes follows the recruitment's current status.
  const onStepAction = (
    recruitment: Recruitment,
    action: RecruitmentStepAction,
  ) => {
    switch (action) {
      case "openApplications":
      case "closeApplications":
        setStatusModal(recruitment);
        break;
      case "openReviews":
      case "closeReviews":
        if (recruitment.reviewStatus === "Open") {
          setCloseReviewsModal(recruitment);
        } else {
          openReviewModal(recruitment, "open");
        }
        break;
      case "allocationVisibility":
        setVisibilityId(recruitment.id);
        break;
      case "publishAssignments":
        setPublishId(recruitment.id);
        break;
    }
  };

  const sortBy = (key: SortKey) => {
    if (key === sortKey) {
      setDescending(!descending);
    } else {
      setSortKey(key);
      setDescending(false);
    }
  };

  const all = Array.isArray(recruitments) ? recruitments : [];
  const sorted = sortRecruitments(all, sortKey, descending);
  const latestTa = latestOfType(all, "TA");
  const latestUla = latestOfType(all, "ULA");

  // Issue #281: the list refreshes by itself, so a confirmation can outlive the state it asked
  // about (Close Applications after someone else already closed them). It closes, and says so,
  // rather than offering an action that no longer applies. The deadline being typed lives in this
  // component's own state, so a refresh never replaces it while its window stays open.
  const liveOf = (r: Recruitment) => all.find((x) => x.id === r.id);
  const confirmationStale =
    (statusModal !== null &&
      liveOf(statusModal)?.applicationStatus !==
        statusModal.applicationStatus) ||
    (closeReviewsModal !== null &&
      liveOf(closeReviewsModal)?.reviewStatus !== "Open") ||
    (reviewModal !== null &&
      (liveOf(reviewModal.recruitment) === undefined ||
        (reviewModal.mode === "open" &&
          // Stryker disable next-line OptionalChaining : the line above already handled a recruitment that is gone, so it is defined here
          liveOf(reviewModal.recruitment)?.reviewStatus === "Open")));
  // Closed while rendering (the state is this component's own), and counted so that the effect
  // below, which only toasts, runs once for each time it happens.
  const [staleClosings, setStaleClosings] = useState(0);
  if (confirmationStale) {
    setStatusModal(null);
    setCloseReviewsModal(null);
    setReviewModal(null);
    setStaleClosings(staleClosings + 1);
  }
  useEffect(() => {
    if (staleClosings > 0) toast(STALE_CONFIRMATION_MESSAGE);
  }, [staleClosings]);

  const visibilityRecruitment = all.find((r) => r.id === visibilityId);
  const publishRecruitment = all.find((r) => r.id === publishId);

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

      {groupByQuarter(sorted).map((group) => (
        <div
          key={group.quarter}
          data-testid={`${testIdPrefix}-quarter-${group.quarter}`}
        >
          <AdminBudgetCard
            quarter={group.quarter}
            ta={group.ta}
            ula={group.ula}
            testIdPrefix={`${testIdPrefix}-budget`}
          />
          {group.items.map(({ recruitment, index }) => (
            <AdminRecruitmentCard
              key={recruitment.id}
              recruitment={recruitment}
              applicationCount={applicationCounts[recruitment.id] ?? 0}
              defaultExpanded={
                recruitment.id === latestTa || recruitment.id === latestUla
              }
              // Stryker disable next-line StringLiteral : any mode other than open edits the deadline, so an empty mode behaves the same
              onChangeDeadline={(r) => openReviewModal(r, "editDeadline")}
              onDeleteRequested={onDeleteRequested}
              onAction={onStepAction}
              testIdPrefix={`${testIdPrefix}-card-${index}`}
            />
          ))}
        </div>
      ))}
      {visibilityRecruitment !== undefined && (
        <AllocationVisibilityModal
          recruitment={visibilityRecruitment}
          show
          onHide={() => setVisibilityId(null)}
          testIdPrefix={`${testIdPrefix}-visibility`}
        />
      )}
      {publishRecruitment !== undefined && (
        <PublishAssignmentsModal
          recruitment={publishRecruitment}
          show
          onHide={() => setPublishId(null)}
          testIdPrefix={`${testIdPrefix}-publish`}
        />
      )}
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
