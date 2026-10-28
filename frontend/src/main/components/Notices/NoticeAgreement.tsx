import { Card, Form } from "react-bootstrap";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AGREEMENT_LABEL,
  describeVersion,
  type NoticeVersion,
} from "main/utils/notices";

type NoticeAgreementProps = {
  /** The version to show; null or undefined renders nothing at all. */
  notice: NoticeVersion | null | undefined;
  agreed: boolean;
  onChange: (agreed: boolean) => void;
  /** Set after a submit attempt with the box unticked. */
  invalid?: boolean;
  /** Read-only display, e.g. on a summary: the box is shown ticked but cannot be changed. */
  readOnly?: boolean;
  testIdPrefix?: string;
};

/**
 * The "Notices, Terms and Conditions" text an applicant must agree to, with the required checkbox
 * under it. Rendered from Markdown with the same renderer that previews it for the admin.
 */
export default function NoticeAgreement({
  notice,
  agreed,
  onChange,
  invalid = false,
  readOnly = false,
  testIdPrefix = "NoticeAgreement",
}: NoticeAgreementProps): React.JSX.Element | null {
  if (!notice) {
    return null;
  }
  return (
    <Card className="mb-3" data-testid={testIdPrefix}>
      <Card.Header as="h2" className="h5 mb-0">
        Notices, Terms and Conditions
      </Card.Header>
      <Card.Body>
        <div data-testid={`${testIdPrefix}-content`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {notice.content}
          </ReactMarkdown>
        </div>
        <p className="text-muted small" data-testid={`${testIdPrefix}-version`}>
          {describeVersion(notice)}
        </p>
        <Form.Check
          type="checkbox"
          id={`${testIdPrefix}-agree`}
          data-testid={`${testIdPrefix}-agree`}
          label={AGREEMENT_LABEL}
          checked={agreed}
          disabled={readOnly}
          isInvalid={invalid}
          feedback="You must agree to the terms and conditions to continue."
          feedbackType="invalid"
          onChange={(e) => onChange(e.target.checked)}
        />
      </Card.Body>
    </Card>
  );
}
