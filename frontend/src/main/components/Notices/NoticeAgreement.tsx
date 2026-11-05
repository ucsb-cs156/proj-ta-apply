import { Card, Form } from "react-bootstrap";
import { Link } from "react-router";
import RequiredField from "main/components/Common/RequiredField";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AGREEMENT_LABEL,
  describeVersion,
  noticesHelpPath,
  type NoticeVersion,
} from "main/utils/notices";
import { fillNoticeFields, type NoticeFillIn } from "main/utils/noticeFields";

type NoticeAgreementProps = {
  /** The version to show; null or undefined renders nothing at all. */
  notice: NoticeVersion | null | undefined;
  agreed: boolean;
  onChange: (agreed: boolean) => void;
  /** Set after a submit attempt with the box unticked. */
  invalid?: boolean;
  /** Read-only display, e.g. on a summary: the box is shown ticked but cannot be changed. */
  readOnly?: boolean;
  /** The recruitment's values for `${quarter}` and `${primaryConsiderationDate}` (issue #150). */
  fillIn?: NoticeFillIn | null;
  /** Which kind of application this is; picks the Help page the version line links to (issue #325). */
  type: "TA" | "ULA";
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
  fillIn = null,
  type,
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
            {fillNoticeFields(notice.content, fillIn)}
          </ReactMarkdown>
        </div>
        <p
          className="text-muted small text-end"
          data-testid={`${testIdPrefix}-version`}
        >
          {describeVersion(notice)} (
          <Link
            to={noticesHelpPath(type)}
            data-testid={`${testIdPrefix}-version-help`}
          >
            what is this?
          </Link>
          )
        </p>
        <Form.Check
          type="checkbox"
          id={`${testIdPrefix}-agree`}
          data-testid={`${testIdPrefix}-agree`}
          label={
            <>
              {AGREEMENT_LABEL} <RequiredField />
            </>
          }
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
