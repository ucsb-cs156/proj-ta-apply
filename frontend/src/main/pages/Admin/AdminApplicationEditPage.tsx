import type { CourseInstructors } from "main/utils/courseLabels";
import { useNavigate, useParams } from "react-router";
import { Alert, Button } from "react-bootstrap";
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
import {
  adminApplicationPath,
  originLabel,
} from "main/utils/adminApplications";
import { isConflict } from "main/utils/useDraftSaving";
import {
  applicationHeartbeatUrl,
  applicationLeaveUrl,
  toastUnlessConflict,
} from "main/utils/applicationEditing";
import {
  MultipleTabsBanner,
  MultipleTabsModal,
  useClientActivity,
} from "main/concurrency";

/**
 * A student's application open for an admin to correct: /admin/applications/:id/edit. The same
 * form the applicant filled in, with their answers in it; saving goes through the admin endpoint,
 * which records every changed field in the audit trail, and leads back to the read-only view.
 */
export default function AdminApplicationEditPage(): React.JSX.Element {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: application, refetch } = useBackend<Application | null>(
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

  // Tells the server this tab has the application open and learns whether the applicant, or
  // another admin, has it open too (issue #302). The applicant's page uses the same endpoints.
  const activity = useClientActivity({
    heartbeatUrl: application ? applicationHeartbeatUrl(id) : null,
    leaveUrl: application ? applicationLeaveUrl(id) : null,
  });

  const saveMutation = useBackendMutation<ApplicationPayload, Application>(
    (payload) => ({
      url: "/api/admin/applications",
      method: "PUT",
      // Stryker disable next-line OptionalChaining : a save can only be made once the application is there
      params: { id, version: application?.version },
      headers: activity.headers,
      data: payload,
    }),
    {
      onSuccess: () => {
        toast("Application saved; the changes are in the audit trail.");
        navigate(viewPath);
      },
      // A save made from an old copy is shown on the page, not toasted (issue #302).
      onError: toastUnlessConflict,
    },
    ["/api/admin/applications", "/api/admin/audittrail/application"],
  );
  const conflicted = isConflict(saveMutation.error);

  return (
    <BasicLayout>
      <div className="pt-2">
        <h1>
          Edit Application {id}
          {recruitment &&
            `: ${recruitment.type} positions, ${yyyyqToQyy(recruitment.quarter)}`}
        </h1>

        <MultipleTabsBanner
          others={activity.others}
          newest={activity.newest}
          noun="application"
          audience="applicationAdmin"
          testId="AdminApplicationEditPage-multiple-tabs"
        />
        {/* Only the newest tab is asked; the older ones keep the banner alone. */}
        <MultipleTabsModal
          others={activity.others}
          newest={activity.newest}
          arrivedAt={activity.arrivedAt}
          noun="application"
          audience="applicationAdmin"
          onLeave={() => {
            // Stryker disable next-line all : leaving unmounts the page, whose cleanup says the same goodbye; this only says it a moment sooner
            activity.leave();
            navigate(viewPath);
          }}
          testId="AdminApplicationEditPage-multiple-tabs-modal"
        />
        {conflicted && (
          <Alert
            variant="danger"
            data-testid="AdminApplicationEditPage-conflict"
          >
            <span data-testid="AdminApplicationEditPage-conflict-message">
              This application was changed in another tab or window, or by the
              applicant. Reload to see the latest version.
            </span>
            <Button
              className="ms-2"
              size="sm"
              variant="danger"
              onClick={() => {
                saveMutation.reset();
                void refetch();
              }}
              data-testid="AdminApplicationEditPage-conflict-reload"
            >
              Reload
            </Button>
          </Alert>
        )}

        {application && (
          <>
            <p data-testid="AdminApplicationEditPage-about">
              {originLabel(application.origin) || "Application"} from{" "}
              {application.email}. Every field you change is recorded in the
              audit trail.
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
              // A reloaded application is a new start: the form takes its answers afresh.
              key={application.version}
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
