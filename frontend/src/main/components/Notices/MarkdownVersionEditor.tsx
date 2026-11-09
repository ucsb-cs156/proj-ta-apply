import { formatPacificDateTime } from "main/utils/pacificTime";
import { useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { Button, Col, Row, Table } from "react-bootstrap";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import SimpleMdeReact from "react-simplemde-editor";
import "easymde/dist/easymde.min.css";
import {
  findUnknownFields,
  markUnknownFields,
  UNKNOWN_FIELD_TITLE,
} from "main/utils/noticeFields";
import { describeVersion, type SavedVersion } from "main/utils/notices";

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
 * In the preview, a link titled {@link UNKNOWN_FIELD_TITLE} is an unknown ${field} (issue #192):
 * drawn in red, not as a link. Any other link is rendered as usual.
 */
function PreviewLink({
  title,
  children,
  ...rest
}: ComponentProps<"a">): React.JSX.Element {
  if (title === UNKNOWN_FIELD_TITLE) {
    return <span className="text-danger fw-bold">{children}</span>;
  }
  return (
    <a title={title} {...rest}>
      {children}
    </a>
  );
}

/** A column of the version history beyond the version number, the time saved and the length. */
export type HistoryColumn<V> = {
  header: string;
  cell: (version: V) => ReactNode;
};

type Props<V extends SavedVersion> = {
  testIdPrefix: string;
  /** Every saved version, newest first: the first is the current one. */
  versions: V[];
  /** The Markdown of a version. */
  textOf: (version: V) => string;
  /** Saves the text as a new version, calling `onSaved` once it is stored. */
  onSave: (text: string, onSaved: () => void) => void;
  /** The text with its fields filled in for the preview. */
  fill: (text: string) => string;
  /** The field names this text may carry; any other ${name} is shown in red. */
  knownFields: readonly string[];
  /** The help page listing the fields, linked from each unknown field's message. */
  fieldsHelpPath: string;
  /** Said beside Save while nothing has been saved yet. */
  noVersionMessage: string;
  /** Columns of the history between Saved and Length. */
  historyColumns?: HistoryColumn<V>[];
};

/**
 * A versioned Markdown text's editor, preview, Save button and version history (issues #150, #192
 * and #429), shared by the Notices, Terms and Conditions cards and the Instructor Feedback Settings
 * page. Saving never overwrites: every save appends a new version, and the history lists them all.
 */
export default function MarkdownVersionEditor<V extends SavedVersion>({
  testIdPrefix,
  versions,
  textOf,
  onSave,
  fill,
  knownFields,
  fieldsHelpPath,
  noVersionMessage,
  historyColumns = [],
}: Props<V>): React.JSX.Element {
  const current = versions[0];

  // The admin's unsaved text, or null while they have not touched the editor, in which case the
  // current version is shown. Kept apart from the fetched data so a refetch cannot wipe typing.
  const [draft, setDraft] = useState<string | null>(null);
  const currentText = current === undefined ? "" : textOf(current);
  const text = draft ?? currentText;
  const unchanged = text.trim() === currentText.trim();

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
  const unknownFields = findUnknownFields(text, knownFields);

  return (
    <>
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
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{ a: PreviewLink }}
              >
                {markUnknownFields(fill(text), knownFields)}
              </ReactMarkdown>
            )}
          </div>
          {unknownFields.map((key) => (
            <div
              className="text-danger small mt-1"
              key={key}
              data-testid={id(`unknown-field-${key}`)}
            >
              Unknown {"${" + key + "}"}; see{" "}
              <a
                href={fieldsHelpPath}
                target="_blank"
                rel="noreferrer"
                className="text-danger"
              >
                documentation
              </a>
            </div>
          ))}
        </Col>
      </Row>
      <div className="d-flex align-items-center gap-3 mt-3">
        <Button
          variant="primary"
          data-testid={id("save-button")}
          disabled={text.trim() === "" || unchanged}
          onClick={() => onSave(text.trim(), () => setDraft(null))}
        >
          Save as new version
        </Button>
        <span className="text-muted small" data-testid={id("current")}>
          {current ? `Current: ${describeVersion(current)}` : noVersionMessage}
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
                {historyColumns.map((column) => (
                  <th key={column.header}>{column.header}</th>
                ))}
                <th>Length</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version, index) => (
                <tr key={version.id} data-testid={id(`history-row-${index}`)}>
                  <td>{version.id}</td>
                  <td>{formatPacificDateTime(version.createdAt)}</td>
                  {historyColumns.map((column) => (
                    <td key={column.header}>{column.cell(version)}</td>
                  ))}
                  <td>{textOf(version).length} characters</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </>
  );
}
