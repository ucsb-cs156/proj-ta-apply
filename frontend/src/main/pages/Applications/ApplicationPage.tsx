import type { CourseInstructors } from "main/utils/courseLabels";
import { Link, useNavigate, useParams } from "react-router";
import { Alert, Button } from "react-bootstrap";
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
import { isConflict } from "main/utils/useDraftSaving";
import { RESTART_LABEL } from "main/components/Student/StudentRecruitmentCards";
import { useCreateFromCancelled } from "main/utils/useCreateFromCancelled";
import { draftFor, type DraftApplication } from "main/utils/draftApplications";
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

/** One of the applicant's own applications: /applications/:id */
export default function ApplicationPage(): React.JSX.Element {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();

  const { data: application, refetch } = useBackend<Application | null>(
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

  // An applicant who cancelled this application may, while applications are open, turn it back
  // into a draft (issues #318, #420), unless they already have another application.
  const { data: mine, isFetched: mineFetched } = useBackend<Application[]>(
    ["/api/applications/mine"],
    { method: "GET", url: "/api/applications/mine" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );
  // Stryker disable next-line all : mine already defaults to an empty list
  const replacement = (mine ?? []).find(
    (a) =>
      a.recruitmentId === application?.recruitmentId &&
      a.status !== "CANCELLED",
  );
  // A draft already begun for the recruitment is offered instead: the server will not make a
  // second one from this application (issue #420).
  const { data: myDrafts, isFetched: draftsFetched } = useBackend<
    DraftApplication[]
  >(
    // Stryker disable next-line all : the cache key only shares the list with the home page
    ["/api/draftApplications/mine"],
    // Stryker disable next-line StringLiteral : axios reads a blank method as GET
    { method: "GET", url: "/api/draftApplications/mine" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );
  const draftHere =
    application &&
    // Stryker disable next-line all : myDrafts already defaults to an empty list
    draftFor(myDrafts ?? [], application.recruitmentId);
  const restartMutation = useCreateFromCancelled();
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

  // A cancelled application is final, whatever its recruitment is doing (issue #107).
  const phase =
    application?.status === "CANCELLED" ? "VIEW_ONLY" : phaseOf(recruitment);

  // While the form is on offer, tells the server this tab has the application open and learns
  // whether an admin (or another tab of the applicant's own) has it open too (issue #302).
  const editing = Boolean(application) && isEditable(phase);
  const activity = useClientActivity({
    heartbeatUrl: editing ? applicationHeartbeatUrl(id) : null,
    leaveUrl: editing ? applicationLeaveUrl(id) : null,
  });
  const updateMutation = useBackendMutation<ApplicationPayload, Application>(
    (payload) => ({
      url: "/api/applications",
      method: "PUT",
      // Stryker disable next-line OptionalChaining : a save can only be made once the application is there
      params: { id, version: application?.version },
      headers: activity.headers,
      data: payload,
    }),
    {
      onSuccess: () => toast("Your application has been updated."),
      // A save made from an old copy is shown on the page, not toasted (issue #302).
      onError: toastUnlessConflict,
    },
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

  const conflicted = isConflict(updateMutation.error);

  return (
    <BasicLayout>
      <div className="pt-2">
        <h1>
          Your Application
          {recruitment &&
            `: ${recruitment.type} positions, ${yyyyqToQyy(recruitment.quarter)}`}
        </h1>

        <MultipleTabsBanner
          others={activity.others}
          newest={activity.newest}
          noun="application"
          audience="applicant"
          testId="ApplicationPage-multiple-tabs"
        />
        {/* Only the newest tab is asked; the older ones keep the banner alone. */}
        <MultipleTabsModal
          others={activity.others}
          newest={activity.newest}
          arrivedAt={activity.arrivedAt}
          noun="application"
          audience="applicant"
          onLeave={() => {
            activity.leave();
            navigate("/");
          }}
          testId="ApplicationPage-multiple-tabs-modal"
        />
        {conflicted && (
          <Alert variant="danger" data-testid="ApplicationPage-conflict">
            <span data-testid="ApplicationPage-conflict-message">
              This application was changed in another tab or window, or by an
              admin. Reload to see the latest version.
            </span>
            <Button
              className="ms-2"
              size="sm"
              variant="danger"
              onClick={() => {
                updateMutation.reset();
                void refetch();
              }}
              data-testid="ApplicationPage-conflict-reload"
            >
              Reload
            </Button>
          </Alert>
        )}

        {application && (
          <>
            <p data-testid="ApplicationPage-status">
              Status: {application.status}
            </p>

            {isEditable(phase) && (
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
                {application.status === "CANCELLED" &&
                  mineFetched &&
                  (replacement ? (
                    <p data-testid="ApplicationPage-new-application">
                      <span className="me-2">
                        You have since started a new application.
                      </span>
                      <Link
                        to={`/applications/${replacement.id}`}
                        data-testid="ApplicationPage-new-application-link"
                      >
                        View your new application
                      </Link>
                    </p>
                  ) : (
                    recruitment?.applicationStatus === "OPEN" &&
                    draftsFetched &&
                    (draftHere ? (
                      <p data-testid="ApplicationPage-draft">
                        <Link
                          className="btn btn-success"
                          to={`/apply/${application.recruitmentId}`}
                          data-testid="ApplicationPage-continue-draft"
                        >
                          Continue editing draft application
                        </Link>
                        <span className="ms-2">
                          You have since begun a new application. It is a draft
                          until you submit it.
                        </span>
                      </p>
                    ) : (
                      <p>
                        <Button
                          variant="success"
                          disabled={restartMutation.isPending}
                          onClick={() => restartMutation.mutate(application.id)}
                          data-testid="ApplicationPage-restart"
                        >
                          {RESTART_LABEL}
                        </Button>
                        <span
                          className="ms-2"
                          data-testid="ApplicationPage-restart-note"
                        >
                          This turns the application back into a draft with your
                          answers, but not your reason for cancelling, and this
                          cancelled copy is removed. Review the draft, then
                          submit it.
                        </span>
                      </p>
                    ))
                  ))}
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
