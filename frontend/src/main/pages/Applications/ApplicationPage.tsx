import { useParams } from "react-router";
import { toast } from "react-toastify";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import ApplicationForm from "main/components/Applications/ApplicationForm";
import type { ApplicationPayload } from "main/utils/applicationFields";
import ApplicationSummary from "main/components/Applications/ApplicationSummary";
import PostApplicationCommentsForm, {
  type PostApplicationCommentsFields,
} from "main/components/Applications/PostApplicationCommentsForm";
import type { Application } from "main/components/Applications/ApplicationTable";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import { phaseOf } from "main/utils/applicationAccess";
import { yyyyqToQyy } from "main/utils/quarterUtilities";

/** One of the applicant's own applications: /applications/:id */
export default function ApplicationPage(): React.JSX.Element {
  const { id } = useParams();

  const { data: application } = useBackend<Application | null>(
    ["/api/applications", id],
    { method: "GET", url: "/api/applications", params: { id } },
    // Stryker disable next-line all : don't test default value of null
    null,
  );

  const { data: applicable } = useBackend<Recruitment[]>(
    ["/api/recruitments/applicable"],
    { method: "GET", url: "/api/recruitments/applicable" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );

  const recruitment = (applicable ?? []).find(
    (r) => r.id === application?.recruitmentId,
  );

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

  const updateMutation = useBackendMutation<ApplicationPayload, Application>(
    (payload) => ({
      url: "/api/applications",
      method: "PUT",
      params: { id },
      data: payload,
    }),
    { onSuccess: () => toast("Your application has been updated.") },
    ["/api/applications", "/api/applications/mine"],
  );

  const commentsMutation = useBackendMutation<
    PostApplicationCommentsFields,
    Application
  >(
    (data) => ({
      url: "/api/applications/comments",
      method: "PUT",
      params: {
        id,
        postApplicationComments: data.postApplicationComments,
      },
    }),
    { onSuccess: () => toast("Your comments have been saved.") },
    ["/api/applications", "/api/applications/mine"],
  );

  const phase = phaseOf(recruitment);

  return (
    <BasicLayout>
      <div className="pt-2">
        <h1>
          Your Application
          {recruitment &&
            `: ${recruitment.type} positions, ${yyyyqToQyy(recruitment.quarter)}`}
        </h1>

        {application && (
          <>
            <p data-testid="ApplicationPage-status">
              Status: {application.status}
            </p>

            {phase === "EDITABLE" && (
              <ApplicationForm
                type={recruitment?.type ?? "TA"}
                courses={courses ?? []}
                initialContents={application}
                submitAction={(payload) => updateMutation.mutate(payload)}
                buttonLabel="Update Application"
                testIdPrefix="ApplicationPage"
              />
            )}

            {phase === "COMMENTS_ONLY" && (
              <>
                <p data-testid="ApplicationPage-comments-only">
                  The primary consideration date has passed, so this application
                  can no longer be edited. You can still add comments below.
                </p>
                <PostApplicationCommentsForm
                  initialContents={application.postApplicationComments}
                  submitAction={(data) => commentsMutation.mutate(data)}
                  testIdPrefix="ApplicationPage"
                />
                <ApplicationSummary
                  application={application}
                  type={recruitment?.type ?? "TA"}
                  testIdPrefix="ApplicationPage-summary"
                />
              </>
            )}

            {phase === "VIEW_ONLY" && (
              <>
                <p data-testid="ApplicationPage-view-only">
                  This recruitment is closed, so your application can no longer
                  be changed.
                </p>
                {application.postApplicationComments && (
                  <p data-testid="ApplicationPage-saved-comments">
                    Post application comments:{" "}
                    {application.postApplicationComments}
                  </p>
                )}
                <ApplicationSummary
                  application={application}
                  type={recruitment?.type ?? "TA"}
                  testIdPrefix="ApplicationPage-summary"
                />
              </>
            )}
          </>
        )}
      </div>
    </BasicLayout>
  );
}
