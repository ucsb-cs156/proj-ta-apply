import { Accordion, Badge, Card } from "react-bootstrap";
import { Link } from "react-router";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import type { RecruitmentCourse } from "main/components/Recruitments/RecruitmentCourseTable";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import { DATE_KEYS } from "main/utils/recruitmentSort";
import DetailsTable from "main/components/Common/DetailsTable";
import { targetsColumns, type CourseTargets } from "main/utils/courseTargets";

/**
 * A recruitment as /api/instructor/recruitments returns it: with the instructor's courses in it,
 * and, once the admin has released hiring targets (issue #224), each course's figures keyed by
 * course id; null or absent while withheld.
 */
export type InstructorRecruitment = Recruitment & {
  courses: RecruitmentCourse[];
  targets?: Record<string, CourseTargets> | null;
};

type InstructorRecruitmentCardsProps = {
  recruitments: InstructorRecruitment[];
  testIdPrefix?: string;
};

/**
 * One card per recruitment that includes a course the instructor teaches (issue #127): the shared
 * application summary plus the faculty-review state and dates, and a nested accordion per course.
 */
export default function InstructorRecruitmentCards({
  recruitments,
  testIdPrefix = "InstructorRecruitmentCards",
}: InstructorRecruitmentCardsProps): React.JSX.Element {
  const list = Array.isArray(recruitments) ? recruitments : [];

  return (
    <div data-testid={testIdPrefix}>
      {list.map((recruitment) => {
        const id = (suffix: string) =>
          `${testIdPrefix}-card-${recruitment.id}-${suffix}`;
        const open = recruitment.applicationStatus === "OPEN";
        const courses = Array.isArray(recruitment.courses)
          ? recruitment.courses
          : [];
        return (
          <Card
            key={recruitment.id}
            className="mb-3"
            style={{ maxWidth: "48rem" }}
            data-testid={id("card")}
          >
            <Card.Header className="d-flex align-items-center flex-wrap gap-3">
              <strong className="fs-5" data-testid={id("quarter")}>
                {yyyyqToQyy(recruitment.quarter)}
              </strong>
              <span data-testid={id("type")}>{recruitment.type}</span>
              <Badge
                bg={open ? "success" : "secondary"}
                data-testid={id("applicationStatus")}
              >
                {recruitment.applicationStatus}
              </Badge>
              <Badge
                bg={
                  recruitment.reviewStatus === "Open" ? "success" : "secondary"
                }
                data-testid={id("reviewStatus")}
              >
                Faculty Reviews: {recruitment.reviewStatus}
              </Badge>
              {recruitment.assignmentsPublished === true && (
                <Badge bg="info" data-testid={id("assignmentsPublished")}>
                  Assignments Published
                </Badge>
              )}
            </Card.Header>
            <Card.Body>
              <dl className="row mb-0">
                {DATE_KEYS.map(({ key, label }) => (
                  <div className="col-sm-6 d-flex" key={key}>
                    <dt className="me-2">{label}:</dt>
                    <dd className="mb-1" data-testid={id(key)}>
                      {recruitment[key] ?? ""}
                    </dd>
                  </div>
                ))}
              </dl>
              <dl className="row mb-0 mt-2">
                <div className="col-sm-6 d-flex">
                  <dt className="me-2">Faculty Reviews Opened:</dt>
                  <dd
                    className="mb-1"
                    data-testid={id("facultyReviewOpeningDate")}
                  >
                    {recruitment.facultyReviewOpeningDate ?? ""}
                  </dd>
                </div>
                <div className="col-sm-6 d-flex">
                  <dt className="me-2">Faculty Ranking Deadline:</dt>
                  <dd
                    className="mb-1"
                    data-testid={id("facultyRankingDeadline")}
                  >
                    {recruitment.facultyRankingDeadline ?? ""}
                  </dd>
                </div>
              </dl>
            </Card.Body>
            <Card.Footer>
              {recruitment.assignmentsPublished === true && (
                <Link
                  className="btn btn-dark mb-2"
                  to={`/recruitments/${recruitment.id}/assignments`}
                  data-testid={id("assignments-button")}
                >
                  Assignments
                </Link>
              )}
              {recruitment.allocationsVisibleToFaculty === true && (
                <Link
                  className="btn btn-outline-primary mb-2 ms-2"
                  to={`/recruitments/${recruitment.id}/allocations`}
                  data-testid={id("all-allocations-button")}
                >
                  All allocations
                </Link>
              )}
              <Accordion alwaysOpen data-testid={id("courses")}>
                {courses.map((course) => (
                  <Accordion.Item
                    key={course.id}
                    eventKey={String(course.id)}
                    data-testid={id(`course-${course.id}`)}
                  >
                    <Accordion.Header
                      data-testid={id(`course-${course.id}-header`)}
                    >
                      <span
                        style={{ whiteSpace: "pre", fontFamily: "monospace" }}
                      >
                        {course.courseId}
                      </span>
                      <span className="ms-2">
                        {course.section ? `(${course.section}) ` : ""}
                        {course.title ?? ""}
                      </span>
                    </Accordion.Header>
                    <Accordion.Body
                      data-testid={id(`course-${course.id}-body`)}
                    >
                      {recruitment.targets?.[String(course.id)] && (
                        <div
                          className="mb-2"
                          data-testid={id(`course-${course.id}-targets`)}
                        >
                          <DetailsTable
                            testIdPrefix={id(
                              `course-${course.id}-targets-table`,
                            )}
                            columns={targetsColumns(
                              recruitment.targets[String(course.id)],
                              id(`course-${course.id}`),
                            )}
                          />
                        </div>
                      )}
                      {recruitment.reviewStatus === "Open" && (
                        <Link
                          className="btn btn-primary"
                          to={`/recruitments/${recruitment.id}/courses/${course.id}/ranking`}
                          data-testid={id(`course-${course.id}-rank`)}
                        >
                          Rank Candidates
                        </Link>
                      )}
                      {recruitment.reviewStatus === "Closed" && (
                        <Link
                          className="btn btn-secondary"
                          to={`/recruitments/${recruitment.id}/courses/${course.id}/ranking`}
                          data-testid={id(`course-${course.id}-view-rankings`)}
                        >
                          View Candidate Rankings
                        </Link>
                      )}
                      {recruitment.reviewStatus === "NotStarted" && (
                        <p className="mb-0">
                          Candidate rankings will be available when faculty
                          reviews open.
                        </p>
                      )}
                    </Accordion.Body>
                  </Accordion.Item>
                ))}
              </Accordion>
            </Card.Footer>
          </Card>
        );
      })}
    </div>
  );
}
