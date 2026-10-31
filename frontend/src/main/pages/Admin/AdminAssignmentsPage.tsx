import { useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import AssignmentsTable from "main/components/Assignments/AssignmentsTable";
import type { Assignments } from "main/utils/assignments";
import { yyyyqToQyy } from "main/utils/quarterUtilities";

// Stryker disable all : the page before the first answer; nothing reads its fields
const emptyAssignments: Assignments = {
  recruitmentId: 0,
  type: "TA",
  identityHeaders: [],
  courses: [],
  rows: [],
};
// Stryker restore all

/**
 * The admin Assignments page (issue #179): /admin/recruitments/:recruitmentId/assignments. Faculty
 * rankings side by side with the admin's tentative assignment of each applicant to a lecture.
 */
export default function AdminAssignmentsPage(): React.JSX.Element {
  const { recruitmentId } = useParams();
  const queryClient = useQueryClient();

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

  // The response is the whole page with the new counts, so it goes straight into the cache and
  // nothing has to be re-read.
  const assignMutation = useBackendMutation<
    { applicationId: number; recruitmentCourseId: number | null },
    Assignments
  >(
    ({ applicationId, recruitmentCourseId }) => ({
      url: "/api/admin/assignments/tentative",
      method: "PUT",
      params:
        recruitmentCourseId === null
          ? { applicationId }
          : { applicationId, recruitmentCourseId },
    }),
    { onSuccess: (updated) => queryClient.setQueryData(queryKey, updated) },
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
        <AssignmentsTable
          data={page}
          onAssign={(applicationId, recruitmentCourseId) =>
            assignMutation.mutate({ applicationId, recruitmentCourseId })
          }
          testIdPrefix="AdminAssignmentsPage-table"
        />
      </div>
    </BasicLayout>
  );
}
