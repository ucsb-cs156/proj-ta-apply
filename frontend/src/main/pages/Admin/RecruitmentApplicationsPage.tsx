import { useState } from "react";
import { Button, Form } from "react-bootstrap";
import { useParams } from "react-router";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { useBackend } from "main/utils/useBackend";
import RecruitmentTable, {
  type Recruitment,
} from "main/components/Recruitments/RecruitmentTable";
import AdminApplicationTable from "main/components/Applications/AdminApplicationTable";
import type { Application } from "main/components/Applications/ApplicationTable";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import { receivedText } from "main/utils/adminApplications";
import RecruitmentAuditTrailTable, {
  type RecruitmentAuditTrailPage,
} from "main/components/Recruitments/RecruitmentAuditTrailTable";
import { AUDIT_PAGE_SIZES } from "main/utils/recruitmentAuditTrail";

// Stryker disable next-line all : the page before the first answer; nothing reads its fields
const emptyAuditPage: RecruitmentAuditTrailPage = {
  content: [],
  number: 0,
  size: 10,
  totalElements: 0,
  totalPages: 0,
};

/** An admin's overview of one recruitment's applications: /admin/recruitments/:recruitmentId/applications */
export default function RecruitmentApplicationsPage(): React.JSX.Element {
  const { recruitmentId } = useParams();

  const { data: recruitments } = useBackend<Recruitment[]>(
    ["/api/admin/recruitments/all"],
    { method: "GET", url: "/api/admin/recruitments/all" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );
  const recruitment = (recruitments ?? []).find(
    (r) => String(r.id) === recruitmentId,
  );

  const { data: applications } = useBackend<Application[]>(
    ["/api/admin/applications/all", recruitmentId],
    {
      method: "GET",
      url: "/api/admin/applications/all",
      params: { recruitmentId },
    },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );
  const applicationList = Array.isArray(applications) ? applications : [];

  // Issue #139: the recruitment's own audit trail, paged on the server, newest first.
  const [auditPage, setAuditPage] = useState(0);
  const [auditPageSize, setAuditPageSize] = useState(10);
  const { data: auditTrail } = useBackend<RecruitmentAuditTrailPage>(
    [
      "/api/admin/recruitmentaudittrail/all",
      recruitmentId,
      auditPage,
      auditPageSize,
    ],
    {
      method: "GET",
      url: "/api/admin/recruitmentaudittrail/all",
      params: {
        recruitmentId,
        page: auditPage,
        size: auditPageSize,
        sort: "id",
        direction: "desc",
      },
    },
    emptyAuditPage,
  );
  // Stryker disable next-line OptionalChaining : useBackend always hands back the initial page
  const auditTotalPages = auditTrail?.totalPages ?? 0;

  return (
    <BasicLayout>
      <div className="pt-2">
        <h1>
          Applications
          {recruitment &&
            `: ${recruitment.type} positions, ${yyyyqToQyy(recruitment.quarter)}`}
        </h1>

        <RecruitmentTable
          recruitments={recruitment ? [recruitment] : []}
          testIdPrefix="RecruitmentApplicationsPage-recruitment"
        />

        <h2 className="h4 mt-4" data-testid="RecruitmentApplicationsPage-count">
          {receivedText(applicationList)}
        </h2>

        <AdminApplicationTable
          applications={applicationList}
          type={recruitment?.type ?? "TA"}
          testIdPrefix="RecruitmentApplicationsPage-applications"
        />

        <h2 className="h4 mt-4">Change History</h2>
        <p data-testid="RecruitmentApplicationsPage-audit-intro">
          Every change to this recruitment itself, newest first: when it was
          created, each time it was opened or closed, and each date that
          changed. Changes to individual applications are on the Audit Trail
          page.
        </p>
        <div className="d-flex align-items-end justify-content-between mb-3 gap-3 flex-wrap">
          <Form.Group controlId="recruitment-audit-page-size">
            <Form.Label>Page size</Form.Label>
            <Form.Select
              value={auditPageSize}
              onChange={(event) => {
                setAuditPageSize(Number(event.target.value));
                setAuditPage(0);
              }}
              data-testid="RecruitmentApplicationsPage-audit-page-size"
            >
              {AUDIT_PAGE_SIZES.map((sizeOption) => (
                <option key={sizeOption} value={sizeOption}>
                  {sizeOption}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <div className="d-flex align-items-center gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                setAuditPage((previousPage) => Math.max(previousPage - 1, 0))
              }
              disabled={auditPage === 0}
              data-testid="RecruitmentApplicationsPage-audit-previous"
            >
              Previous
            </Button>
            <span data-testid="RecruitmentApplicationsPage-audit-page-indicator">
              Page {(auditTrail?.number ?? 0) + 1} of{" "}
              {Math.max(auditTotalPages, 1)}
            </span>
            <Button
              variant="secondary"
              onClick={() => setAuditPage((previousPage) => previousPage + 1)}
              disabled={auditPage + 1 >= auditTotalPages}
              data-testid="RecruitmentApplicationsPage-audit-next"
            >
              Next
            </Button>
          </div>
        </div>
        <p data-testid="RecruitmentApplicationsPage-audit-total">
          {/* Stryker disable next-line OptionalChaining : as above */}
          {auditTrail?.totalElements ?? 0} changes recorded.
        </p>
        <RecruitmentAuditTrailTable
          // Stryker disable next-line all : as above; the fallback is never rendered
          rows={auditTrail?.content ?? []}
          testIdPrefix="RecruitmentApplicationsPage-audit"
        />
      </div>
    </BasicLayout>
  );
}
