import { Card } from "react-bootstrap";
import { toast } from "react-toastify";
import {
  KNOWN_NOTICE_FIELDS,
  NOTICE_FIELDS_HINT,
} from "main/utils/noticeFields";
import {
  SOFT_OFFER_CHOICES,
  SOFT_OFFER_NOTICES_HISTORY_URL,
  SOFT_OFFER_NOTICES_SAVE_URL,
  SOFT_OFFER_NOTICES_TITLE,
  type SoftOfferNoticeVersion,
} from "main/utils/softOfferNotices";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import { useNoticePreviewQuarter } from "main/utils/useNoticePreviewQuarter";
import MarkdownVersionEditor from "main/components/Notices/MarkdownVersionEditor";
import PreviewQuarterPicker from "main/components/Notices/PreviewQuarterPicker";

type SoftOfferNoticeEditorCardProps = {
  testIdPrefix?: string;
};

/**
 * The admin's editor for the "Soft Offer Notices" text (issue #484), on ULA App Settings below the
 * Notices, Terms and Conditions card and built the same way: Markdown with the notice fields, a
 * preview filled in for a chosen quarter, and every save kept as a new version.
 */
export default function SoftOfferNoticeEditorCard({
  testIdPrefix = "SoftOfferNoticeEditorCard",
}: SoftOfferNoticeEditorCardProps): React.JSX.Element {
  const { data: history } = useBackend<SoftOfferNoticeVersion[]>(
    [SOFT_OFFER_NOTICES_HISTORY_URL],
    // Stryker disable next-line ObjectLiteral,StringLiteral : axios sends a GET whatever the method says
    { method: "GET", url: SOFT_OFFER_NOTICES_HISTORY_URL },
    // Stryker disable next-line ArrayDeclaration : a placeholder until the versions arrive
    [],
  );
  const versions = Array.isArray(history) ? history : [];

  const saveMutation = useBackendMutation<string, SoftOfferNoticeVersion>(
    (content) => ({
      url: SOFT_OFFER_NOTICES_SAVE_URL,
      method: "POST",
      data: { content },
    }),
    {
      onSuccess: (saved) => {
        toast(`Saved version ${saved.id} of the soft offer notices`);
      },
    },
    [SOFT_OFFER_NOTICES_HISTORY_URL],
  );

  const id = (suffix: string) => `${testIdPrefix}-${suffix}`;
  const preview = useNoticePreviewQuarter("ULA");

  return (
    <Card className="mb-4" data-testid={testIdPrefix}>
      <Card.Header as="h2" className="h5 mb-0">
        {SOFT_OFFER_NOTICES_TITLE}
      </Card.Header>
      <Card.Body>
        <p className="text-muted small" data-testid={id("explanation")}>
          When the optional &ldquo;Release Soft Offers&rdquo; feature is used,
          this text is shown to ULA applicants who have been assigned to a
          course. The applicant is asked to choose either:
        </p>
        <ul className="text-muted small" data-testid={id("choices")}>
          {SOFT_OFFER_CHOICES.map((choice) => (
            <li key={choice}>( ) {choice}</li>
          ))}
        </ul>
        <p className="text-muted small">
          Written in{" "}
          <a
            href="/help/admins#markdown"
            target="_blank"
            rel="noreferrer"
            data-testid={id("markdown-link")}
          >
            Markdown
          </a>
          ; the preview on the right is what applicants see. Each save is kept
          as a new version, so a response can always show the exact text its
          applicant read.
        </p>
        <p className="text-muted small" data-testid={id("fields-hint")}>
          {NOTICE_FIELDS_HINT}{" "}
          <a href="/help/notice-fields" target="_blank" rel="noreferrer">
            All the fields, with examples
          </a>
          .
        </p>
        <PreviewQuarterPicker
          type="ULA"
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
          noVersionMessage="No version saved yet: a soft offer shows the course details and the question without a notice."
        />
      </Card.Body>
    </Card>
  );
}
