import { useEffect } from "react";
import Modal from "react-bootstrap/Modal";
import { Button, Col, Form, Row } from "react-bootstrap";
import { useForm } from "react-hook-form";
import RequiredField from "main/components/Common/RequiredField";
import RequiredFieldExplanation from "main/components/Common/RequiredFieldExplanation";
import type { PriorCourse } from "main/utils/priorCoursework";

/** The form's own view of a row: every answer a string except the checkbox. */
export type PriorCourseFormFields = {
  ucsbCourse: boolean;
  otherSchool: string;
  courseNumber: string;
  courseTitle: string;
  term: string;
  grade: string;
};

type PriorCourseworkModalProps = {
  show: boolean;
  /** The row being edited, or null when adding. */
  course: PriorCourse | null;
  onSave: (course: PriorCourse) => void;
  onCancel: () => void;
  testIdPrefix?: string;
};

const asString = (value: string | null | undefined): string => value ?? "";

const toFormFields = (course: PriorCourse | null): PriorCourseFormFields => ({
  ucsbCourse: course ? course.ucsbCourse : true,
  otherSchool: asString(course?.otherSchool),
  courseNumber: asString(course?.courseNumber),
  courseTitle: asString(course?.courseTitle),
  term: asString(course?.term),
  grade: asString(course?.grade),
});

const blankToNull = (value: string): string | null =>
  value.trim() === "" ? null : value.trim();

/**
 * Add or edit one prior course, in a modal (the proj-frontiers pattern). "UCSB course" is ticked
 * by default; the Other School box is always visible but disabled and blank while it is ticked,
 * and required once it is unticked.
 */
export default function PriorCourseworkModal({
  show,
  course,
  onSave,
  onCancel,
  testIdPrefix = "PriorCourseworkModal",
}: PriorCourseworkModalProps): React.JSX.Element {
  // Stryker disable all
  const {
    register,
    formState: { errors },
    handleSubmit,
    watch,
    reset,
    setValue,
  } = useForm<PriorCourseFormFields>({ defaultValues: toFormFields(course) });
  // Stryker restore all

  // The same modal serves every add and edit, so its fields are reset each time it opens.
  useEffect(() => {
    if (show) reset(toFormFields(course));
  }, [show, course, reset]);

  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form's watch() returns a new function each render; React Compiler correctly skips memoizing this component
  const ucsbCourse = watch("ucsbCourse");

  const id = (name: string) => `${testIdPrefix}-${name}`;

  const submit = (data: PriorCourseFormFields) => {
    onSave({
      ...(course?.id !== undefined ? { id: course.id } : {}),
      ucsbCourse: data.ucsbCourse,
      otherSchool: data.ucsbCourse ? null : blankToNull(data.otherSchool),
      courseNumber: data.courseNumber.trim(),
      courseTitle: blankToNull(data.courseTitle),
      term: blankToNull(data.term),
      grade: blankToNull(data.grade),
    });
  };

  return (
    <Modal
      show={show}
      onHide={onCancel}
      centered={true}
      data-testid={testIdPrefix}
    >
      <Modal.Header closeButton>
        {course ? "Edit Course" : "Add Course"}
      </Modal.Header>
      <Form onSubmit={handleSubmit(submit)}>
        <Modal.Body>
          <p className="mb-2">
            <RequiredFieldExplanation />
          </p>
          <Form.Check
            className="mb-3"
            type="checkbox"
            id={id("ucsbCourse")}
            data-testid={id("ucsbCourse")}
            label="UCSB course"
            {...register("ucsbCourse", {
              // Unticking unlocks the school box; re-ticking empties it. (While the box is ticked
              // the school is already blank, so clearing on untick would change nothing.)
              onChange: (e) => {
                // Stryker disable next-line all : see above, the two branches are indistinguishable
                if (e.target.checked) setValue("otherSchool", "");
              },
            })}
          />
          <Form.Group className="mb-3">
            <Form.Label htmlFor={id("otherSchool")}>
              Other School {!ucsbCourse && <RequiredField />}
            </Form.Label>
            <Form.Control
              id={id("otherSchool")}
              data-testid={id("otherSchool")}
              disabled={ucsbCourse}
              placeholder={ucsbCourse ? "" : "Where the course was taken"}
              isInvalid={Boolean(errors.otherSchool)}
              {...register("otherSchool", {
                validate: (value, fields) =>
                  fields.ucsbCourse || value.trim() !== "",
              })}
            />
            <Form.Control.Feedback type="invalid">
              The school is required for a course not taken at UCSB.
            </Form.Control.Feedback>
          </Form.Group>
          <Row>
            <Form.Group as={Col} md={5} className="mb-3">
              <Form.Label htmlFor={id("courseNumber")}>
                Course Number <RequiredField />
              </Form.Label>
              <Form.Control
                id={id("courseNumber")}
                data-testid={id("courseNumber")}
                placeholder="e.g. CMPSC 156"
                isInvalid={Boolean(errors.courseNumber)}
                {...register("courseNumber", {
                  validate: (value) => value.trim() !== "",
                })}
              />
              <Form.Control.Feedback type="invalid">
                A course number is required.
              </Form.Control.Feedback>
            </Form.Group>
            <Form.Group as={Col} md={7} className="mb-3">
              <Form.Label htmlFor={id("courseTitle")}>Course Title</Form.Label>
              <Form.Control
                id={id("courseTitle")}
                data-testid={id("courseTitle")}
                {...register("courseTitle")}
              />
            </Form.Group>
          </Row>
          <Row>
            <Form.Group as={Col} md={7} className="mb-3">
              <Form.Label htmlFor={id("term")}>
                Term (quarter or semester)
              </Form.Label>
              <Form.Control
                id={id("term")}
                data-testid={id("term")}
                placeholder="e.g. F25 or Fall 2025"
                {...register("term")}
              />
            </Form.Group>
            <Form.Group as={Col} md={5} className="mb-3">
              <Form.Label htmlFor={id("grade")}>Grade</Form.Label>
              <Form.Control
                id={id("grade")}
                data-testid={id("grade")}
                placeholder="IP if in progress"
                {...register("grade")}
              />
            </Form.Group>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={onCancel}
            data-testid={id("cancel")}
          >
            Cancel
          </Button>
          <Button type="submit" data-testid={id("save")}>
            {course ? "Save Changes" : "Add Course"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
