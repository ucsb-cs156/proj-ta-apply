import { useParams } from "react-router";
import { toast } from "react-toastify";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import TestOnlyBanner from "main/components/Common/TestOnlyBanner";
import ApplicationForm from "main/components/Applications/ApplicationForm";
import ApplicationSummary from "main/components/Applications/ApplicationSummary";
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

/** Only the course number is needed here; the rest of a RecruitmentCourse is for the admin table. */
type RecruitmentCourseLike = { courseId: string };

/**
 * An admin's preview of the application form for one recruitment:
 * /admin/recruitments/:recruitmentId/test-application
 *
 * <p>The form is the same component applicants use, fed the same way, so what the admin sees is
 * what an applicant would see. Submitting saves a real row flagged testApplication=true; the
 * backend skips the type and open/closed checks, so a recruitment can be tried before it opens.
 */
export default function TestApplicationPage(): React.JSX.Element {
  const { recruitmentId } = useParams();
  const currentUser = useCurrentUser();

  const { data: recruitments } = useBackend<Recruitment[]>(
    ["/api/admin/recruitments/all"],
    { method: "GET", url: "/api/admin/recruitments/all" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );

  const { data: recruitmentCourses } = useBackend<RecruitmentCourseLike[]>(
    ["/api/recruitmentcourses/all", recruitmentId],
    {
      method: "GET",
      url: "/api/recruitmentcourses/all",
      params: { recruitmentId },
    },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );

  // The majors and topics lists, exactly as an applicant to this recruitment would get them.
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

  // The admin's own applications, to show back the test one saved for this recruitment.
  const { data: mine } = useBackend<Application[]>(
    ["/api/applications/mine"],
    { method: "GET", url: "/api/applications/mine" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );

  const recruitment = (recruitments ?? []).find(
    (r) => String(r.id) === String(recruitmentId),
  );

  // The current notice, exactly as an applicant to this recruitment would be shown it.
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

  // Applicants get a distinct, sorted list from /api/recruitments/courses; the admin endpoint
  // returns one row per lecture, so the same shaping happens here.
  const courses = [
    ...new Set((recruitmentCourses ?? []).map((c) => c.courseId)),
  ].sort();

  const saved = (mine ?? []).find(
    (a) =>
      String(a.recruitmentId) === String(recruitmentId) && a.testApplication,
  );

  const mutation = useBackendMutation<ApplicationPayload, Application>(
    (payload) => ({
      url: "/api/applications/test",
      method: "POST",
      params: { recruitmentId },
      data: payload,
    }),
    {
      onSuccess: () =>
        toast(
          "Test application saved. It is flagged as a test, not a real one.",
        ),
    },
    ["/api/applications/mine"],
  );

  return (
    <BasicLayout banner={<TestOnlyBanner />}>
      <div className="pt-2">
        <h1>
          Test Application
          {recruitment &&
            `: ${recruitment.type} positions, ${yyyyqToQyy(recruitment.quarter)}`}
        </h1>
        {recruitment ? (
          <>
            <p data-testid="TestApplicationPage-explanation">
              This is the form an applicant for this recruitment sees. Fill it
              in and submit it to try the whole path; the result is saved as a
              test application and never counts as a real one. Submitting again
              replaces your earlier test answers.
            </p>
            <ApplicationForm
              type={recruitment.type}
              courses={courses}
              majors={options?.majors ?? []}
              topics={options?.topics ?? []}
              notice={(notices ?? [])[0] ?? null}
              defaultNames={{
                firstName: currentUser.root?.user?.givenName,
                lastName: currentUser.root?.user?.familyName,
              }}
              submitAction={(payload) => mutation.mutate(payload)}
              buttonLabel="Submit Test Application"
              testIdPrefix="TestApplicationPage"
            />
            {saved && (
              <>
                <h2 className="h4 mt-4" data-testid="TestApplicationPage-saved">
                  Your saved test application
                </h2>
                <ApplicationSummary
                  application={saved}
                  type={recruitment.type}
                  testIdPrefix="TestApplicationPage-summary"
                />
              </>
            )}
          </>
        ) : (
          <p data-testid="TestApplicationPage-unavailable">
            There is no recruitment with id {recruitmentId}.
          </p>
        )}
      </div>
    </BasicLayout>
  );
}
