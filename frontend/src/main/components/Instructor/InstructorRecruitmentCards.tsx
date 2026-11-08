import { Accordion, Badge, Card } from "react-bootstrap";
import { Link } from "react-router";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import DetailsTable from "main/components/Common/DetailsTable";
import { targetsColumns } from "main/utils/courseTargets";
import {
  enrollmentColumns,
  FEEDBACK_PLACEHOLDER,
  groupByQuarter,
  NOT_OPEN_NOTE,
  type CourseInRecruitment,
  type InstructorRecruitment,
  type QuarterCourse,
} from "main/utils/instructorQuarters";

export type { InstructorRecruitment } from "main/utils/instructorQuarters";

type InstructorRecruitmentCardsProps = {
  recruitments: InstructorRecruitment[];
  testIdPrefix?: string;
};

/**
 * The ranking action for a course in a recruitment: Rank Candidates while faculty reviews are Open,
 * View Candidate Rankings once Closed, and otherwise a note that they have not opened. The note
 * takes the natural width of whatever holds it (issue #410), wrapping like ordinary text even in a
 * table cell that does not wrap.
 */
function RankingAction({
  entry,
  id,
}: {
  entry: CourseInRecruitment;
  id: (suffix: string) => string;
}): React.JSX.Element {
  const { recruitment, course } = entry;
  const to = `/recruitments/${recruitment.id}/courses/${course.id}/ranking`;
  if (recruitment.reviewStatus === "Open") {
    return (
      <Link className="btn btn-primary" to={to} data-testid={id("rank")}>
        Rank Candidates
      </Link>
    );
  }
  if (recruitment.reviewStatus === "Closed") {
    return (
      <Link
        className="btn btn-secondary"
        to={to}
        data-testid={id("view-rankings")}
      >
        View Candidate Rankings
      </Link>
    );
  }
  return (
    <span style={{ whiteSpace: "normal" }} data-testid={id("not-open")}>
      {NOT_OPEN_NOTE}
    </span>
  );
}

/**
 * The TA or ULA card of a course (issue #364): everything the old per-recruitment card had, except
 * the Courses button. The type, the application and faculty-review status, the Assignments
 * Published badge and button, the faculty review dates (since issue #410 only those: the date
 * reviews opened and the ranking deadline, not the application dates), and, once the allocations
 * are released, the targets table with the ranking action in an unlabelled first column; while
 * they are withheld, the action alone.
 */
function RecruitmentCard({
  entry,
  testIdPrefix,
}: {
  entry: CourseInRecruitment;
  testIdPrefix: string;
}): React.JSX.Element {
  const { recruitment, course } = entry;
  const id = (suffix: string) => `${testIdPrefix}-${suffix}`;
  const open = recruitment.applicationStatus === "OPEN";
  const targets = recruitment.targets?.[String(course.id)];
  const action = <RankingAction entry={entry} id={id} />;
  return (
    <Card data-testid={id("card")}>
      <Card.Header className="d-flex align-items-center flex-wrap gap-3">
        <strong data-testid={id("type")}>{recruitment.type}</strong>
        <Badge
          bg={open ? "success" : "secondary"}
          data-testid={id("applicationStatus")}
        >
          {recruitment.applicationStatus}
        </Badge>
        <Badge
          bg={recruitment.reviewStatus === "Open" ? "success" : "secondary"}
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
          <div className="col-sm-6 d-flex">
            <dt className="me-2">Faculty Reviews Opened:</dt>
            <dd className="mb-1" data-testid={id("facultyReviewOpeningDate")}>
              {recruitment.facultyReviewOpeningDate ?? ""}
            </dd>
          </div>
          <div className="col-sm-6 d-flex">
            <dt className="me-2">Faculty Ranking Deadline:</dt>
            <dd className="mb-1" data-testid={id("facultyRankingDeadline")}>
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
        {targets ? (
          <div data-testid={id("targets")}>
            <DetailsTable
              testIdPrefix={id("targets-table")}
              columns={[
                // The text only sizes a heading, and this column has none.
                // Stryker disable next-line StringLiteral : see above
                { label: "", value: action, text: "", testId: id("action") },
                ...targetsColumns(targets, testIdPrefix),
              ]}
            />
          </div>
        ) : (
          action
        )}
      </Card.Footer>
    </Card>
  );
}

/**
 * What a course's accordion item holds (issue #364): the enrollment table (always all six columns
 * since issue #410, Enrollment Estimate and the two Allocations reading TBD or N/A until there is a
 * number), the placeholder for the allocation feedback to come, then the TA card and the ULA card
 * for each recruitment it is in.
 */
function CourseBody({
  course,
  testIdPrefix,
}: {
  course: QuarterCourse;
  testIdPrefix: string;
}): React.JSX.Element {
  return (
    <div className="d-flex flex-column gap-3">
      <DetailsTable
        testIdPrefix={`${testIdPrefix}-enrollment`}
        columns={enrollmentColumns(course, testIdPrefix)}
      />
      <div
        className="border rounded p-2 text-muted"
        data-testid={`${testIdPrefix}-feedback`}
      >
        {FEEDBACK_PLACEHOLDER}
      </div>
      {course.ta && (
        <RecruitmentCard
          entry={course.ta}
          testIdPrefix={`${testIdPrefix}-TA`}
        />
      )}
      {course.ula && (
        <RecruitmentCard
          entry={course.ula}
          testIdPrefix={`${testIdPrefix}-ULA`}
        />
      )}
    </div>
  );
}

/**
 * One card per quarter (issue #364), newest first, headed by the quarter alone, with an accordion
 * item per course the instructor teaches in that quarter's TA or ULA recruitment, course id then
 * section; a course in both appears once.
 */
export default function InstructorRecruitmentCards({
  recruitments,
  testIdPrefix = "InstructorRecruitmentCards",
}: InstructorRecruitmentCardsProps): React.JSX.Element {
  const quarters = groupByQuarter(recruitments);

  return (
    <div data-testid={testIdPrefix}>
      {quarters.map((quarter) => {
        const id = (suffix: string) =>
          `${testIdPrefix}-quarter-${quarter.quarter}-${suffix}`;
        return (
          <Card
            key={quarter.quarter}
            className="mb-3"
            style={{ maxWidth: "48rem" }}
            data-testid={id("card")}
          >
            <Card.Header>
              <strong className="fs-5" data-testid={id("quarter")}>
                {yyyyqToQyy(quarter.quarter)}
              </strong>
            </Card.Header>
            <Card.Body>
              <Accordion alwaysOpen data-testid={id("courses")}>
                {quarter.courses.map((course) => (
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
                      <CourseBody
                        course={course}
                        testIdPrefix={id(`course-${course.id}`)}
                      />
                    </Accordion.Body>
                  </Accordion.Item>
                ))}
              </Accordion>
            </Card.Body>
          </Card>
        );
      })}
    </div>
  );
}
