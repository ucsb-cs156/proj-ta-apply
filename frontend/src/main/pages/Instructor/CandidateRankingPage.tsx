import { useState } from "react";
import { Form } from "react-bootstrap";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import CancelledApplicationsTable, {
  type CancelledApplication,
} from "main/components/Applications/CancelledApplicationsTable";
import InterestLegend from "main/components/Common/InterestLegend";
import DetailsTable, {
  type DetailsColumn,
} from "main/components/Common/DetailsTable";
import {
  INCLUDE_NOT_INTERESTED_LABEL,
  NOT_INTERESTED_WARNING,
} from "main/utils/interestDisplay";
import { apiErrorMessage } from "main/utils/apiError";
import { useBackend } from "main/utils/useBackend";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import { Link, useParams } from "react-router";
import CandidateTable, {
  type Candidate,
} from "main/components/Instructor/CandidateTable";
import { rankingAllocationNotice } from "main/utils/allocations";
import { targetsColumns, type CourseTargets } from "main/utils/courseTargets";

type CourseDetails = {
  id: number;
  courseId: string;
  section: string | null;
  title: string | null;
  instructor: string | null;
};

/** One cell of the details tables (issue #205): the value, or the fallback when there is none. */
const detail = (
  label: string,
  value: string | null | undefined,
  fallback: string,
  testId: string,
): DetailsColumn => {
  const text = value ?? fallback;
  return { label, value: text, text, testId };
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
   * Whether this user may enter rankings (issue #202): the course's instructor of record while
   * reviews are Open, admin or not. Anyone else, including an admin who does not teach the
   * course, sees the rankings read-only.
   */
  canRank?: boolean;
  /**
   * How many TAs or ULAs the course was allocated (issue #178): null or absent while the admin
   * hides allocations from faculty; admins always get it.
   */
  allocation?: number | null;
  /**
   * The course's hiring figures (issue #224): present on the same terms as `allocation`; null or
   * absent while the admin withholds hiring targets from faculty.
   */
  targets?: CourseTargets | null;
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
  const cancelledUrl = `/api/instructor/recruitments/${recruitmentId}/courses/${recruitmentCourseId}/cancelled`;
  // Issue #199: candidates who marked the course Not Interested are listed only on request.
  const [includeNotInterested, setIncludeNotInterested] = useState(false);
  const candidates = useBackend<Candidate[] | null>(
    // Stryker disable next-line all : the query key is only a cache name
    [candidatesUrl, includeNotInterested],
    {
      // Stryker disable next-line all : GET is axios's default method
      method: "GET",
      url: candidatesUrl,
      params: { includeNotInterested },
    },
    null,
    true,
    { enabled: validIds },
  );
  const cancelled = useBackend<CancelledApplication[] | null>(
    // Stryker disable next-line all : the query key is only a cache name
    [cancelledUrl],
    // Stryker disable next-line all : GET is axios's default method
    { method: "GET", url: cancelledUrl },
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
            {data.targets != null && (
              <DetailsTable
                testIdPrefix="CandidateRankingPage-targets"
                columns={targetsColumns(data.targets, "CandidateRankingPage")}
              />
            )}
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
              <h2 className="h5 mt-3">Recruitment</h2>
              <DetailsTable
                testIdPrefix="CandidateRankingPage-recruitment"
                columns={[
                  {
                    label: "Quarter",
                    value: yyyyqToQyy(data.quarter),
                    text: yyyyqToQyy(data.quarter),
                    testId: "CandidateRankingPage-quarter",
                  },
                  {
                    label: "Type",
                    value: data.type,
                    text: data.type,
                    testId: "CandidateRankingPage-type",
                  },
                  detail(
                    "Tentative Opening",
                    data.tentativeOpeningDate,
                    "Not set",
                    "CandidateRankingPage-tentative-opening",
                  ),
                  detail(
                    "Primary Consideration",
                    data.primaryConsiderationDate,
                    "Not set",
                    "CandidateRankingPage-primary-consideration",
                  ),
                  detail(
                    "Actually Opened",
                    data.actualOpeningDate,
                    "Not opened",
                    "CandidateRankingPage-actual-opening",
                  ),
                  detail(
                    "Actually Closed",
                    data.actualClosingDate,
                    "Not closed",
                    "CandidateRankingPage-actual-closing",
                  ),
                  detail(
                    "Faculty Reviews Opened",
                    data.facultyReviewOpeningDate,
                    "Not recorded",
                    "CandidateRankingPage-opening-date",
                  ),
                  detail(
                    "Faculty Ranking Deadline",
                    data.facultyRankingDeadline,
                    "Not set",
                    "CandidateRankingPage-deadline",
                  ),
                ]}
              />
            </section>

            <section aria-label="Course details">
              <h2 className="h5 mt-3">Course</h2>
              <DetailsTable
                testIdPrefix="CandidateRankingPage-course"
                columns={[
                  {
                    label: "Course",
                    value: (
                      <span
                        style={{ whiteSpace: "pre", fontFamily: "monospace" }}
                      >
                        {data.course.courseId}
                      </span>
                    ),
                    text: data.course.courseId,
                    testId: "CandidateRankingPage-course-id",
                  },
                  detail(
                    "Section",
                    data.course.section,
                    "Not specified",
                    "CandidateRankingPage-section",
                  ),
                  detail(
                    "Title",
                    data.course.title,
                    "Not specified",
                    "CandidateRankingPage-title",
                  ),
                  detail(
                    "Instructor",
                    data.course.instructor,
                    "Not specified",
                    "CandidateRankingPage-instructor",
                  ),
                ]}
              />
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
              <>
                <InterestLegend testIdPrefix="CandidateRankingPage-legend" />
                <CandidateTable
                  // Stryker disable next-line all : React key property not exposed in dom
                  key={`${candidatesUrl}?${includeNotInterested}`}
                  candidates={candidates.data}
                  type={data.type}
                  editable={data.canRank === true}
                  apiUrl={candidatesUrl}
                  applicationUrl={`/recruitments/${recruitmentId}/courses/${recruitmentCourseId}/applications`}
                />
              </>
            )}
            <Form.Check
              type="checkbox"
              id="CandidateRankingPage-include-not-interested"
              className="mt-2"
              label={INCLUDE_NOT_INTERESTED_LABEL}
              checked={includeNotInterested}
              onChange={(e) => setIncludeNotInterested(e.target.checked)}
              data-testid="CandidateRankingPage-include-not-interested"
            />
            {includeNotInterested && (
              <p
                className="text-danger fw-bold"
                role="alert"
                data-testid="CandidateRankingPage-not-interested-warning"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                  className="me-1"
                  data-testid="CandidateRankingPage-danger-icon"
                >
                  <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5m.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2" />
                </svg>
                {NOT_INTERESTED_WARNING}
              </p>
            )}
            {cancelled.isError ? (
              <p role="alert">
                Unable to load cancelled applications:{" "}
                {apiErrorMessage(cancelled.error)}
              </p>
            ) : (
              <CancelledApplicationsTable
                cancelled={cancelled.data ?? []}
                audience="faculty"
                testIdPrefix="CandidateRankingPage-cancelled"
              />
            )}
          </>
        )}
      </div>
    </BasicLayout>
  );
}
