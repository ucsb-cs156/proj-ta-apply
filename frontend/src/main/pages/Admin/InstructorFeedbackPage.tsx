import { Link, useParams } from "react-router";
import { Button } from "react-bootstrap";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import ColumnVisibilityControl from "main/components/Common/ColumnVisibilityControl";
import InstructorFeedbackTable from "main/components/InstructorFeedback/InstructorFeedbackTable";
import MissingFeedbackTable from "main/components/InstructorFeedback/MissingFeedbackTable";
import {
  FEEDBACK_COLUMN_CHOICES,
  COPY_MISSING_LABEL,
  FEEDBACK_COLUMNS_STORAGE_KEY,
  MISSING_HEADING,
  emailsCopiedText,
  missingFeedbackEmails,
  type InstructorFeedbackRow,
  type MissingFeedbackRow,
} from "main/utils/instructorFeedbackColumns";
import { EMAIL_COPIED, copyToClipboard } from "main/utils/clipboard";
import { useBackend } from "main/utils/useBackend";
import { useStoredHiddenColumns } from "main/utils/useStoredHiddenColumns";
import { qyyToYyyyq } from "main/utils/quarterUtilities";

const FEEDBACK_URL = "/api/admin/instructorFeedback";
const MISSING_URL = "/api/admin/instructorFeedback/missing";

/**
 * Admin → home page → a quarter card's Instructor Feedback button: /admin/instructorFeedback/:qyy
 * (issue #427). Every instructor's feedback on their TA/ULA allocation in the quarter (issue
 * #425), one row per course and instructor, read only. Which columns are hidden is remembered in
 * this browser; every column starts shown.
 */
export default function InstructorFeedbackPage(): React.JSX.Element {
  const { qyy } = useParams();
  const yyyyq = qyyToYyyyq(qyy);

  const { data: rows } = useBackend<InstructorFeedbackRow[] | null>(
    // Stryker disable next-line ArrayDeclaration : the key is only observable through invalidation, and nothing on this page invalidates
    [FEEDBACK_URL, yyyyq],
    // Stryker disable next-line StringLiteral : GET is axios's default method
    { method: "GET", url: FEEDBACK_URL, params: { quarter: yyyyq } },
    null,
    false,
    { enabled: yyyyq !== null },
  );
  const { data: missing } = useBackend<MissingFeedbackRow[] | null>(
    // Stryker disable next-line ArrayDeclaration : the key is only observable through invalidation, and nothing on this page invalidates
    [MISSING_URL, yyyyq],
    // Stryker disable next-line StringLiteral : GET is axios's default method
    { method: "GET", url: MISSING_URL, params: { quarter: yyyyq } },
    null,
    false,
    { enabled: yyyyq !== null },
  );
  const { hiddenColumns, toggleColumn } = useStoredHiddenColumns(
    FEEDBACK_COLUMNS_STORAGE_KEY,
    [],
  );

  if (yyyyq === null) {
    return (
      <BasicLayout>
        <div className="pt-2" data-testid="InstructorFeedbackPage">
          <h1>Instructor Feedback</h1>
          <p data-testid="InstructorFeedbackPage-bad-quarter">
            &ldquo;{qyy}&rdquo; is not a quarter. Quarters are written as a
            letter and two digits, such as F26.{" "}
            <Link to="/">Choose a quarter on the home page</Link>.
          </p>
        </div>
      </BasicLayout>
    );
  }

  let body: React.JSX.Element;
  if (!rows) {
    body = <p data-testid="InstructorFeedbackPage-loading">Loading…</p>;
  } else if (rows.length === 0) {
    body = (
      <p data-testid="InstructorFeedbackPage-empty">
        No instructor has given feedback on their allocation for {qyy} yet.
      </p>
    );
  } else {
    body = (
      <>
        <div className="mb-2">
          <ColumnVisibilityControl
            choices={FEEDBACK_COLUMN_CHOICES}
            hidden={hiddenColumns}
            onToggle={toggleColumn}
            testIdPrefix="InstructorFeedbackPage-columns"
          />
        </div>
        <InstructorFeedbackTable
          rows={rows}
          hiddenColumns={hiddenColumns}
          onHide={(columnId) => toggleColumn(columnId, true)}
          onCopyEmail={(email) => copyToClipboard(email, EMAIL_COPIED)}
          testIdPrefix="InstructorFeedbackPage-table"
        />
      </>
    );
  }

  let missingBody: React.JSX.Element;
  if (!missing) {
    missingBody = (
      <p data-testid="InstructorFeedbackPage-missing-loading">Loading…</p>
    );
  } else if (missing.length === 0) {
    missingBody = (
      <p data-testid="InstructorFeedbackPage-missing-empty">
        Every instructor has given feedback.
      </p>
    );
  } else {
    const emails = missingFeedbackEmails(missing);
    missingBody = (
      <>
        <div className="mb-2">
          <Button
            variant="outline-primary"
            size="sm"
            disabled={emails.length === 0}
            onClick={() =>
              copyToClipboard(
                emails.join("\n"),
                emailsCopiedText(emails.length),
              )
            }
            data-testid="InstructorFeedbackPage-copy-missing-emails"
          >
            {COPY_MISSING_LABEL}
          </Button>
        </div>
        <MissingFeedbackTable
          rows={missing}
          onCopyEmail={(email) => copyToClipboard(email, EMAIL_COPIED)}
          testIdPrefix="InstructorFeedbackPage-missing"
        />
      </>
    );
  }

  return (
    <BasicLayout>
      <div className="pt-2" data-testid="InstructorFeedbackPage">
        <h1>Instructor Feedback for {qyy}</h1>
        <p>
          What instructors said about the TA and ULA allocations of their
          courses, beside each course&apos;s current allocations.{" "}
          <Link to={`/admin/allocations/${qyy}`}>Combined allocations</Link>
        </p>
        {body}
        <h2 className="mt-4">{MISSING_HEADING}</h2>
        <p>
          The instructors of the quarter&apos;s courses who have not checked any
          box of the feedback form, including those who have never opened it.
        </p>
        {missingBody}
      </div>
    </BasicLayout>
  );
}
