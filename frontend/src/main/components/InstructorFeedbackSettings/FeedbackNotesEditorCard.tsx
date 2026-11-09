import { useState } from "react";
import { Card, Form } from "react-bootstrap";
import { toast } from "react-toastify";
import MarkdownVersionEditor from "main/components/Notices/MarkdownVersionEditor";
import type { BudgetQuarter } from "main/components/Budget/budgetTypes";
import type { TradeoffCosts } from "main/utils/instructorFeedback";
import {
  FEEDBACK_NOTES_FIELDS_HELP_PATH,
  FEEDBACK_NOTES_FIELDS_HINT,
  FEEDBACK_SETTINGS_COSTS_URL,
  FEEDBACK_SETTINGS_HISTORY_URL,
  FEEDBACK_SETTINGS_SAVE_URL,
  fillFeedbackNotesFields,
  KNOWN_FEEDBACK_NOTES_FIELDS,
  type InstructorFeedbackSettings,
} from "main/utils/feedbackNotesFields";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import { useNoticeFillIn } from "main/utils/useNoticeFillIn";

type Props = {
  testIdPrefix?: string;
};

/** Who saved a version; the one the database was installed with has no editor. */
const editorOf = (version: InstructorFeedbackSettings): string =>
  version.editorEmail ?? "(installed with the app)";

/**
 * The admin's editor for the "Notes on TA/ULA tradeoffs" instructors see under their allocation
 * feedback form (issue #429), on the Instructor Feedback Settings page. It works as the Notices,
 * Terms and Conditions cards do: Markdown, a preview filled in for a chosen quarter, and every save
 * kept as a new version, listed with who saved it.
 */
export default function FeedbackNotesEditorCard({
  testIdPrefix = "FeedbackNotesEditorCard",
}: Props): React.JSX.Element {
  const id = (suffix: string) => `${testIdPrefix}-${suffix}`;

  const { data: history } = useBackend<InstructorFeedbackSettings[]>(
    [FEEDBACK_SETTINGS_HISTORY_URL],
    // Stryker disable next-line ObjectLiteral,StringLiteral : axios sends a GET whatever the method says
    { method: "GET", url: FEEDBACK_SETTINGS_HISTORY_URL },
    // Stryker disable next-line ArrayDeclaration : a placeholder until the versions arrive
    [],
  );
  const versions = Array.isArray(history) ? history : [];

  const saveMutation = useBackendMutation<string, InstructorFeedbackSettings>(
    (notesText) => ({
      url: FEEDBACK_SETTINGS_SAVE_URL,
      method: "POST",
      data: { notesText },
    }),
    {
      onSuccess: (saved) => {
        toast(`Saved version ${saved.id} of the notes on TA/ULA tradeoffs`);
      },
    },
    [FEEDBACK_SETTINGS_HISTORY_URL],
  );

  // The preview is filled in for a quarter that has a recruitment, by default the newest.
  const { data: quarterRows } = useBackend<BudgetQuarter[]>(
    // Stryker disable next-line ArrayDeclaration : the cache key is not observable from here
    ["/api/admin/budget/quarters"],
    // Stryker disable next-line ObjectLiteral,StringLiteral : axios sends a GET whatever the method says
    { method: "GET", url: "/api/admin/budget/quarters" },
    // Stryker disable next-line ArrayDeclaration : a placeholder until the quarters arrive
    [],
  );
  const quarters = (Array.isArray(quarterRows) ? quarterRows : []).map(
    (row) => row.quarter,
  );
  const [chosen, setChosen] = useState<string | null>(null);
  const previewQuarter = chosen ?? quarters[0] ?? null;

  const fillIn = useNoticeFillIn(
    previewQuarter === null ? null : { quarter: previewQuarter },
  );
  const { data: costs } = useBackend<TradeoffCosts | null>(
    [FEEDBACK_SETTINGS_COSTS_URL, previewQuarter],
    {
      // Stryker disable next-line StringLiteral : axios sends a GET whatever the method says
      method: "GET",
      url: FEEDBACK_SETTINGS_COSTS_URL,
      params: { quarter: previewQuarter },
    },
    null,
    false,
    { enabled: previewQuarter !== null },
  );

  const fill = (text: string) =>
    previewQuarter === null
      ? text
      : fillFeedbackNotesFields(text, {
          quarter: previewQuarter,
          calendar: fillIn?.calendar,
          costs,
        });

  return (
    <Card className="mb-4" data-testid={testIdPrefix}>
      <Card.Header as="h2" className="h5 mb-0">
        Notes on TA/ULA tradeoffs
      </Card.Header>
      <Card.Body>
        <p className="text-muted small">
          Shown to every instructor under the feedback form on their
          course&apos;s allocation, on their home page, in a section they open
          themselves. Written in{" "}
          <a
            href="/help/admins#markdown"
            target="_blank"
            rel="noreferrer"
            data-testid={id("markdown-link")}
          >
            Markdown
          </a>
          ; the preview on the right is what instructors see. Each save is kept
          as a new version; instructors always see the newest.
        </p>
        <p className="text-muted small" data-testid={id("fields-hint")}>
          {FEEDBACK_NOTES_FIELDS_HINT}{" "}
          <a
            href={FEEDBACK_NOTES_FIELDS_HELP_PATH}
            target="_blank"
            rel="noreferrer"
          >
            All the fields, with examples
          </a>
          .
        </p>
        <Form.Group
          className="d-flex align-items-center gap-2 mb-2"
          controlId={id("preview-quarter")}
        >
          <Form.Label className="mb-0">Preview for quarter:</Form.Label>
          {previewQuarter === null ? (
            <span
              className="text-muted small"
              data-testid={id("preview-no-quarter")}
            >
              No quarter has a recruitment yet, so the fields are shown as
              written.
            </span>
          ) : (
            <Form.Select
              size="sm"
              style={{ width: "8em" }}
              value={previewQuarter}
              onChange={(event) => setChosen(event.target.value)}
              data-testid={id("preview-quarter")}
            >
              {quarters.map((quarter) => (
                <option key={quarter} value={quarter}>
                  {yyyyqToQyy(quarter)}
                </option>
              ))}
            </Form.Select>
          )}
        </Form.Group>
        <MarkdownVersionEditor
          testIdPrefix={testIdPrefix}
          versions={versions}
          textOf={(version) => version.notesText}
          onSave={(text, onSaved) =>
            saveMutation.mutate(text, { onSuccess: onSaved })
          }
          fill={fill}
          knownFields={KNOWN_FEEDBACK_NOTES_FIELDS}
          fieldsHelpPath={FEEDBACK_NOTES_FIELDS_HELP_PATH}
          noVersionMessage="No version saved yet: instructors are not shown any notes."
          historyColumns={[{ header: "Editor", cell: editorOf }]}
        />
      </Card.Body>
    </Card>
  );
}
