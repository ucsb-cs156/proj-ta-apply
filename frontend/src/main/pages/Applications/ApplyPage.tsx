import { useNavigate, useParams } from "react-router";
import { toast } from "react-toastify";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import ApplicationForm from "main/components/Applications/ApplicationForm";
import {
  EMPTY_OPTIONS,
  type ApplicationOptions,
  type ApplicationPayload,
} from "main/utils/applicationFields";
import type { Application } from "main/components/Applications/ApplicationTable";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import { useCurrentUser } from "main/utils/currentUser";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import type { NoticeVersion } from "main/utils/notices";

/** Creating an application against one open recruitment: /apply/:recruitmentId */
export default function ApplyPage(): React.JSX.Element {
  const { recruitmentId } = useParams();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();

  const { data: applicable } = useBackend<Recruitment[]>(
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

  const recruitment = (applicable ?? []).find(
    (r) => String(r.id) === String(recruitmentId),
  );

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
        toast("Your application has been submitted.");
        navigate("/");
      },
    },
    ["/api/applications/mine"],
  );

  return (
    <BasicLayout>
      <div className="pt-2">
        <h1>
          Apply
          {recruitment &&
            `: ${recruitment.type} positions, ${yyyyqToQyy(recruitment.quarter)}`}
        </h1>
        {recruitment ? (
          <ApplicationForm
            type={recruitment.type}
            courses={courses ?? []}
            recruitmentId={recruitmentId}
            majors={options?.majors ?? []}
            topics={options?.topics ?? []}
            interests={options?.interests ?? []}
            notice={(notices ?? [])[0] ?? null}
            initialContents={(prefill ?? [])[0]}
            defaultNames={{
              firstName: currentUser.root?.user?.givenName,
              lastName: currentUser.root?.user?.familyName,
            }}
            submitAction={(payload) => mutation.mutate(payload)}
            buttonLabel="Submit Application"
            testIdPrefix="ApplyPage"
          />
        ) : (
          <p data-testid="ApplyPage-unavailable">
            That recruitment is not one you can apply to.
          </p>
        )}
      </div>
    </BasicLayout>
  );
}
