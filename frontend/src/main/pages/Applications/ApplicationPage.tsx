import type { CourseInstructors } from "main/utils/courseLabels";
import { useNavigate, useParams } from "react-router";
import { toast } from "react-toastify";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import ApplicationForm from "main/components/Applications/ApplicationForm";
import {
  EMPTY_OPTIONS,
  type ApplicationOptions,
  type ApplicationPayload,
} from "main/utils/applicationFields";
import ApplicationSummary from "main/components/Applications/ApplicationSummary";
import PostApplicationCommentsForm, {
  type PostApplicationCommentsFields,
} from "main/components/Applications/PostApplicationCommentsForm";
import type { Application } from "main/components/Applications/ApplicationTable";
import type { StudentRecruitment } from "main/components/Recruitments/RecruitmentTable";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import { useNoticeFillIn } from "main/utils/useNoticeFillIn";
import { useCurrentUser } from "main/utils/currentUser";
import { isEditable, phaseOf } from "main/utils/applicationAccess";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import type { NoticeVersion } from "main/utils/notices";

/** One of the applicant's own applications: /applications/:id */
export default function ApplicationPage(): React.JSX.Element {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();

  const { data: application } = useBackend<Application | null>(
    ["/api/applications", id],
    { method: "GET", url: "/api/applications", params: { id } },
    // Stryker disable next-line all : don't test default value of null
    null,
  );

  const { data: applicable } = useBackend<StudentRecruitment[]>(
    ["/api/recruitments/applicable"],
    { method: "GET", url: "/api/recruitments/applicable" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );

  const recruitment = (applicable ?? []).find(
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

  // The notice version this application records agreeing to, shown back exactly. An application
  // older than any notice has none; then, while it is still editable, the current one is asked.
  const agreedId = application?.noticeVersionId ?? null;
  const { data: agreedNotice } = useBackend<NoticeVersion | null>(
    ["/api/notices", agreedId],
    { method: "GET", url: "/api/notices", params: { id: agreedId } },
    // Stryker disable next-line all : don't test default value of null
    null,
    false,
    // Stryker disable next-line all : the guard only avoids a pointless request
    { enabled: agreedId !== null },
  );
  const { data: currentNotices } = useBackend<NoticeVersion[]>(
    ["/api/notices/current", recruitment?.type],
    {
      method: "GET",
      url: "/api/notices/current",
      params: { type: recruitment?.type },
    },
    // Stryker disable next-line all : don't test default value of empty list
    [],
    false,
    // Stryker disable next-line all : the guard only avoids a pointless request
    {
      enabled:
        Boolean(application) && agreedId === null && Boolean(recruitment),
    },
  );
  const notice =
    agreedId !== null
      ? (agreedNotice ?? null)
      : ((currentNotices ?? [])[0] ?? null);

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
    {
      // Back to the home page once saved, as after submitting the application (issue #101).
      onSuccess: () => {
        toast("Your comments have been saved.");
        navigate("/");
      },
    },
    ["/api/applications", "/api/applications/mine"],
  );

  // A cancelled application is final, whatever its recruitment is doing (issue #107).
  const phase =
    application?.status === "CANCELLED" ? "VIEW_ONLY" : phaseOf(recruitment);

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

            {isEditable(phase) && (
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
                defaultNames={{
                  firstName: currentUser.root?.user?.givenName,
                  lastName: currentUser.root?.user?.familyName,
                }}
                submitAction={(payload) => updateMutation.mutate(payload)}
                buttonLabel="Update Application"
                testIdPrefix="ApplicationPage"
              />
            )}

            {/* Past the primary consideration date the application stays editable until the
                admin closes applications (issue #98); the comments box is offered as well, as
                the place to say what has changed since applying. */}
            {phase === "LATE" && (
              <div className="mt-4" data-testid="ApplicationPage-late">
                <h2 className="h4">Post Application Comments</h2>
                <p data-testid="ApplicationPage-late-note">
                  The primary consideration date has passed. You can still
                  update your application above until applications close; if
                  something has changed since you applied, you can also say so
                  here.
                </p>
                <PostApplicationCommentsForm
                  initialContents={application.postApplicationComments}
                  submitAction={(data) => commentsMutation.mutate(data)}
                  testIdPrefix="ApplicationPage-comments"
                />
              </div>
            )}

            {/* Closed within the last six months: the comments stay live (issue #107). */}
            {phase === "COMMENTS_ONLY" && (
              <>
                <p data-testid="ApplicationPage-comments-only">
                  Applications are closed, so this application can no longer be
                  edited. You can still add comments below for six months after
                  the closing date.
                </p>
                <PostApplicationCommentsForm
                  initialContents={application.postApplicationComments}
                  submitAction={(data) => commentsMutation.mutate(data)}
                  testIdPrefix="ApplicationPage-comments"
                />
                <ApplicationSummary
                  application={application}
                  type={recruitment?.type ?? "TA"}
                  notice={agreedNotice}
                  noticeFillIn={noticeFillIn}
                  testIdPrefix="ApplicationPage-summary"
                />
              </>
            )}

            {phase === "VIEW_ONLY" && (
              <>
                <p data-testid="ApplicationPage-view-only">
                  {application.status === "CANCELLED"
                    ? "You cancelled this application, so it can no longer be changed."
                    : "This recruitment is closed, so your application can no longer be changed."}
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
                  notice={agreedNotice}
                  noticeFillIn={noticeFillIn}
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
