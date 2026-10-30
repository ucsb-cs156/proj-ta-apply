import { useState } from "react";
import Modal from "react-bootstrap/Modal";
import { Button, Form, Table } from "react-bootstrap";
import { useBackend } from "main/utils/useBackend";
import type { PriorCourse } from "main/utils/priorCoursework";
import {
  GRADE_OPTIONS,
  NO_ANSWER,
  bulkCourseRows,
  collapseCourseId,
  recentQuarters,
  type BulkCourseAnswer,
  type CatalogCourse,
} from "main/utils/bulkCourses";

type BulkUcsbCoursesModalProps = {
  show: boolean;
  /** Named in the title; the course table holds this subject area's courses. */
  subjectArea?: string;
  /** Called with the rows for the courses ticked, in the order they are listed. */
  onAdd: (courses: PriorCourse[]) => void;
  onCancel: () => void;
  testIdPrefix?: string;
};

/** "CMPSC   156" becomes "CMPSC-156": a course id as it can appear in an element id. */
const slug = (courseId: string): string => courseId.replace(/\s+/g, "-");

/**
 * A faster way to list UCSB courses (issue #100): every course in the admin-populated course table,
 * each with a "taken" box, a term going back ten years, and a grade. The courses ticked are added
 * to the prior coursework table as UCSB courses, where they can still be edited or deleted.
 */
export default function BulkUcsbCoursesModal({
  show,
  subjectArea = "CMPSC",
  onAdd,
  onCancel,
  testIdPrefix = "BulkUcsbCoursesModal",
}: BulkUcsbCoursesModalProps): React.JSX.Element {
  const { data: courses, isFetched } = useBackend<CatalogCourse[]>(
    ["/api/courses/all"],
    { method: "GET", url: "/api/courses/all" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );
  const list = Array.isArray(courses) ? courses : [];

  const [answers, setAnswers] = useState<Record<string, BulkCourseAnswer>>({});
  const answerFor = (courseId: string): BulkCourseAnswer =>
    answers[courseId] ?? NO_ANSWER;
  const update = (courseId: string, patch: Partial<BulkCourseAnswer>) =>
    setAnswers((previous) => ({
      ...previous,
      [courseId]: { ...answerFor(courseId), ...patch },
    }));

  const quarters = recentQuarters();
  const chosen = bulkCourseRows(list, answers);
  const id = (name: string) => `${testIdPrefix}-${name}`;

  return (
    <Modal
      show={show}
      onHide={onCancel}
      size="lg"
      scrollable
      data-testid={testIdPrefix}
    >
      <Modal.Header closeButton>
        Add Multiple UCSB {subjectArea} Courses
      </Modal.Header>
      <Modal.Body>
        <p className="small text-muted mb-2" data-testid={id("instructions")}>
          Tick each course you have taken, with the term and your grade (IP if
          it is in progress); choosing a term or grade ticks the course too. The
          courses ticked are added to your list as UCSB courses, where you can
          still edit or delete them.
        </p>
        {list.length === 0 ? (
          <p className="text-muted small" data-testid={id("none")}>
            {isFetched ? "No courses are listed yet." : "Loading courses…"}
          </p>
        ) : (
          <Table size="sm" responsive className="align-middle">
            <thead>
              <tr>
                <th className="text-center">Taken</th>
                <th>Course</th>
                <th>Title</th>
                <th>Term</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              {list.map((course) => {
                const row = id(`row-${slug(course.courseId)}`);
                const answer = answerFor(course.courseId);
                const name = collapseCourseId(course.courseId);
                return (
                  <tr key={course.courseId} data-testid={row}>
                    <td className="text-center">
                      <Form.Check
                        type="checkbox"
                        id={`${row}-taken`}
                        data-testid={`${row}-taken`}
                        aria-label={`Took ${name}`}
                        checked={answer.taken}
                        onChange={(e) =>
                          update(course.courseId, { taken: e.target.checked })
                        }
                      />
                    </td>
                    <td
                      style={{ fontFamily: "monospace", whiteSpace: "pre" }}
                      data-testid={`${row}-courseId`}
                    >
                      {course.courseId}
                    </td>
                    <td data-testid={`${row}-title`}>{course.title}</td>
                    <td>
                      <Form.Select
                        size="sm"
                        data-testid={`${row}-term`}
                        aria-label={`Term for ${name}`}
                        value={answer.term}
                        onChange={(e) =>
                          update(course.courseId, {
                            term: e.target.value,
                            taken: true,
                          })
                        }
                      >
                        <option value="">Term</option>
                        {quarters.map((quarter) => (
                          <option key={quarter.yyyyq} value={quarter.yyyyq}>
                            {quarter.qyy}
                          </option>
                        ))}
                      </Form.Select>
                    </td>
                    <td>
                      <Form.Select
                        size="sm"
                        data-testid={`${row}-grade`}
                        aria-label={`Grade for ${name}`}
                        value={answer.grade}
                        onChange={(e) =>
                          update(course.courseId, {
                            grade: e.target.value,
                            taken: true,
                          })
                        }
                      >
                        <option value="">Grade</option>
                        {GRADE_OPTIONS.map((grade) => (
                          <option key={grade} value={grade}>
                            {grade}
                          </option>
                        ))}
                      </Form.Select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="secondary"
          onClick={onCancel}
          data-testid={id("cancel")}
        >
          Cancel
        </Button>
        <Button
          disabled={chosen.length === 0}
          onClick={() => onAdd(chosen)}
          data-testid={id("add")}
        >
          Add {chosen.length} Course{chosen.length === 1 ? "" : "s"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
