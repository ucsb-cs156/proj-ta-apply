import { useNavigate, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import AssignmentsTable from "main/components/Assignments/AssignmentsTable";
import CancelledApplicationsTable, {
  type CancelledApplication,
} from "main/components/Applications/CancelledApplicationsTable";
import InterestLegend from "main/components/Common/InterestLegend";
import type { Assignments } from "main/utils/assignments";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import { apiErrorMessage, shouldToastBackendError } from "main/utils/apiError";
import { isConflict } from "main/utils/useDraftSaving";
import {
  MultipleTabsBanner,
  MultipleTabsModal,
  useClientActivity,
} from "main/concurrency";

// Stryker disable all : the page before the first answer; nothing reads its fields
const emptyAssignments: Assignments = {
  recruitmentId: 0,
  type: "TA",
  identityHeaders: [],
  courses: [],
  rows: [],
  version: 0,
};
// Stryker restore all

/**
 * The admin Assignments page (issue #179): /admin/recruitments/:recruitmentId/assignments. Faculty
 * rankings side by side with the admin's tentative assignment of each applicant to a lecture.
 */
export default function AdminAssignmentsPage(): React.JSX.Element {
  const { recruitmentId } = useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Issues #280 and #284: the whole page for one recruitment is one thing to edit, so a second tab
  // or window on it (or a second admin) gets the warning, and the newest of them is asked what to do.
  const activity = useClientActivity({
    heartbeatUrl: `/api/admin/assignments/heartbeat?recruitmentId=${recruitmentId}`,
    leaveUrl: `/api/admin/assignments/leave?recruitmentId=${recruitmentId}`,
  });

  const { data: recruitments } = useBackend<Recruitment[]>(
    // Stryker disable next-line all : the query key is only a cache name
    ["/api/admin/recruitments/all"],
    { url: "/api/admin/recruitments/all" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );
  // Stryker disable next-line all : useBackend always hands back the initial data
  const recruitment = (recruitments ?? []).find(
    (r) => String(r.id) === recruitmentId,
  );

  // Stryker disable next-line all : the query key is only a cache name, read and written here alone
  const queryKey = ["/api/admin/assignments", recruitmentId];
  const { data: assignments } = useBackend<Assignments>(
    queryKey,
    { url: "/api/admin/assignments", params: { recruitmentId } },
    emptyAssignments,
  );
  const page = assignments ?? emptyAssignments;

  // Issue #199: who withdrew, so an admin missing an applicant can see why.
  const { data: cancelled } = useBackend<CancelledApplication[]>(
    // Stryker disable next-line all : the query key is only a cache name
    ["/api/admin/assignments/cancelled", recruitmentId],
    { url: "/api/admin/assignments/cancelled", params: { recruitmentId } },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );

  // The response is the whole page with the new counts, so it goes straight into the cache and
  // nothing has to be re-read.
  const assignMutation = useBackendMutation<
    { applicationId: number; recruitmentCourseId: number | null },
    Assignments
  >(
    ({ applicationId, recruitmentCourseId }) => ({
      url: "/api/admin/assignments/tentative",
      method: "PUT",
      // The version this page last saw: the server refuses the move if it has changed since.
      params:
        recruitmentCourseId === null
          ? { applicationId, version: page.version }
          : { applicationId, recruitmentCourseId, version: page.version },
      headers: activity.headers,
    }),
    {
      onSuccess: (updated) => queryClient.setQueryData(queryKey, updated),
      onError: (error) => {
        if (isConflict(error)) {
          const refreshed = (
            error as {
              response: { data: { assignments?: Assignments } | null };
            }
          ).response.data?.assignments;
          if (refreshed) {
            // The click is not replayed: after the refresh it may no longer be the right move.
            queryClient.setQueryData(queryKey, refreshed);
            toast(apiErrorMessage(error));
            return;
          }
        }
        if (shouldToastBackendError(error)) {
          toast(`${error}`);
        } else {
          console.error("Backend request failed", error);
        }
      },
    },
  );

  const positions = `${page.type}s`;
  return (
    <BasicLayout>
      <div className="pt-2">
        <h1>
          Assignments
          {recruitment &&
            `: ${recruitment.type} positions, ${yyyyqToQyy(recruitment.quarter)}`}
        </h1>
        <MultipleTabsBanner
          others={activity.others}
          noun="assignments page"
          testId="AdminAssignmentsPage-multiple-tabs"
        />
        {/* Only the newest tab is asked; the older ones keep the banner alone. */}
        <MultipleTabsModal
          others={activity.others}
          newest={activity.newest}
          arrivedAt={activity.arrivedAt}
          noun="assignments page"
          onLeave={() => {
            activity.leave();
            navigate("/");
          }}
          testId="AdminAssignmentsPage-multiple-tabs-modal"
        />
        <p data-testid="AdminAssignmentsPage-intro">
          Every real applicant with each lecture&apos;s ranking of them. Choose
          a lecture under <strong>Tentative Assignment</strong> to pencil an
          applicant in; the counts under each lecture update at once. Tentative
          assignments are not shown to applicants or faculty at this stage.
        </p>
        <p data-testid="AdminAssignmentsPage-count">
          {page.rows.length} applicant{page.rows.length === 1 ? "" : "s"},{" "}
          {page.courses.length} lecture{page.courses.length === 1 ? "" : "s"},{" "}
          {page.courses.reduce((sum, course) => sum + course.allocation, 0)}{" "}
          {positions} allocated,{" "}
          {page.courses.reduce((sum, course) => sum + course.assigned, 0)}{" "}
          assigned so far.
        </p>
        <InterestLegend testIdPrefix="AdminAssignmentsPage-legend" />
        <AssignmentsTable
          data={page}
          onAssign={(applicationId, recruitmentCourseId) =>
            assignMutation.mutate({ applicationId, recruitmentCourseId })
          }
          testIdPrefix="AdminAssignmentsPage-table"
        />
        <CancelledApplicationsTable
          // Stryker disable next-line all : useBackend always hands back the initial data
          cancelled={cancelled ?? []}
          audience="admin"
          testIdPrefix="AdminAssignmentsPage-cancelled"
        />
      </div>
    </BasicLayout>
  );
}
