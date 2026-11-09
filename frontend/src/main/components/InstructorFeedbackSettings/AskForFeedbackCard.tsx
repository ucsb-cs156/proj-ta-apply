import { Card, Form } from "react-bootstrap";
import { toast } from "react-toastify";
import {
  FEEDBACK_SETTINGS_HISTORY_URL,
  FEEDBACK_SETTINGS_SAVE_URL,
  lastAskChange,
  onOff,
  type InstructorFeedbackSettings,
} from "main/utils/feedbackNotesFields";
import { formatPacificDateTime } from "main/utils/pacificTime";
import { useBackend, useBackendMutation } from "main/utils/useBackend";

/** The checkbox's label, verbatim from issue #430. */
export const ASK_FOR_FEEDBACK_LABEL =
  "Ask faculty for feedback on TA/ULA allocations after both have been released to instructors";

type Props = {
  testIdPrefix?: string;
};

/**
 * The global switch of the instructors' allocation feedback (issue #430), at the top of the
 * Instructor Feedback Settings page: while it is off, the instructor home page shows none of the
 * feedback parts of a course and the server refuses saves; what was saved is kept. Saved when
 * clicked, as a new version of the settings that keeps the notes. Says who last changed it, and
 * when.
 */
export default function AskForFeedbackCard({
  testIdPrefix = "AskForFeedbackCard",
}: Props): React.JSX.Element {
  const id = (suffix: string) => `${testIdPrefix}-${suffix}`;

  const { data: history } = useBackend<InstructorFeedbackSettings[] | null>(
    [FEEDBACK_SETTINGS_HISTORY_URL],
    // Stryker disable next-line ObjectLiteral,StringLiteral : axios sends a GET whatever the method says
    { method: "GET", url: FEEDBACK_SETTINGS_HISTORY_URL },
    null,
  );
  const loaded = Array.isArray(history);
  const versions = loaded ? history : [];
  // With no version, instructors are asked, as the server counts it.
  const asking = versions[0]?.askForFeedback ?? true;
  const changed = lastAskChange(versions);

  const saveMutation = useBackendMutation<boolean, InstructorFeedbackSettings>(
    (askForFeedback) => ({
      url: FEEDBACK_SETTINGS_SAVE_URL,
      method: "POST",
      data: { askForFeedback },
    }),
    {
      onSuccess: (saved) => {
        toast(
          saved.askForFeedback
            ? `Saved version ${saved.id}: faculty are now asked for feedback on their TA/ULA allocations`
            : `Saved version ${saved.id}: faculty are no longer asked for feedback on their TA/ULA allocations`,
        );
      },
    },
    [FEEDBACK_SETTINGS_HISTORY_URL],
  );

  return (
    <Card className="mb-4" data-testid={testIdPrefix}>
      <Card.Header as="h2" className="h5 mb-0">
        Asking for feedback
      </Card.Header>
      <Card.Body>
        <Form.Check
          type="checkbox"
          id={id("checkbox")}
          data-testid={id("checkbox")}
          label={ASK_FOR_FEEDBACK_LABEL}
          checked={asking}
          disabled={!loaded || saveMutation.isPending}
          onChange={(event) => saveMutation.mutate(event.target.checked)}
        />
        <p className="text-muted small mt-2 mb-1">
          While this is checked, each course on an instructor&apos;s home page
          has a section for feedback on its allocation: a note saying which
          allocations it waits for, then, once they are released, the feedback
          form and the notes on TA/ULA tradeoffs. While it is unchecked, that
          section is hidden and feedback is not accepted; feedback already given
          is kept, and returns with the form when this is checked again.
        </p>
        {changed && (
          <p className="text-muted small mb-0" data-testid={id("last-change")}>
            {onOff(asking)}
            {changed.editorEmail === null
              ? ` since the app was installed (version ${changed.id}, ${formatPacificDateTime(changed.createdAt)}).`
              : ` since ${changed.editorEmail} saved version ${changed.id}, ${formatPacificDateTime(changed.createdAt)}.`}
          </p>
        )}
      </Card.Body>
    </Card>
  );
}
