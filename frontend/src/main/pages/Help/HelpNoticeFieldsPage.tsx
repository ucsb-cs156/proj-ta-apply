import { Table } from "react-bootstrap";
import { Link } from "react-router";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import {
  fillNoticeFields,
  longDate,
  NOTICE_FIELD_EXAMPLES,
  QUARTER_NOTICE_FIELDS,
  quarterName,
  SAMPLE_CALENDAR,
} from "main/utils/noticeFields";

/** The sample recruitment the examples are shown filled in for. */
const SAMPLE_FILL_IN = {
  quarter: SAMPLE_CALENDAR.quarter,
  primaryConsiderationDate: "2021-09-20",
  calendar: SAMPLE_CALENDAR,
};

/**
 * The fields an admin can write into the Notices, Terms and Conditions text, each with what it
 * becomes (issues #150 and #153): /help/notice-fields, admins only, on the Help menu since it is
 * consulted every time the text is edited.
 */
export default function HelpNoticeFieldsPage(): React.JSX.Element {
  return (
    <BasicLayout>
      <div className="pt-2" data-testid="HelpNoticeFieldsPage">
        <h1 className="my-4">Notices Fields</h1>
        <p>
          The <strong>Notices, Terms and Conditions</strong> text on the{" "}
          <Link to="/admin/settings/ta">TA</Link> and{" "}
          <Link to="/admin/settings/ula">ULA App Settings</Link> pages can carry
          fields, written as <code>{"${name}"}</code>, that are filled in for
          each applicant from the recruitment they are applying to. The
          editor&apos;s preview shows them as written, since it belongs to no
          recruitment; the applicant&apos;s form, the view of a submitted
          application, and the admin&apos;s Test Application show them filled
          in. Anything else between <code>{"${"}</code> and <code>{"}"}</code>{" "}
          is left exactly as typed, and so is a field whose value is not on
          file.
        </p>

        <h2 className="my-3 h4" id="recruitment-fields">
          The recruitment&apos;s own fields
        </h2>
        <Table
          striped
          bordered
          size="sm"
          data-testid="HelpNoticeFieldsPage-recruitment-fields"
        >
          <thead>
            <tr>
              <th>Field</th>
              <th>Becomes</th>
              <th>For example</th>
            </tr>
          </thead>
          <tbody>
            <tr data-testid="HelpNoticeFieldsPage-field-quarter">
              <td>
                <code>{"${quarter}"}</code>
              </td>
              <td>The recruitment&apos;s quarter, written out</td>
              <td>{quarterName(SAMPLE_FILL_IN.quarter)}</td>
            </tr>
            <tr data-testid="HelpNoticeFieldsPage-field-primaryConsiderationDate">
              <td>
                <code>{"${primaryConsiderationDate}"}</code>
              </td>
              <td>Its primary consideration date</td>
              <td>{longDate(SAMPLE_FILL_IN.primaryConsiderationDate)}</td>
            </tr>
          </tbody>
        </Table>

        <h2 className="my-3 h4" id="quarter-fields">
          The quarter&apos;s dates and names
        </h2>
        <p>
          These come from the <Link to="/admin/quarters">Quarters</Link>{" "}
          calendar, for the recruitment&apos;s quarter. If that quarter is not
          on file yet, open the Quarters page once to fetch it; until then the
          fields stay as written. Dates are written out; the registration passes
          carry their time of day. The examples are for {SAMPLE_CALENDAR.name}.
        </p>
        <Table
          striped
          bordered
          size="sm"
          data-testid="HelpNoticeFieldsPage-quarter-fields"
        >
          <thead>
            <tr>
              <th>Field</th>
              <th>Becomes</th>
              <th>For example</th>
            </tr>
          </thead>
          <tbody>
            {QUARTER_NOTICE_FIELDS.map((field) => (
              <tr
                key={field.key}
                data-testid={`HelpNoticeFieldsPage-field-${field.key}`}
              >
                <td>
                  <code>{"${" + field.key + "}"}</code>
                </td>
                <td>{field.label}</td>
                <td>
                  {fillNoticeFields("${" + field.key + "}", SAMPLE_FILL_IN)}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>

        <h2 className="my-3 h4" id="examples">
          Examples
        </h2>
        <p>Each example as it is written, then as an applicant would see it:</p>
        <ul data-testid="HelpNoticeFieldsPage-examples">
          {NOTICE_FIELD_EXAMPLES.map((example) => (
            <li key={example} className="mb-2">
              <code>{example}</code>
              <br />
              <em>{fillNoticeFields(example, SAMPLE_FILL_IN)}</em>
            </li>
          ))}
          <li className="mb-2">
            <code>
              Classes begin on ${"{"}firstDayOfClasses{"}"}; the last day to add
              a course is ${"{"}lastDayToAddUnderGrad{"}"}.
            </code>
            <br />
            <em>
              {fillNoticeFields(
                "Classes begin on ${firstDayOfClasses}; the last day to add a course is ${lastDayToAddUnderGrad}.",
                SAMPLE_FILL_IN,
              )}
            </em>
          </li>
        </ul>
      </div>
    </BasicLayout>
  );
}
