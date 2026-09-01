import { useNavigate, useParams } from "react-router";
import { toast } from "react-toastify";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import ApplicationForm from "main/components/Applications/ApplicationForm";
import type { ApplicationPayload } from "main/utils/applicationFields";
import type { Application } from "main/components/Applications/ApplicationTable";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import { yyyyqToQyy } from "main/utils/quarterUtilities";

/** Creating an application against one open recruitment: /apply/:recruitmentId */
export default function ApplyPage(): React.JSX.Element {
  const { recruitmentId } = useParams();
  const navigate = useNavigate();

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
            initialContents={(prefill ?? [])[0]}
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
