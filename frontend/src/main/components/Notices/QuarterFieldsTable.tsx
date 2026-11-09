import { Table } from "react-bootstrap";
import {
  fillNoticeFields,
  QUARTER_NOTICE_FIELDS,
  SAMPLE_CALENDAR,
} from "main/utils/noticeFields";

/**
 * The quarter calendar's fields (issue #153), each with what it holds and its value for
 * {@link SAMPLE_CALENDAR}: shared by the help pages of the texts that carry them, the Notices
 * Fields page and (issue #429) the Instructor Feedback Fields page.
 */
export default function QuarterFieldsTable({
  testIdPrefix,
}: {
  testIdPrefix: string;
}): React.JSX.Element {
  return (
    <Table
      striped
      bordered
      size="sm"
      data-testid={`${testIdPrefix}-quarter-fields`}
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
            data-testid={`${testIdPrefix}-field-${field.key}`}
          >
            <td>
              <code>{"${" + field.key + "}"}</code>
            </td>
            <td>{field.label}</td>
            <td>
              {fillNoticeFields("${" + field.key + "}", {
                calendar: SAMPLE_CALENDAR,
              })}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
