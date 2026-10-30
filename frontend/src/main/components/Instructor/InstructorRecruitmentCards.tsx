import { Accordion, Badge, Card } from "react-bootstrap";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import type { RecruitmentCourse } from "main/components/Recruitments/RecruitmentCourseTable";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import { DATE_KEYS } from "main/utils/recruitmentSort";

/** A recruitment as /api/instructor/recruitments returns it: with the instructor's courses in it. */
export type InstructorRecruitment = Recruitment & {
  courses: RecruitmentCourse[];
};

/** Inside each course's accordion until the review tools exist (issue #127). */
export const COMING_SOON =
  "(Coming soon: options to review and rank applicants)";

type InstructorRecruitmentCardsProps = {
  recruitments: InstructorRecruitment[];
  testIdPrefix?: string;
};

/**
 * One card per recruitment that includes a course the instructor teaches (issue #127): the same
 * header and dates as the student's cards, and in place of the buttons a nested card per course,
 * each an accordion with the course on its header and a placeholder inside.
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
            </Card.Body>
            <Card.Footer>
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
                      {COMING_SOON}
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
