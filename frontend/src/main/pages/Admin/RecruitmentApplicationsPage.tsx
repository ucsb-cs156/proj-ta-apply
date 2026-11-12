import { useMemo } from "react";
import { useParams } from "react-router";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { toast } from "react-toastify";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import ColumnVisibilityControl from "main/components/Common/ColumnVisibilityControl";
import { applicationColumnChoices } from "main/utils/applicationColumns";
import { useHiddenApplicationColumns } from "main/utils/useHiddenApplicationColumns";
import RecruitmentTable, {
  type Recruitment,
} from "main/components/Recruitments/RecruitmentTable";
import AdminApplicationTable from "main/components/Applications/AdminApplicationTable";
import DraftConflictWarning from "main/components/Applications/DraftConflictWarning";
import ApplicationsPageHeader from "main/components/Applications/ApplicationsPageHeader";
import type { Application } from "main/components/Applications/ApplicationTable";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import {
  hiddenAmongText,
  hiddenChangedText,
  hiddenText,
  receivedText,
} from "main/utils/adminApplications";
import type { RecruitmentCourse } from "main/components/Recruitments/RecruitmentCourseTable";
import FakeApplicationsControls from "main/components/Applications/FakeApplicationsControls";
import { useDeveloperModeFooterControls } from "main/utils/developerModeFooter";

/**
 * An admin's overview of one recruitment's applications: /admin/recruitments/:recruitmentId/applications.
 * The recruitment's own change history, once a card at the bottom of this page, has its own page
 * since issue #390 (RecruitmentHistoryPage, from the card's Change History button).
 *
 * Issue #440: each application has a Hide button, for an applicant who should no longer be
 * considered (one now known to be a GSR, say). Hidden applications are listed apart at the bottom
 * of the page, each with an Unhide button that puts it back; the backend leaves them out of the
 * faculty rankings and the course assignments.
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
  const shownList = applicationList.filter((a) => !a.hidden);
  const hiddenList = applicationList.filter((a) => a.hidden);

  // Issue #440: hiding and unhiding re-read the list, which moves the row to the other table.
  const hiddenMutation = useBackendMutation<
    { id: number; hidden: boolean },
    Application
  >(
    ({ id, hidden }) => ({
      url: "/api/admin/applications/hidden",
      method: "PUT",
      params: { id, hidden },
    }),
    { onSuccess: (saved) => toast(hiddenChangedText(saved)) },
    ["/api/admin/applications/all"],
  );

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

  // TA until the recruitment arrives; the two tables and the Columns menu all go by it.
  const type = recruitment?.type ?? "TA";
  const columnChoices = applicationColumnChoices(type);
  // Issue #189: which columns the admin has hidden, kept on the backend; see the shared code.
  const { hiddenColumns, toggleColumn } = useHiddenApplicationColumns(
    recruitmentId,
    recruitment?.type,
  );

  return (
    <BasicLayout>
      <div className="pt-2">
        {/* Issue #417: students with both a draft and an application, which should never happen */}
        <DraftConflictWarning
          recruitmentId={recruitmentId}
          testIdPrefix="RecruitmentApplicationsPage-draft-conflicts"
        />
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
        {hiddenList.length > 0 && (
          <p
            className="small text-muted"
            data-testid="RecruitmentApplicationsPage-hidden-among"
          >
            {hiddenAmongText(hiddenList.length)}; see{" "}
            <a href="#hidden-applications">
              the hidden applications at the bottom of this page
            </a>
            .
          </p>
        )}

        <div className="mb-2">
          <ColumnVisibilityControl
            choices={columnChoices}
            hidden={hiddenColumns}
            onToggle={toggleColumn}
            testIdPrefix="RecruitmentApplicationsPage-columns"
          />
        </div>
        <AdminApplicationTable
          applications={shownList}
          type={type}
          hiddenColumns={hiddenColumns}
          hideLinks={{
            choices: columnChoices,
            onHide: (columnId) => toggleColumn(columnId, true),
          }}
          hiding={{
            label: "Hide",
            onClick: ({ id }) => hiddenMutation.mutate({ id, hidden: true }),
          }}
          testIdPrefix="RecruitmentApplicationsPage-applications"
        />

        <section
          aria-label="Hidden applications"
          id="hidden-applications"
          className="mt-4"
          data-testid="RecruitmentApplicationsPage-hidden"
        >
          <h2
            className="h4"
            data-testid="RecruitmentApplicationsPage-hidden-count"
          >
            {hiddenText(hiddenList.length)}
          </h2>
          <p
            className="small text-muted"
            data-testid="RecruitmentApplicationsPage-hidden-why"
          >
            An application you hide, for instance one from an applicant who is
            now a GSR, moves to this list. Hidden applications are not shown to
            faculty for ranking and are left out of the Course Assignments.
            Unhide moves an application back to the list above.
          </p>
          {hiddenList.length === 0 ? (
            <p data-testid="RecruitmentApplicationsPage-hidden-empty">
              No application is hidden.
            </p>
          ) : (
            <AdminApplicationTable
              applications={hiddenList}
              type={type}
              hiddenColumns={hiddenColumns}
              hiding={{
                label: "Unhide",
                onClick: ({ id }) =>
                  hiddenMutation.mutate({ id, hidden: false }),
              }}
              testIdPrefix="RecruitmentApplicationsPage-hidden-applications"
            />
          )}
        </section>
      </div>
    </BasicLayout>
  );
}
