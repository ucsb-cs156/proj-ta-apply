import { useMemo } from "react";
import { useParams } from "react-router";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { useBackend } from "main/utils/useBackend";
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
import type { RecruitmentCourse } from "main/components/Recruitments/RecruitmentCourseTable";
import FakeApplicationsControls from "main/components/Applications/FakeApplicationsControls";
import { useDeveloperModeFooterControls } from "main/utils/developerModeFooter";

/**
 * An admin's overview of one recruitment's applications: /admin/recruitments/:recruitmentId/applications.
 * The recruitment's own change history, once a card at the bottom of this page, has its own page
 * since issue #390 (RecruitmentHistoryPage, from the card's Change History button).
 */
export default function RecruitmentApplicationsPage(): React.JSX.Element {
  const { recruitmentId } = useParams();

  // Stryker disable all : the query keys and axios's default GET are not observable; what the
  // requests carry, and what is done with the answers, is tested
  const { data: recruitments } = useBackend<Recruitment[]>(
    ["/api/admin/recruitments/all"],
    { method: "GET", url: "/api/admin/recruitments/all" },
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
    [],
  );
  // Stryker restore all
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

  const columnChoices = applicationColumnChoices(recruitment?.type ?? "TA");
  // Issue #189: which columns the admin has hidden, kept on the backend; see the shared code.
  const { hiddenColumns, toggleColumn } = useHiddenApplicationColumns(
    recruitmentId,
    recruitment?.type,
  );

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
            choices={columnChoices}
            hidden={hiddenColumns}
            onToggle={toggleColumn}
            testIdPrefix="RecruitmentApplicationsPage-columns"
          />
        </div>
        <AdminApplicationTable
          applications={applicationList}
          type={recruitment?.type ?? "TA"}
          hiddenColumns={hiddenColumns}
          hideLinks={{
            choices: columnChoices,
            onHide: (columnId) => toggleColumn(columnId, true),
          }}
          testIdPrefix="RecruitmentApplicationsPage-applications"
        />
      </div>
    </BasicLayout>
  );
}
