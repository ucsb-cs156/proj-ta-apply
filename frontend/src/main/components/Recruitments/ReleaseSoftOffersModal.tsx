import { useState } from "react";
import { Alert, Button, Form, Modal } from "react-bootstrap";
import { toast } from "react-toastify";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { apiErrorMessage } from "main/utils/apiError";
import { MORE_ABOUT_TEXT } from "main/utils/recruitmentActions";
import {
  HOME_PAGE_QUERY_KEYS,
  STEPS_QUERY_KEY,
} from "main/utils/recruitmentSteps";
import {
  DEADLINE_ERROR,
  NO_NOTICE_WARNING,
  RELEASED_TOAST,
  RELEASE_SOFT_OFFERS_EXPLANATION,
  RELEASE_SOFT_OFFERS_LABEL,
  SOFT_OFFERS_HELP,
  SOFT_OFFERS_URL,
  SOFT_OFFER_NOTICES_CURRENT_URL,
  TENTATIVE_WARNING,
  hiringDecisionsTentative,
} from "main/utils/softOffers";
import type { SoftOfferNoticeVersion } from "main/utils/softOfferNotices";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import {
  defaultSoftOfferDeadline,
  isFutureWallClock,
} from "main/utils/pacificTime";

type ReleaseSoftOffersModalProps = {
  recruitment: Recruitment;
  show: boolean;
  onHide: () => void;
  testIdPrefix?: string;
};

/**
 * The Release Soft Offers confirmation (issue #485): what releasing does, a deadline box proposing
 * 5:00 pm five days from today, warnings when no Soft Offer Notices text is saved or hiring
 * decisions are tentative, and Release Soft Offers or Cancel. Releasing toasts, re-reads the
 * recruitment list and the steps, and closes; a refusal stays in the modal. Mounted only while
 * open, so the box starts from today each time.
 */
export default function ReleaseSoftOffersModal({
  recruitment,
  show,
  onHide,
  // Stryker disable next-line StringLiteral : every caller passes its own prefix
  testIdPrefix = "ReleaseSoftOffersModal",
}: ReleaseSoftOffersModalProps): React.JSX.Element {
  const id = (suffix: string) => `${testIdPrefix}-${suffix}`;
  const [deadline, setDeadline] = useState(() => defaultSoftOfferDeadline());
  // Stryker disable next-line StringLiteral : the error is cleared whenever the box changes
  const [deadlineError, setDeadlineError] = useState("");
  const [refusal, setRefusal] = useState<string | null>(null);

  // Issue #484: the text the applicants will read; warn when none has been saved yet.
  const { data: notices } = useBackend<SoftOfferNoticeVersion[] | null>(
    // Stryker disable next-line ArrayDeclaration : the query key is only observable through invalidation, and nothing here invalidates it
    [SOFT_OFFER_NOTICES_CURRENT_URL],
    // Stryker disable next-line ObjectLiteral,StringLiteral : axios sends a GET whatever the method says
    { method: "GET", url: SOFT_OFFER_NOTICES_CURRENT_URL },
    null,
  );
  const noNotice = Array.isArray(notices) && notices.length === 0;

  const mutation = useBackendMutation<string, Recruitment>(
    (chosen) => ({
      url: SOFT_OFFERS_URL,
      method: "PUT",
      params: { id: recruitment.id, deadline: chosen },
    }),
    {
      onSuccess: () => {
        onHide();
        toast(RELEASED_TOAST);
      },
      onError: (error) => setRefusal(apiErrorMessage(error)),
    },
    ["/api/admin/recruitments/all", STEPS_QUERY_KEY, ...HOME_PAGE_QUERY_KEYS],
  );

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    // Stryker disable next-line BlockStatement,CallExpression : the form is never really submitted in jsdom or the modal
    event.preventDefault();
    if (!isFutureWallClock(deadline)) {
      setDeadlineError(DEADLINE_ERROR);
      return;
    }
    setRefusal(null);
    mutation.mutate(deadline);
  };

  return (
    <Modal show={show} onHide={onHide} centered data-testid={id("modal")}>
      <Form onSubmit={submit}>
        <Modal.Header closeButton>
          <Modal.Title>
            {RELEASE_SOFT_OFFERS_LABEL}: {yyyyqToQyy(recruitment.quarter)}{" "}
            {recruitment.type}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p data-testid={id("explanation")}>
            {RELEASE_SOFT_OFFERS_EXPLANATION}{" "}
            <a
              href={SOFT_OFFERS_HELP}
              target="_blank"
              rel="noreferrer"
              data-testid={id("help")}
            >
              {MORE_ABOUT_TEXT}
            </a>
          </p>
          <Form.Group controlId={id("deadline")}>
            <Form.Label>Soft offer deadline</Form.Label>
            <Form.Control
              type="datetime-local"
              required
              value={deadline}
              onChange={(event) => {
                setDeadline(event.target.value);
                setDeadlineError("");
              }}
              isInvalid={deadlineError !== ""}
              data-testid={id("deadline-input")}
            />
            <Form.Control.Feedback
              type="invalid"
              data-testid={id("deadline-error")}
            >
              {deadlineError}
            </Form.Control.Feedback>
          </Form.Group>
          {noNotice && (
            <p
              className="text-danger fw-bold mt-3 mb-0"
              role="alert"
              data-testid={id("warning-notice")}
            >
              <span aria-hidden="true">&#9888; </span>
              {NO_NOTICE_WARNING}
            </p>
          )}
          {hiringDecisionsTentative(recruitment) && (
            <p
              className="text-danger fw-bold mt-3 mb-0"
              role="alert"
              data-testid={id("warning-tentative")}
            >
              <span aria-hidden="true">&#9888; </span>
              {TENTATIVE_WARNING}
            </p>
          )}
          {refusal !== null && (
            <Alert
              variant="danger"
              className="mb-0 mt-3"
              data-testid={id("refusal")}
            >
              {refusal}
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={onHide}
            data-testid={id("cancel")}
          >
            Cancel
          </Button>
          <Button
            variant="warning"
            type="submit"
            disabled={mutation.isPending}
            data-testid={id("confirm")}
          >
            {RELEASE_SOFT_OFFERS_LABEL}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
