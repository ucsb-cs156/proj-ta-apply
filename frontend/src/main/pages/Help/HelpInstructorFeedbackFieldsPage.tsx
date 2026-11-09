import { Table } from "react-bootstrap";
import { Link } from "react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import QuarterFieldsTable from "main/components/Notices/QuarterFieldsTable";
import {
  COST_FIELDS,
  fillFeedbackNotesFields,
  ORIGINAL_FEEDBACK_NOTES,
} from "main/utils/feedbackNotesFields";
import { quarterName, SAMPLE_CALENDAR } from "main/utils/noticeFields";

/** The sample quarter the examples are filled in for: $12,000.00 per TA, $2,000.00 per ULA. */
const SAMPLE_FILL_IN = {
  quarter: SAMPLE_CALENDAR.quarter,
  calendar: SAMPLE_CALENDAR,
  costs: {
    quarter: SAMPLE_CALENDAR.quarter,
    estimatedCostPerTA: 12000,
    estimatedCostPerULA: 2000,
  },
};

/**
 * The fields an admin can write into the "Notes on TA/ULA tradeoffs" on the Instructor Feedback
 * Settings page, each with what it becomes (issue #429): /help/instructor-feedback-fields, admins
 * only. A sibling of the Notices Fields page, whose fields are filled from a recruitment.
 */
export default function HelpInstructorFeedbackFieldsPage(): React.JSX.Element {
  return (
    <BasicLayout>
      <div className="pt-2" data-testid="HelpInstructorFeedbackFieldsPage">
        <h1 className="my-4">Instructor Feedback Fields</h1>
        <p>
          The <strong>Notes on TA/ULA tradeoffs</strong> on the{" "}
          <Link to="/admin/instructorFeedbackSettings">
            Instructor Feedback Settings
          </Link>{" "}
          page can carry fields, written as <code>{"${name}"}</code>, that are
          filled in for each instructor from the quarter of the course they are
          giving feedback on. They are the fields of the{" "}
          <Link to="/help/notice-fields">Notices</Link>, except{" "}
          <code>{"${primaryConsiderationDate}"}</code>, which belongs to a
          recruitment rather than a quarter and so stays as written here, and
          three of their own, from the quarter&apos;s budget. Anything else
          between <code>{"${"}</code> and <code>{"}"}</code> is left exactly as
          typed, and so is a quarter field whose value is not on file.
        </p>

        <h2 className="my-3 h4" id="cost-fields">
          The quarter&apos;s costs
        </h2>
        <p>
          These come from the quarter&apos;s{" "}
          <Link to="/admin/budget/selectQuarter">Budget for Quarter</Link> page.
          A cost that has not been entered, or is zero, reads &ldquo;not yet
          set&rdquo;, and so does the ratio, which needs both. The examples are
          for a TA at $12,000.00 and a ULA at $2,000.00.
        </p>
        <Table
          striped
          bordered
          size="sm"
          data-testid="HelpInstructorFeedbackFieldsPage-cost-fields"
        >
          <thead>
            <tr>
              <th>Field</th>
              <th>Becomes</th>
              <th>For example</th>
            </tr>
          </thead>
          <tbody>
            {COST_FIELDS.map((field) => (
              <tr
                key={field.key}
                data-testid={`HelpInstructorFeedbackFieldsPage-field-${field.key}`}
              >
                <td>
                  <code>{"${" + field.key + "}"}</code>
                </td>
                <td>{field.label}</td>
                <td>
                  {fillFeedbackNotesFields(
                    "${" + field.key + "}",
                    SAMPLE_FILL_IN,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>

        <h2 className="my-3 h4" id="quarter-fields">
          The quarter&apos;s name and dates
        </h2>
        <p>
          <code>{"${quarter}"}</code> is the quarter written out, such as{" "}
          {quarterName(SAMPLE_CALENDAR.quarter)}. The others come from the{" "}
          <Link to="/admin/quarters">Quarters</Link> calendar, as for the
          notices. The examples are for {SAMPLE_CALENDAR.name}.
        </p>
        <QuarterFieldsTable testIdPrefix="HelpInstructorFeedbackFieldsPage" />

        <h2 className="my-3 h4" id="example">
          Example
        </h2>
        <p>
          The notes as they were first installed, written with the cost fields,
          then as an instructor would see them for {SAMPLE_CALENDAR.name}:
        </p>
        <pre
          className="border rounded-3 p-3 text-wrap"
          data-testid="HelpInstructorFeedbackFieldsPage-example-written"
        >
          {ORIGINAL_FEEDBACK_NOTES}
        </pre>
        <div
          className="border rounded-3 p-3"
          data-testid="HelpInstructorFeedbackFieldsPage-example-filled"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {fillFeedbackNotesFields(ORIGINAL_FEEDBACK_NOTES, SAMPLE_FILL_IN)}
          </ReactMarkdown>
        </div>
      </div>
    </BasicLayout>
  );
}
