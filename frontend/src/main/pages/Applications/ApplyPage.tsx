import { useState } from "react";
import { Alert, Button } from "react-bootstrap";
import type { CourseInstructors } from "main/utils/courseLabels";
import { Navigate, useNavigate, useParams } from "react-router";
import { toast } from "react-toastify";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import ApplicationForm from "main/components/Applications/ApplicationForm";
import {
  EMPTY_OPTIONS,
  type ApplicationOptions,
  type ApplicationPayload,
} from "main/utils/applicationFields";
import type { Application } from "main/components/Applications/ApplicationTable";
import type { StudentRecruitment } from "main/components/Recruitments/RecruitmentTable";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import { useRefreshingBackend } from "main/utils/useRefreshingBackend";
import { useNoticeFillIn } from "main/utils/useNoticeFillIn";
import { useCurrentUser } from "main/utils/currentUser";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import type { NoticeVersion } from "main/utils/notices";
import {
  APPLICATIONS_CLOSED_MESSAGE,
  draftWasSaved,
} from "main/utils/draftApplications";
import { useDraftSaving } from "main/utils/useDraftSaving";
import { MultipleTabsBanner, MultipleTabsModal } from "main/concurrency";

/**
 * Creating an application against one open recruitment: /apply/:recruitmentId.
 *
 * Nothing the applicant types is lost (issue #270). Opening the form starts a draft for the
 * recruitment, or resumes the one already there, and what is entered is saved to it every few
 * seconds and again when the page is left. Save Draft saves at once and returns to the home page;
 * Submit turns the draft into the application and the server removes it.
 */
export default function ApplyPage(): React.JSX.Element {
  const { recruitmentId } = useParams();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();

  const { data: applicable } = useRefreshingBackend<StudentRecruitment[]>(
    ["/api/recruitments/applicable"],
    { method: "GET", url: "/api/recruitments/applicable" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );

  const { data: courses } = useBackend<string[]>(
    ["/api/recruitments/courses", recruitmentId],
    {
      method: "GET",
      url: "/api/recruitments/courses",
      params: { recruitmentId },
    },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );

  // Who teaches each course, for the names after the course numbers (issue #121).
  const { data: instructors } = useBackend<CourseInstructors>(
    ["/api/recruitments/instructors", recruitmentId],
    {
      method: "GET",
      url: "/api/recruitments/instructors",
      params: { recruitmentId },
    },
    // Stryker disable next-line all : don't test default value of empty map
    {},
  );

  // The majors and topics lists for this recruitment's kind of application.
  const { data: options } = useBackend<ApplicationOptions>(
    ["/api/recruitments/options", recruitmentId],
    {
      method: "GET",
      url: "/api/recruitments/options",
      params: { recruitmentId },
    },
    // Stryker disable next-line all : don't test default value of empty lists
    EMPTY_OPTIONS,
  );

  // The applicant's most recent application, so they need not retype everything. Empty the
  // first time; never carries over status or the recruitment it belonged to.
  const { data: prefill } = useBackend<Application[]>(
    ["/api/applications/prefill"],
    { method: "GET", url: "/api/applications/prefill" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );

  // The applicant's existing applications. Reaching this page for a recruitment they have already
  // applied to (the browser's back button after submitting, or an old link) must not offer a form
  // whose submission the backend would refuse (issue #102); it goes to the application instead.
  const { data: mine, isFetched: mineFetched } = useBackend<Application[]>(
    ["/api/applications/mine"],
    { method: "GET", url: "/api/applications/mine" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );

  const found = (applicable ?? []).find(
    (r) => String(r.id) === String(recruitmentId),
  );
  // Issue #281: the list refreshes by itself, and a recruitment can close, or leave the list, while
  // the form is open. The form stays on screen with what was typed (it is not replaced by an error
  // page); the last recruitment seen is kept for that, and the page says what happened.
  const [lastSeen, setLastSeen] = useState<StudentRecruitment | undefined>();
  if (found !== undefined && found !== lastSeen) setLastSeen(found);
  const recruitment = found ?? lastSeen;
  const closed =
    recruitment !== undefined &&
    (found === undefined || recruitment.applicationStatus !== "OPEN");
  const noticeFillIn = useNoticeFillIn(recruitment);
  const existing = (mine ?? []).find(
    (a) => String(a.recruitmentId) === String(recruitmentId),
  );

  // The draft for this recruitment, and the saving into it (issue #270).
  const {
    draft,
    failed: draftFailed,
    conflicted,
    others,
    newest,
    arrivedAt,
    leave,
    autosave,
    saveAndLeave,
    reload,
    stop,
  } = useDraftSaving({
    recruitmentId,
    // Stryker disable next-line all : the guard only avoids a request that would be refused
    enabled: Boolean(recruitment) && mineFetched && !existing,
    onSavedAndLeft: () => {
      toast(
        "Your draft has been saved. It is not an application until you submit it.",
      );
      navigate("/");
    },
  });

  // The current "Notices, Terms and Conditions" for this kind of form; empty until one is written.
  const { data: notices } = useBackend<NoticeVersion[]>(
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
    { enabled: Boolean(recruitment) },
  );

  const mutation = useBackendMutation<ApplicationPayload, Application>(
    (payload) => ({
      url: "/api/applications/post",
      method: "POST",
      params: { recruitmentId },
      data: payload,
    }),
    {
      onSuccess: () => {
        // The server has removed the draft; the form being left must not save to it once more.
        stop();
        toast("Your application has been submitted.");
        navigate("/");
      },
    },
    // Stryker disable next-line all : cache invalidation is not observable from here
    ["/api/applications/mine", "/api/draftApplications/mine"],
  );

  if (existing) {
    // replace, so that going back again does not land here a second time.
    return <Navigate to={`/applications/${existing.id}`} replace />;
  }

  return (
    <BasicLayout>
      <div className="pt-2">
        <h1>
          Apply
          {recruitment &&
            `: ${recruitment.type} positions, ${yyyyqToQyy(recruitment.quarter)}`}
        </h1>
        {/* The form waits for the list of existing applications, so it is never offered to someone
            whose submission would be refused, and for the draft it saves into. */}
        <MultipleTabsBanner
          others={others}
          noun="application"
          testId="ApplyPage-multiple-tabs"
        />
        {/* Only the newest tab is asked; the older ones keep the banner alone. */}
        <MultipleTabsModal
          others={others}
          newest={newest}
          arrivedAt={arrivedAt}
          noun="application"
          onLeave={() => {
            leave();
            navigate("/");
          }}
          testId="ApplyPage-multiple-tabs-modal"
        />
        {closed && (
          <Alert variant="warning" data-testid="ApplyPage-closed">
            {APPLICATIONS_CLOSED_MESSAGE}
          </Alert>
        )}
        {conflicted && (
          <Alert variant="danger" data-testid="ApplyPage-conflict">
            <span data-testid="ApplyPage-conflict-message">
              This draft was changed in another tab or window. Reload to see the
              latest version.
            </span>
            <Button
              className="ms-2"
              size="sm"
              variant="danger"
              onClick={() => reload()}
              data-testid="ApplyPage-conflict-reload"
            >
              Reload
            </Button>
          </Alert>
        )}
        {
          // Stryker disable next-line all : the draft is only asked for once the recruitment and the list are there
          recruitment && mineFetched && draft && (
            <ApplicationForm
              // A reloaded draft is a new start: the form takes its answers afresh.
              key={draft.version}
              type={recruitment.type}
              courses={courses ?? []}
              instructors={instructors ?? {}}
              recruitmentId={recruitmentId}
              majors={options?.majors ?? []}
              topics={options?.topics ?? []}
              interests={options?.interests ?? []}
              notice={(notices ?? [])[0] ?? null}
              noticeFillIn={noticeFillIn}
              // A draft the form has saved before is what the applicant left; a new one has nothing
              // of its own, so the answers from their earlier application fill it in.
              // Stryker disable next-line all : don't test default value of empty list
              initialContents={
                draftWasSaved(draft) ? draft : (prefill ?? [])[0]
              }
              defaultNames={{
                firstName: currentUser.root?.user?.givenName,
                lastName: currentUser.root?.user?.familyName,
              }}
              submitAction={(payload) => mutation.mutate(payload)}
              // Draft saves are refused once applications close (#276), so none are tried.
              onDraftChange={closed ? undefined : autosave}
              submitDisabled={closed}
              onSaveDraft={saveAndLeave}
              buttonLabel="Submit Application"
              testIdPrefix="ApplyPage"
            />
          )
        }
        {!recruitment && (
          <p data-testid="ApplyPage-unavailable">
            That recruitment is not one you can apply to.
          </p>
        )}
        {/* A draft is only asked for once there is a recruitment, so a failure implies one. */}
        {draftFailed && (
          <p data-testid="ApplyPage-draft-failed">
            The application could not be started. Applications may not be open
            for this recruitment.
          </p>
        )}
      </div>
    </BasicLayout>
  );
}
