import { useEffect, useId, useRef, useState } from "react";
import Modal from "react-bootstrap/Modal";
import { RISK_SENTENCE, describeOthers, type OtherClient } from "./others";

/** How long Enter is ignored after the modal appears, so a keystroke meant for the form is safe. */
export const ENTER_IGNORED_MS = 1000;

type Choice = "wait" | "continue";

type MultipleTabsModalProps = {
  /** Who else is working on the same thing, as the server last said. */
  others: OtherClient[];
  /** This tab arrived after every other one, so it is the one that is asked. Others never see it. */
  newest: boolean;
  /**
   * When the server counts this tab as having arrived. A choice is remembered only for as long as
   * this stays the same, so a tab that arrives afresh is asked afresh.
   */
  arrivedAt: number;
  /** What is open twice, as it should read in the sentence: "application", "budget". */
  noun: string;
  /** Called when the user chooses to leave. It should say goodbye and take the user away. */
  onLeave: () => void;
  testId?: string;
};

/**
 * The question put to the newer of several tabs on the same thing (issue #284), which must be
 * answered, with three choices:
 *
 * - Leave this page: {@link MultipleTabsModalProps.onLeave}.
 * - Wait for the other tabs or windows to close, then resume here: the page stays covered, and the
 *   modal closes by itself when the server says there is no one else.
 * - Continue anyway: the modal closes and does not come back for this tab's stay, though the banner
 *   remains. It comes back only if this tab arrives afresh.
 *
 * Only the newest tab is asked. The older tabs keep the banner alone, so that whoever was there
 * first is never interrupted while typing, and two tabs cannot both choose to wait for the other
 * and be stuck: the oldest tab is never asked to wait for anyone. A tab that is waiting and then
 * stops being the newest, because another tab has arrived, is released at once for the same
 * reason.
 *
 * The modal does not take focus onto any button, so Enter typed for the form cannot choose
 * anything, and Enter is ignored for the first {@link ENTER_IGNORED_MS} milliseconds besides.
 * Escape does nothing: the question must be answered, and Escape is too easily pressed in passing.
 * Focus stays inside it, it is labelled by its title, and it is announced as a dialog.
 */
export default function MultipleTabsModal({
  others,
  newest,
  arrivedAt,
  noun,
  onLeave,
  testId = "MultipleTabsModal",
}: MultipleTabsModalProps): React.JSX.Element | null {
  const titleId = useId();
  const [chosen, setChosen] = useState<{
    choice: Choice;
    arrivedAt: number;
  } | null>(null);
  const shownAt = useRef(0);

  // A choice holds only for the arrival it was made in.
  const choice = chosen?.arrivedAt === arrivedAt ? chosen.choice : null;
  const show = newest && others.length > 0 && choice !== "continue";

  // Each time the modal appears, Enter is ignored for a moment. (Noted when it goes too, which
  // does no harm: it is noted again when it next appears.)
  useEffect(() => {
    shownAt.current = Date.now();
  }, [show]);

  if (!show) {
    return null;
  }
  const choose = (picked: Choice) => setChosen({ choice: picked, arrivedAt });

  return (
    <Modal
      show
      // Static, and with no onHide: neither a click outside nor Escape can close it. The modal bounces
      // a little to show it was noticed, and stays.
      backdrop="static"
      centered
      aria-labelledby={titleId}
      data-testid={testId}
      onKeyDownCapture={(event: React.KeyboardEvent) => {
        if (
          event.key === "Enter" &&
          Date.now() - shownAt.current < ENTER_IGNORED_MS
        ) {
          event.preventDefault();
        }
      }}
    >
      <Modal.Header>
        <Modal.Title id={titleId}>
          This {noun} is open in more than one place
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ overflowWrap: "anywhere" }}>
        <p data-testid={`${testId}-message`}>
          {describeOthers(others, noun)} {RISK_SENTENCE}
        </p>
        {choice === "wait" && (
          <p role="status" data-testid={`${testId}-waiting`}>
            Waiting for the other tabs or windows to close. This will close by
            itself when they have, and you can carry on here.
          </p>
        )}
        <div className="d-grid gap-2">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onLeave}
            data-testid={`${testId}-leave`}
          >
            Leave this page
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={choice === "wait"}
            onClick={() => choose("wait")}
            data-testid={`${testId}-wait`}
          >
            Wait for the other tabs or windows to close, then resume here
          </button>
          <button
            type="button"
            className="btn btn-outline-danger"
            onClick={() => choose("continue")}
            data-testid={`${testId}-continue`}
          >
            Continue anyway
          </button>
        </div>
      </Modal.Body>
    </Modal>
  );
}
