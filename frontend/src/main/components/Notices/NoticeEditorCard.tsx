import { useMemo, useState } from "react";
import { Button, Card, Col, Row, Table } from "react-bootstrap";
import ReactMarkdown from "react-markdown";
import { NOTICE_FIELDS_HINT } from "main/utils/noticeFields";
import { Link } from "react-router";
import remarkGfm from "remark-gfm";
import SimpleMdeReact from "react-simplemde-editor";
import "easymde/dist/easymde.min.css";
import { toast } from "react-toastify";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import { describeVersion, type NoticeVersion } from "main/utils/notices";

type NoticeEditorCardProps = {
  type: "TA" | "ULA";
  testIdPrefix?: string;
};

// EasyMDE's own preview / side-by-side / fullscreen buttons are left out: the card has its own
// permanent preview pane, as the citelines comments editor does.
const EASYMDE_TOOLBAR = [
  "bold",
  "italic",
  "heading",
  "|",
  "quote",
  "unordered-list",
  "ordered-list",
  "|",
  "link",
  "table",
  "|",
  "undo",
  "redo",
] as const;

/**
 * The admin's editor for the "Notices, Terms and Conditions" text of one form type. Saving never
 * overwrites: every save appends a new version with its own id and timestamp, and the history is
 * listed under the editor so an admin can see what applicants agreed to and when.
 */
export default function NoticeEditorCard({
  type,
  testIdPrefix = "NoticeEditorCard",
}: NoticeEditorCardProps): React.JSX.Element {
  const historyKey = ["/api/admin/notices/all", type];

  const { data: history } = useBackend<NoticeVersion[]>(
    historyKey,
    { method: "GET", url: "/api/admin/notices/all", params: { type } },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );
  // Stryker disable next-line all : don't test default value of empty list
  const versions = Array.isArray(history) ? history : [];
  const current = versions[0];

  // The admin's unsaved text, or null while they have not touched the editor, in which case the
  // current version is shown. Kept apart from the fetched data so a refetch cannot wipe typing.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? current?.content ?? "";
  // Stryker disable next-line all : with no current version there is nothing to compare to, so
  // any non-empty text is a change whatever the fallback is
  const savedText = (current?.content ?? "").trim();
  const unchanged = text.trim() === savedText;

  const saveMutation = useBackendMutation<string, NoticeVersion>(
    (content) => ({
      url: "/api/admin/notices",
      method: "POST",
      params: { type },
      data: { content },
    }),
    {
      onSuccess: (saved) => {
        toast(`Saved version ${saved.id} of the ${type} notices`);
        setDraft(null);
      },
    },
    // Invalidated by the first element only: the key's type part is a detail of this card.
    ["/api/admin/notices/all"],
  );

  const editorOptions = useMemo(
    () => ({
      spellChecker: false,
      status: false,
      toolbar: EASYMDE_TOOLBAR,
      minHeight: "200px",
    }),
    // Stryker disable next-line all : the options never change, so any dependency list is the same
    [],
  );

  const id = (suffix: string) => `${testIdPrefix}-${suffix}`;

  return (
    <Card className="mb-4" data-testid={testIdPrefix}>
      <Card.Header as="h2" className="h5 mb-0">
        Notices, Terms and Conditions
      </Card.Header>
      <Card.Body>
        <p className="text-muted small">
          Shown to every {type} applicant above a required &ldquo;I agree&rdquo;
          box. Written in Markdown; the preview on the right is what applicants
          see. Each save is kept as a new version, so an application can always
          show the exact text its applicant agreed to.
        </p>
        <p className="text-muted small" data-testid={id("fields-hint")}>
          {NOTICE_FIELDS_HINT}{" "}
          <Link to="/help/notice-fields">All the fields, with examples</Link>.
        </p>
        <Row>
          <Col md={6} data-testid={id("editor")}>
            <SimpleMdeReact
              value={text}
              onChange={(value: string) => setDraft(value)}
              options={editorOptions}
            />
          </Col>
          <Col md={6}>
            <div
              className="border rounded-3 p-3 h-100"
              data-testid={id("preview")}
            >
              {text.trim() === "" ? (
                <span className="text-muted" data-testid={id("preview-empty")}>
                  Nothing written yet.
                </span>
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {text}
                </ReactMarkdown>
              )}
            </div>
          </Col>
        </Row>
        <div className="d-flex align-items-center gap-3 mt-3">
          <Button
            variant="primary"
            data-testid={id("save-button")}
            disabled={text.trim() === "" || unchanged}
            onClick={() => saveMutation.mutate(text.trim())}
          >
            Save as new version
          </Button>
          <span className="text-muted small" data-testid={id("current")}>
            {current
              ? `Current: ${describeVersion(current)}`
              : "No version saved yet: applicants are not shown a notice."}
          </span>
        </div>

        {versions.length > 0 && (
          <>
            <h3 className="h6 mt-4">Version history</h3>
            <Table size="sm" striped bordered data-testid={id("history")}>
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Saved</th>
                  <th>Length</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((version, index) => (
                  <tr key={version.id} data-testid={id(`history-row-${index}`)}>
                    <td>{version.id}</td>
                    <td>{new Date(version.createdAt).toLocaleString()}</td>
                    <td>{version.content.length} characters</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        )}
      </Card.Body>
    </Card>
  );
}
