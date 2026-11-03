import { useMemo, useState } from "react";
import { Button, Form } from "react-bootstrap";
import { useParams } from "react-router";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { useBackend } from "main/utils/useBackend";
import CollapsibleCard from "main/components/Common/CollapsibleCard";
import ColumnVisibilityControl from "main/components/Common/ColumnVisibilityControl";
import { applicationColumnChoices } from "main/utils/applicationColumns";
import { useHiddenApplicationColumns } from "main/utils/useHiddenApplicationColumns";
import RecruitmentTable, {
  type Recruitment,
} from "main/components/Recruitments/RecruitmentTable";
import AdminApplicationTable from "main/components/Applications/AdminApplicationTable";
import ApplicationsPageHeader from "main/components/Applications/ApplicationsPageHeader";
import type { Application } from "main/components/Applications/ApplicationTable";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import { receivedText } from "main/utils/adminApplications";
import RecruitmentAuditTrailTable, {
  type RecruitmentAuditTrailPage,
} from "main/components/Recruitments/RecruitmentAuditTrailTable";
import { AUDIT_PAGE_SIZES } from "main/utils/recruitmentAuditTrail";
import type { RecruitmentCourse } from "main/components/Recruitments/RecruitmentCourseTable";
import FakeApplicationsControls from "main/components/Applications/FakeApplicationsControls";
import { useDeveloperModeFooterControls } from "main/utils/developerModeFooter";

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

  // Issue #219: Developer Mode's fake applications are created and deleted from the footer. How many
  // may be asked for depends on how many courses the recruitment has left.
  const { data: courses } = useBackend<RecruitmentCourse[]>(
    ["/api/recruitmentcourses/all", false],
    {
      method: "GET",
      url: "/api/recruitmentcourses/all",
      params: { recruitmentId, includeRemoved: false },
    },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );
  const courseCount = (Array.isArray(courses) ? courses : []).filter(
    (c) => !c.removed,
  ).length;
  const fakeApplicationsControls = useMemo(
    () => (
      <FakeApplicationsControls
        recruitmentId={recruitmentId}
        courseCount={courseCount}
        testIdPrefix="RecruitmentApplicationsPage-fake"
      />
    ),
    [recruitmentId, courseCount],
  );
  useDeveloperModeFooterControls(fakeApplicationsControls);

  // Issue #189: which columns the admin has hidden, kept on the backend; see the shared code.
  const { hiddenColumns, toggleColumn } = useHiddenApplicationColumns(
    recruitmentId,
    recruitment?.type,
  );

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
  // useBackend always hands back the initial page, so the guards below never fire; the Previous
  // button is disabled on the first page, so its clamp is never exercised either.
  // Stryker disable next-line all
  const auditTotalPages = auditTrail?.totalPages ?? 0;
  // Stryker disable next-line all
  const auditPageNumber = auditTrail?.number ?? 0;
  // Stryker disable next-line all
  const auditTotal = auditTrail?.totalElements ?? 0;
  // Stryker disable next-line all
  const auditRows = auditTrail?.content ?? [];
  const previousAuditPage = () =>
    // Stryker disable next-line all
    setAuditPage((previousPage) => Math.max(previousPage - 1, 0));

  return (
    <BasicLayout>
      <div className="pt-2">
        <ApplicationsPageHeader
          // Stryker disable next-line StringLiteral : the route always supplies the id
          recruitmentId={recruitmentId ?? ""}
          title={`Applications${
            recruitment
              ? `: ${recruitment.type} positions, ${yyyyqToQyy(recruitment.quarter)}`
              : ""
          }`}
          testIdPrefix="RecruitmentApplicationsPage-header"
        />

        <RecruitmentTable
          recruitments={recruitment ? [recruitment] : []}
          testIdPrefix="RecruitmentApplicationsPage-recruitment"
        />

        <h2 className="h4 mt-4" data-testid="RecruitmentApplicationsPage-count">
          {receivedText(applicationList)}
        </h2>

        <div className="mb-2">
          <ColumnVisibilityControl
            choices={applicationColumnChoices(recruitment?.type ?? "TA")}
            hidden={hiddenColumns}
            onToggle={toggleColumn}
            testIdPrefix="RecruitmentApplicationsPage-columns"
          />
        </div>
        <AdminApplicationTable
          applications={applicationList}
          type={recruitment?.type ?? "TA"}
          hiddenColumns={hiddenColumns}
          testIdPrefix="RecruitmentApplicationsPage-applications"
        />

        <CollapsibleCard
          title="Change History"
          storageKey="RecruitmentApplicationsPage-changeHistory"
          testIdPrefix="RecruitmentApplicationsPage-changeHistory"
        >
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
                onClick={previousAuditPage}
                disabled={auditPage === 0}
                data-testid="RecruitmentApplicationsPage-audit-previous"
              >
                Previous
              </Button>
              <span data-testid="RecruitmentApplicationsPage-audit-page-indicator">
                Page {auditPageNumber + 1} of {Math.max(auditTotalPages, 1)}
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
            {auditTotal} changes recorded.
          </p>
          <RecruitmentAuditTrailTable
            rows={auditRows}
            testIdPrefix="RecruitmentApplicationsPage-audit"
          />
        </CollapsibleCard>
      </div>
    </BasicLayout>
  );
}
