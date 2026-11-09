import { useState } from "react";
import { Card, Form } from "react-bootstrap";
import {
  defaultPreviewQuarter,
  fillNoticeFields,
  KNOWN_NOTICE_FIELDS,
  NOTICE_FIELDS_HINT,
} from "main/utils/noticeFields";
import type { UcsbApiQuarter } from "main/utils/quarterCalendar";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import { toast } from "react-toastify";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import type { NoticeVersion } from "main/utils/notices";
import MarkdownVersionEditor from "main/components/Notices/MarkdownVersionEditor";

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

  // Issue #192: the preview is filled in for a chosen quarter, by default the one after today's,
  // from the quarter calendar on file and that quarter's recruitment of this type, if any.
  const { data: calendarRows } = useBackend<UcsbApiQuarter[]>(
    // Stryker disable next-line all : the query key is only observable through invalidation
    ["/api/admin/quarters/all", "desc"],
    {
      // Stryker disable next-line all : GET is axios's default method
      method: "GET",
      url: "/api/admin/quarters/all",
      params: { direction: "desc" },
    },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );
  const { data: recruitments } = useBackend<Recruitment[]>(
    // Stryker disable next-line all : the query key is only observable through invalidation
    ["/api/admin/recruitments/all"],
    // Stryker disable next-line all : GET is axios's default method
    { method: "GET", url: "/api/admin/recruitments/all" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );
  const [previewQuarter, setPreviewQuarter] = useState(() =>
    defaultPreviewQuarter(),
  );
  // Stryker disable next-line all : the query's initial data is an empty list, never undefined
  const calendars = calendarRows ?? [];
  // The quarters on file, plus the chosen one if it is not among them, so the box always shows it.
  const quarterOptions = calendars.some((row) => row.quarter === previewQuarter)
    ? calendars.map((row) => row.quarter)
    : [previewQuarter, ...calendars.map((row) => row.quarter)];
  const calendar =
    calendars.find((row) => row.quarter === previewQuarter) ?? null;
  // Stryker disable next-line all : the query's initial data is an empty list, never undefined
  const recruitment = (recruitments ?? []).find(
    (r) => r.quarter === previewQuarter && r.type === type,
  );
  const fill = (text: string) =>
    fillNoticeFields(text, {
      quarter: previewQuarter,
      primaryConsiderationDate: recruitment?.primaryConsiderationDate,
      calendar,
    });
  const previewQyy = yyyyqToQyy(previewQuarter);

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
        <Form.Group
          className="d-flex align-items-center gap-2 mb-2"
          controlId={id("preview-quarter")}
        >
          <Form.Label className="mb-0">Preview for quarter:</Form.Label>
          <Form.Select
            size="sm"
            style={{ width: "8em" }}
            value={previewQuarter}
            onChange={(event) => setPreviewQuarter(event.target.value)}
            data-testid={id("preview-quarter")}
          >
            {quarterOptions.map((quarter) => (
              <option key={quarter} value={quarter}>
                {yyyyqToQyy(quarter)}
              </option>
            ))}
          </Form.Select>
          {calendar === null && (
            <span
              className="text-muted small"
              data-testid={id("preview-no-calendar")}
            >
              The quarter calendar for {previewQyy} is not on file (see Admin
              &rarr; Quarters), so its dates are shown as written.
            </span>
          )}
          {recruitment === undefined && (
            <span
              className="text-muted small"
              data-testid={id("preview-no-recruitment")}
            >
              No {type} recruitment for {previewQyy} yet, so{" "}
              <code>{"${primaryConsiderationDate}"}</code> is shown as written.
            </span>
          )}
        </Form.Group>
        <MarkdownVersionEditor
          testIdPrefix={testIdPrefix}
          versions={versions}
          textOf={(version) => version.content}
          onSave={(text, onSaved) =>
            saveMutation.mutate(text, { onSuccess: onSaved })
          }
          fill={fill}
          knownFields={KNOWN_NOTICE_FIELDS}
          fieldsHelpPath="/help/notice-fields"
          noVersionMessage="No version saved yet: applicants are not shown a notice."
        />
      </Card.Body>
    </Card>
  );
}
