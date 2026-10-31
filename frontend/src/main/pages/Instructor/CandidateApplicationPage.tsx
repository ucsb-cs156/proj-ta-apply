import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import ApplicationSummary, {
  type ApplicationSummaryData,
} from "main/components/Applications/ApplicationSummary";
import type { CandidateRankingPageData } from "./CandidateRankingPage";
import { useBackend } from "main/utils/useBackend";
import { apiErrorMessage } from "main/utils/apiError";
import type { NoticeVersion } from "main/utils/notices";
import { useParams } from "react-router";
import { useNoticeFillIn } from "main/utils/useNoticeFillIn";
import { submittedText } from "main/utils/adminApplications";

export type CandidateApplicationData = Pick<
  ApplicationSummaryData,
  "id" | "recruitmentId" | "email" | "submittedAt"
> & {
  postApplicationComments: string | null;
  answers: Omit<
    ApplicationSummaryData,
    "id" | "recruitmentId" | "email" | "submittedAt"
  >;
};

export default function CandidateApplicationPage(): React.JSX.Element {
  const { recruitmentId, recruitmentCourseId, applicationId } = useParams();
  const validIds = [recruitmentId, recruitmentCourseId, applicationId].every(
    (id) => id !== undefined && /^\d+$/.test(id),
  );
  const base = `/api/instructor/recruitments/${recruitmentId}/courses/${recruitmentCourseId}`;
  const application = useBackend<CandidateApplicationData | null>(
    [base, applicationId],
    { method: "GET", url: `${base}/candidates/${applicationId}` },
    null,
    true,
    { enabled: validIds },
  );
  const metadata = useBackend<CandidateRankingPageData | null>(
    [`${base}/ranking`],
    { method: "GET", url: `${base}/ranking` },
    null,
    true,
    { enabled: validIds },
  );
  const noticeId = application.data?.answers.noticeVersionId;
  const noticeFillIn = useNoticeFillIn(metadata.data);
  const notice = useBackend<NoticeVersion | null>(
    ["/api/notices", noticeId],
    { method: "GET", url: "/api/notices", params: { id: noticeId } },
    null,
    true,
    { enabled: noticeId != null },
  );
  return (
    <BasicLayout>
      <h1>Candidate Application</h1>
      {!validIds ? (
        <p role="alert">This candidate-application link is invalid.</p>
      ) : application.isError || metadata.isError ? (
        <p role="alert">
          Unable to load candidate application:{" "}
          {apiErrorMessage(application.error ?? metadata.error)}
        </p>
      ) : (application.isFetching && application.data == null) ||
        (metadata.isFetching && metadata.data == null) ? (
        <p role="status">Loading candidate application...</p>
      ) : application.data == null || metadata.data == null ? (
        <p role="alert">No candidate-application details were returned.</p>
      ) : (
        <>
          <p>This application is read-only.</p>
          <p>Email: {application.data.email}</p>
          <p>Submitted: {submittedText(application.data.submittedAt)}</p>
          <section aria-label="Post-Application Comments">
            <h2>Post-Application Comments</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>
              {application.data.postApplicationComments ?? "None"}
            </p>
          </section>
          {notice.isError && (
            <p role="alert">
              Unable to load agreed terms: {apiErrorMessage(notice.error)}
            </p>
          )}
          {noticeId != null &&
            !notice.isError &&
            notice.data == null &&
            (notice.isFetching ? (
              <p role="status">Loading agreed terms...</p>
            ) : (
              <p role="alert">No agreed terms were returned.</p>
            ))}
          <ApplicationSummary
            application={{ ...application.data, ...application.data.answers }}
            type={metadata.data.type}
            notice={notice.data}
            noticeFillIn={noticeFillIn}
          />
        </>
      )}
    </BasicLayout>
  );
}
