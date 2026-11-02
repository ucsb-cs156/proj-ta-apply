import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Button, Form } from "react-bootstrap";
import { toast } from "react-toastify";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import { useNoticeFillIn } from "main/utils/useNoticeFillIn";
import ApplicationSummary from "main/components/Applications/ApplicationSummary";
import type { Application } from "main/components/Applications/ApplicationTable";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import type { NoticeVersion } from "main/utils/notices";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import {
  adminApplicationEditPath,
  applicationsListPath,
  originLabel,
  submittedText,
} from "main/utils/adminApplications";
import AuditTrailTable, {
  type AuditTrailRow,
} from "main/components/AuditTrail/AuditTrailTable";

/**
 * One application as an admin sees it: /admin/applications/:id. Everything the applicant wrote is
 * read-only; the only thing to edit is the admin's own comments, and Save or Cancel both lead back
 * to the recruitment's list of applications.
 */
export default function AdminApplicationPage(): React.JSX.Element {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: application } = useBackend<Application | null>(
    ["/api/admin/applications", id],
    { method: "GET", url: "/api/admin/applications", params: { id } },
    // Stryker disable next-line all : don't test default value of null
    null,
  );

  const { data: recruitments } = useBackend<Recruitment[]>(
    ["/api/admin/recruitments/all"],
    { method: "GET", url: "/api/admin/recruitments/all" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );
  const recruitment = (recruitments ?? []).find(
    (r) => r.id === application?.recruitmentId,
  );
  const noticeFillIn = useNoticeFillIn(recruitment);

  // The notice version the applicant agreed to, shown back exactly as they saw it.
  const agreedId = application?.noticeVersionId ?? null;
  const { data: notice } = useBackend<NoticeVersion | null>(
    ["/api/notices", agreedId],
    { method: "GET", url: "/api/notices", params: { id: agreedId } },
    // Stryker disable next-line all : don't test default value of null
    null,
    false,
    // Stryker disable next-line all : the guard only avoids a pointless request
    { enabled: agreedId !== null },
  );

  // The comments live in their own state so Cancel can throw away what was typed. Null until the
  // application arrives, so its stored text is not overwritten by an empty default.
  const [comments, setComments] = useState<string | null>(null);
  const commentsText = comments ?? application?.adminComments ?? "";

  const listPath = applicationsListPath(application?.recruitmentId ?? "");

  // Every change an admin has made to this application, oldest first; which id column the rows
  // sit in depends on the recruitment's type, so this waits for the recruitment.
  const { data: auditTrail } = useBackend<AuditTrailRow[]>(
    ["/api/admin/audittrail/application", recruitment?.type, id],
    {
      method: "GET",
      url: "/api/admin/audittrail/application",
      params: { type: recruitment?.type, id },
    },
    // Stryker disable next-line all : don't test default value of empty list
    [],
    false,
    // Stryker disable next-line all : the guard only avoids a pointless request
    { enabled: Boolean(recruitment) },
  );

  const saveMutation = useBackendMutation<string, Application>(
    (adminComments) => ({
      url: "/api/admin/applications/adminComments",
      method: "PUT",
      params: { id, adminComments },
    }),
    {
      onSuccess: () => {
        toast("Admin comments saved.");
        navigate(listPath);
      },
    },
    ["/api/admin/applications", "/api/admin/applications/all"],
  );

  return (
    <BasicLayout>
      <div className="pt-2">
        <h1>
          Application {id}
          {recruitment &&
            `: ${recruitment.type} positions, ${yyyyqToQyy(recruitment.quarter)}`}
        </h1>

        {application && (
          <>
            <Link
              className="btn btn-primary mb-3"
              to={adminApplicationEditPath(id ?? "")}
              data-testid="AdminApplicationPage-edit"
            >
              Edit
            </Link>
            <p data-testid="AdminApplicationPage-about">
              {originLabel(application.origin) || "Application"} from{" "}
              {application.email}, submitted{" "}
              {submittedText(application.submittedAt)}. Status:{" "}
              {application.status}.
            </p>
            {application.postApplicationComments && (
              <p data-testid="AdminApplicationPage-post-comments">
                Post application comments: {application.postApplicationComments}
              </p>
            )}

            <ApplicationSummary
              application={application}
              type={recruitment?.type ?? "TA"}
              notice={notice}
              noticeFillIn={noticeFillIn}
              testIdPrefix="AdminApplicationPage-summary"
            />

            <Form
              className="mt-4"
              onSubmit={(event) => {
                // Stryker disable next-line all : without this a real browser would reload the page
                event.preventDefault();
                saveMutation.mutate(commentsText);
              }}
            >
              <Form.Group className="mb-3">
                <Form.Label htmlFor="AdminApplicationPage-adminComments">
                  Admin Comments
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={5}
                  id="AdminApplicationPage-adminComments"
                  data-testid="AdminApplicationPage-adminComments"
                  value={commentsText}
                  onChange={(event) => setComments(event.target.value)}
                />
              </Form.Group>
              <Button
                type="submit"
                variant="primary"
                data-testid="AdminApplicationPage-save"
              >
                Save
              </Button>
              <Button
                variant="secondary"
                className="ms-2"
                onClick={() => navigate(listPath)}
                data-testid="AdminApplicationPage-cancel"
              >
                Cancel
              </Button>
            </Form>

            <h2 className="h4 mt-4">Audit Trail</h2>
            {(auditTrail ?? []).length === 0 ? (
              <p
                className="text-muted"
                data-testid="AdminApplicationPage-audit-none"
              >
                No admin has changed this application.
              </p>
            ) : (
              <AuditTrailTable
                rows={auditTrail ?? []}
                testIdPrefix="AdminApplicationPage-audit"
              />
            )}
          </>
        )}
      </div>
    </BasicLayout>
  );
}
