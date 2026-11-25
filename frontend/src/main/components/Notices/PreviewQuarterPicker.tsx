import { Form } from "react-bootstrap";
import type { NoticePreviewQuarter } from "main/utils/useNoticePreviewQuarter";
import { yyyyqToQyy } from "main/utils/quarterUtilities";

type PreviewQuarterPickerProps = {
  type: "TA" | "ULA";
  preview: NoticePreviewQuarter;
  testIdPrefix: string;
};

/**
 * The "Preview for quarter" box above a versioned notice's editor (issue #192), with its notes when
 * the chosen quarter has no calendar on file or no recruitment of this type yet. Shared by the
 * Notices, Terms and Conditions cards and the Soft Offer Notices card (issue #484).
 */
export default function PreviewQuarterPicker({
  type,
  preview,
  testIdPrefix,
}: PreviewQuarterPickerProps): React.JSX.Element {
  const id = (suffix: string) => `${testIdPrefix}-${suffix}`;
  return (
    <Form.Group
      className="d-flex align-items-center gap-2 mb-2"
      controlId={id("preview-quarter")}
    >
      <Form.Label className="mb-0">Preview for quarter:</Form.Label>
      <Form.Select
        size="sm"
        style={{ width: "8em" }}
        value={preview.previewQuarter}
        onChange={(event) => preview.setPreviewQuarter(event.target.value)}
        data-testid={id("preview-quarter")}
      >
        {preview.quarterOptions.map((quarter) => (
          <option key={quarter} value={quarter}>
            {yyyyqToQyy(quarter)}
          </option>
        ))}
      </Form.Select>
      {preview.calendar === null && (
        <span
          className="text-muted small"
          data-testid={id("preview-no-calendar")}
        >
          The quarter calendar for {preview.previewQyy} is not on file (see
          Admin &rarr; Quarters), so its dates are shown as written.
        </span>
      )}
      {preview.recruitment === undefined && (
        <span
          className="text-muted small"
          data-testid={id("preview-no-recruitment")}
        >
          No {type} recruitment for {preview.previewQyy} yet, so{" "}
          <code>{"${primaryConsiderationDate}"}</code> is shown as written.
        </span>
      )}
    </Form.Group>
  );
}
