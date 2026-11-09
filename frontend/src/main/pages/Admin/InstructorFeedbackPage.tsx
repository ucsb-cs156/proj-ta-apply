import { Link, useParams } from "react-router";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import ColumnVisibilityControl from "main/components/Common/ColumnVisibilityControl";
import InstructorFeedbackTable from "main/components/InstructorFeedback/InstructorFeedbackTable";
import {
  FEEDBACK_COLUMN_CHOICES,
  FEEDBACK_COLUMNS_STORAGE_KEY,
  type InstructorFeedbackRow,
} from "main/utils/instructorFeedbackColumns";
import { useBackend } from "main/utils/useBackend";
import { useStoredHiddenColumns } from "main/utils/useStoredHiddenColumns";
import { qyyToYyyyq } from "main/utils/quarterUtilities";

const FEEDBACK_URL = "/api/admin/instructorFeedback";

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
          testIdPrefix="InstructorFeedbackPage-table"
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
      </div>
    </BasicLayout>
  );
}
