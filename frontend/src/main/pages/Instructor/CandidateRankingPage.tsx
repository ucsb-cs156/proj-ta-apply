import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { apiErrorMessage } from "main/utils/apiError";
import { useBackend } from "main/utils/useBackend";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import { Link, useParams } from "react-router";
import CandidateTable, {
  type Candidate,
} from "main/components/Instructor/CandidateTable";
import { useCurrentUser, hasRole } from "main/utils/currentUser";
import { rankingAllocationNotice } from "main/utils/allocations";

type CourseDetails = {
  id: number;
  courseId: string;
  section: string | null;
  title: string | null;
  instructor: string | null;
};

export type CandidateRankingPageData = {
  recruitmentId: number;
  quarter: string;
  type: "TA" | "ULA";
  tentativeOpeningDate: string | null;
  primaryConsiderationDate: string | null;
  actualOpeningDate: string | null;
  actualClosingDate: string | null;
  reviewStatus: "Open" | "Closed";
  facultyReviewOpeningDate: string | null;
  facultyRankingDeadline: string | null;
  course: CourseDetails;
  otherCourses: CourseDetails[];
  /**
   * How many TAs or ULAs the course was allocated (issue #178): null or absent while the admin
   * hides allocations from faculty; admins always get it.
   */
  allocation?: number | null;
};

/** The course-scoped instructor ranking workspace. */
export default function CandidateRankingPage(): React.JSX.Element {
  const { recruitmentId, recruitmentCourseId } = useParams();
  const validIds =
    recruitmentId !== undefined &&
    recruitmentCourseId !== undefined &&
    /^\d+$/.test(recruitmentId) &&
    /^\d+$/.test(recruitmentCourseId);
  const url = `/api/instructor/recruitments/${recruitmentId}/courses/${recruitmentCourseId}/ranking`;
  const candidatesUrl = `/api/instructor/recruitments/${recruitmentId}/courses/${recruitmentCourseId}/candidates`;
  const currentUser = useCurrentUser();
  const candidates = useBackend<Candidate[] | null>(
    [candidatesUrl],
    { method: "GET", url: candidatesUrl },
    null,
    true,
    { enabled: validIds },
  );
  const { data, isFetching, isError, error } =
    useBackend<CandidateRankingPageData | null>(
      [url],
      { method: "GET", url },
      null,
      true,
      { enabled: validIds },
    );

  return (
    <BasicLayout>
      <div className="pt-2" data-testid="CandidateRankingPage">
        <h1>Candidate Ranking</h1>
        {!validIds ? (
          <p role="alert">This candidate-ranking link is invalid.</p>
        ) : isFetching && data == null ? (
          <p role="status">Loading candidate ranking...</p>
        ) : isError ? (
          <p role="alert">
            Unable to load candidate ranking: {apiErrorMessage(error)}
          </p>
        ) : data == null ? (
          <p role="alert">No candidate-ranking details were returned.</p>
        ) : (
          <>
            {data.allocation != null && (
              <p
                className="lead"
                role="note"
                data-testid="CandidateRankingPage-allocation"
              >
                {rankingAllocationNotice(data.type, data.allocation)}
              </p>
            )}
            <section aria-label="Recruitment details">
              <h2>Recruitment</h2>
              <dl className="row">
                <dt className="col-sm-3">Quarter</dt>
                <dd
                  className="col-sm-9"
                  data-testid="CandidateRankingPage-quarter"
                >
                  {yyyyqToQyy(data.quarter)}
                </dd>
                <dt className="col-sm-3">Type</dt>
                <dd
                  className="col-sm-9"
                  data-testid="CandidateRankingPage-type"
                >
                  {data.type}
                </dd>
                <dt className="col-sm-3">Tentative Opening</dt>
                <dd className="col-sm-9">
                  {data.tentativeOpeningDate ?? "Not set"}
                </dd>
                <dt className="col-sm-3">Primary Consideration</dt>
                <dd className="col-sm-9">
                  {data.primaryConsiderationDate ?? "Not set"}
                </dd>
                <dt className="col-sm-3">Actually Opened</dt>
                <dd className="col-sm-9">
                  {data.actualOpeningDate ?? "Not opened"}
                </dd>
                <dt className="col-sm-3">Actually Closed</dt>
                <dd className="col-sm-9">
                  {data.actualClosingDate ?? "Not closed"}
                </dd>
                <dt className="col-sm-3">Faculty Reviews Opened</dt>
                <dd
                  className="col-sm-9"
                  data-testid="CandidateRankingPage-opening-date"
                >
                  {data.facultyReviewOpeningDate ?? "Not recorded"}
                </dd>
                <dt className="col-sm-3">Faculty Ranking Deadline</dt>
                <dd
                  className="col-sm-9"
                  data-testid="CandidateRankingPage-deadline"
                >
                  {data.facultyRankingDeadline ?? "Not set"}
                </dd>
              </dl>
            </section>

            <section aria-label="Course details">
              <h2>Course</h2>
              <dl className="row">
                <dt className="col-sm-3">Course</dt>
                <dd
                  className="col-sm-9"
                  data-testid="CandidateRankingPage-course-id"
                >
                  <span style={{ whiteSpace: "pre", fontFamily: "monospace" }}>
                    {data.course.courseId}
                  </span>
                </dd>
                <dt className="col-sm-3">Section</dt>
                <dd
                  className="col-sm-9"
                  data-testid="CandidateRankingPage-section"
                >
                  {data.course.section ?? "Not specified"}
                </dd>
                <dt className="col-sm-3">Title</dt>
                <dd
                  className="col-sm-9"
                  data-testid="CandidateRankingPage-title"
                >
                  {data.course.title ?? "Not specified"}
                </dd>
                <dt className="col-sm-3">Instructor</dt>
                <dd
                  className="col-sm-9"
                  data-testid="CandidateRankingPage-instructor"
                >
                  {data.course.instructor ?? "Not specified"}
                </dd>
              </dl>
            </section>

            {data.otherCourses.length > 0 && (
              <section
                aria-label={`Your other ${yyyyqToQyy(data.quarter)} Courses`}
              >
                <h2>Your other {yyyyqToQyy(data.quarter)} Courses</h2>
                <ul>
                  {data.otherCourses.map((course) => (
                    <li key={course.id}>
                      <Link
                        to={`/recruitments/${data.recruitmentId}/courses/${course.id}/ranking`}
                      >
                        {course.courseId}
                        {course.section ? ` (${course.section})` : ""}
                        {course.title ? ` — ${course.title}` : ""}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {candidates.isError ? (
              <p role="alert">
                Unable to load candidates: {apiErrorMessage(candidates.error)}
              </p>
            ) : candidates.isFetching && candidates.data == null ? (
              <p role="status">Loading candidates...</p>
            ) : candidates.data == null ? (
              <p role="alert">No candidate data were returned.</p>
            ) : (
              <CandidateTable
                key={candidatesUrl}
                candidates={candidates.data}
                type={data.type}
                editable={
                  data.reviewStatus === "Open" &&
                  hasRole(currentUser, "ROLE_INSTRUCTOR") &&
                  !hasRole(currentUser, "ROLE_ADMIN")
                }
                apiUrl={candidatesUrl}
                applicationUrl={`/recruitments/${recruitmentId}/courses/${recruitmentCourseId}/applications`}
              />
            )}
          </>
        )}
      </div>
    </BasicLayout>
  );
}
