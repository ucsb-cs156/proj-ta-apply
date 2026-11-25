import { Card } from "react-bootstrap";
import {
  KNOWN_NOTICE_FIELDS,
  NOTICE_FIELDS_HINT,
} from "main/utils/noticeFields";
import { toast } from "react-toastify";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import type { NoticeVersion } from "main/utils/notices";
import MarkdownVersionEditor from "main/components/Notices/MarkdownVersionEditor";
import PreviewQuarterPicker from "main/components/Notices/PreviewQuarterPicker";
import { useNoticePreviewQuarter } from "main/utils/useNoticePreviewQuarter";

type NoticeEditorCardProps = {
  type: "TA" | "ULA";
  testIdPrefix?: string;
};

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
      },
    },
    // Invalidated by the first element only: the key's type part is a detail of this card.
    ["/api/admin/notices/all"],
  );

  const id = (suffix: string) => `${testIdPrefix}-${suffix}`;

  // Issue #192: the preview is filled in for a chosen quarter, by default the one after today's.
  const preview = useNoticePreviewQuarter(type);

  return (
    <Card className="mb-4" data-testid={testIdPrefix}>
      <Card.Header as="h2" className="h5 mb-0">
        Notices, Terms and Conditions
      </Card.Header>
      <Card.Body>
        <p className="text-muted small">
          Shown to every {type} applicant above a required &ldquo;I agree&rdquo;
          box. Written in{" "}
          <a
            href="/help/admins#markdown"
            target="_blank"
            rel="noreferrer"
            data-testid={id("markdown-link")}
          >
            Markdown
          </a>
          ; the preview on the right is what applicants see. Each save is kept
          as a new version, so an application can always show the exact text its
          applicant agreed to.
        </p>
        <p className="text-muted small" data-testid={id("fields-hint")}>
          {NOTICE_FIELDS_HINT}{" "}
          <a href="/help/notice-fields" target="_blank" rel="noreferrer">
            All the fields, with examples
          </a>
          .
        </p>
        <PreviewQuarterPicker
          type={type}
          preview={preview}
          testIdPrefix={testIdPrefix}
        />
        <MarkdownVersionEditor
          testIdPrefix={testIdPrefix}
          versions={versions}
          textOf={(version) => version.content}
          onSave={(text, onSaved) =>
            saveMutation.mutate(text, { onSuccess: onSaved })
          }
          fill={preview.fill}
          knownFields={KNOWN_NOTICE_FIELDS}
          fieldsHelpPath="/help/notice-fields"
          noVersionMessage="No version saved yet: applicants are not shown a notice."
        />
      </Card.Body>
    </Card>
  );
}
