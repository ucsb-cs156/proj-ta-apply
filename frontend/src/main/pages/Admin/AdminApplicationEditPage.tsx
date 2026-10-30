import type { CourseInstructors } from "main/utils/courseLabels";
import { useNavigate, useParams } from "react-router";
import { Button } from "react-bootstrap";
import { toast } from "react-toastify";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import { useNoticeFillIn } from "main/utils/useNoticeFillIn";
import ApplicationForm from "main/components/Applications/ApplicationForm";
import type { Application } from "main/components/Applications/ApplicationTable";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import type { NoticeVersion } from "main/utils/notices";
import {
  EMPTY_OPTIONS,
  type ApplicationOptions,
  type ApplicationPayload,
} from "main/utils/applicationFields";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import { adminApplicationPath } from "main/utils/adminApplications";

/**
 * A student's application open for an admin to correct: /admin/applications/:id/edit. The same
 * form the applicant filled in, with their answers in it; saving goes through the admin endpoint,
 * which records every changed field in the audit trail, and leads back to the read-only view.
 */
export default function AdminApplicationEditPage(): React.JSX.Element {
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

  const { data: courses } = useBackend<string[]>(
    ["/api/recruitments/courses", application?.recruitmentId],
    {
      method: "GET",
      url: "/api/recruitments/courses",
      params: { recruitmentId: application?.recruitmentId },
    },
    // Stryker disable next-line all : don't test default value of empty list
    [],
    false,
    // Stryker disable next-line all : the guard only avoids a pointless request
    { enabled: Boolean(application) },
  );

  // Who teaches each course, for the names after the course numbers (issue #121).
  const { data: instructors } = useBackend<CourseInstructors>(
    ["/api/recruitments/instructors", application?.recruitmentId],
    {
      method: "GET",
      url: "/api/recruitments/instructors",
      params: { recruitmentId: application?.recruitmentId },
    },
    // Stryker disable next-line all : don't test default value of empty map
    {},
    false,
    // Stryker disable next-line all : the guard only avoids a pointless request
    { enabled: Boolean(application) },
  );

  const { data: options } = useBackend<ApplicationOptions>(
    ["/api/recruitments/options", application?.recruitmentId],
    {
      method: "GET",
      url: "/api/recruitments/options",
      params: { recruitmentId: application?.recruitmentId },
    },
    // Stryker disable next-line all : don't test default value of empty lists
    EMPTY_OPTIONS,
    false,
    // Stryker disable next-line all : the guard only avoids a pointless request
    { enabled: Boolean(application) },
  );

  // The notice version the applicant agreed to, shown ticked; an admin is not asked to agree to
  // anything, so an application without one is given no notice at all.
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

  const viewPath = adminApplicationPath(id ?? "");

  const saveMutation = useBackendMutation<ApplicationPayload, Application>(
    (payload) => ({
      url: "/api/admin/applications",
      method: "PUT",
      params: { id },
      data: payload,
    }),
    {
      onSuccess: () => {
        toast("Application saved; the changes are in the audit trail.");
        navigate(viewPath);
      },
    },
    ["/api/admin/applications", "/api/admin/audittrail/application"],
  );

  return (
    <BasicLayout>
      <div className="pt-2">
        <h1>
          Edit Application {id}
          {recruitment &&
            `: ${recruitment.type} positions, ${yyyyqToQyy(recruitment.quarter)}`}
        </h1>

        {application && (
          <>
            <p data-testid="AdminApplicationEditPage-about">
              {application.testApplication ? "Test application" : "Application"}{" "}
              from {application.email}. Every field you change is recorded in
              the audit trail.
            </p>
            <Button
              variant="secondary"
              className="mb-3"
              onClick={() => navigate(viewPath)}
              data-testid="AdminApplicationEditPage-cancel"
            >
              Cancel
            </Button>
            <ApplicationForm
              type={recruitment?.type ?? "TA"}
              courses={courses ?? []}
              instructors={instructors ?? {}}
              recruitmentId={application.recruitmentId}
              majors={options?.majors ?? []}
              topics={options?.topics ?? []}
              interests={options?.interests ?? []}
              notice={notice}
              noticeFillIn={noticeFillIn}
              initialContents={application}
              submitAction={(payload) => saveMutation.mutate(payload)}
              buttonLabel="Save Changes"
              testIdPrefix="AdminApplicationEditPage"
            />
          </>
        )}
      </div>
    </BasicLayout>
  );
}
