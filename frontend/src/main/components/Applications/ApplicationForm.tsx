import { Button, Col, Form, Row } from "react-bootstrap";
import { useForm } from "react-hook-form";
import type { Application } from "main/components/Applications/ApplicationTable";
import {
  toPayload,
  type ApplicationFormFields,
  type ApplicationPayload,
} from "main/utils/applicationFields";

type ApplicationFormProps = {
  type: "TA" | "ULA";
  /** Course numbers offered by this recruitment, already padded for alignment. */
  courses: string[];
  initialContents?: Partial<Application>;
  /**
   * Names from the signed-in Google account, used only where the application itself has none.
   * Google gives no middle name, so that field has no fallback.
   */
  defaultNames?: { firstName?: string | null; lastName?: string | null };
  submitAction: (payload: ApplicationPayload) => void;
  buttonLabel?: string;
  testIdPrefix?: string;
};

const asString = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value);

/** The first value that is actually an answer; null and "" both mean unanswered. */
const firstAnswered = (...values: unknown[]): string => {
  for (const value of values) {
    const answer = asString(value);
    if (answer !== "") return answer;
  }
  return "";
};

const RESIDENCY_OPTIONS = [
  { value: "US_CITIZEN", label: "US Citizen" },
  { value: "US_RESIDENT", label: "US Permanent Resident" },
  { value: "F1_STUDENT_VISA", label: "F1 Student Visa" },
  { value: "J1_STUDENT_VISA", label: "J1 Student Visa" },
  { value: "OTHER", label: "Other" },
];

/** Only these two are asked about the language exam; everyone else is exempt by definition. */
const VISA_STATUSES = ["F1_STUDENT_VISA", "J1_STUDENT_VISA"];

const LANGUAGE_EXAM_OPTIONS = [
  { value: "PASSED", label: "Passed" },
  { value: "FAILED", label: "Failed" },
  { value: "EXEMPT", label: "Exempt" },
];

const CLASS_LEVEL_OPTIONS = [
  { value: "PHD", label: "PhD" },
  { value: "MS", label: "MS" },
];

export default function ApplicationForm({
  type,
  courses,
  initialContents,
  defaultNames,
  submitAction,
  buttonLabel = "Submit",
  testIdPrefix = "ApplicationForm",
}: ApplicationFormProps): React.JSX.Element {
  const isTa = type === "TA";
  const courseList = Array.isArray(courses) ? courses : [];

  const defaults: Partial<ApplicationFormFields> = {
    // Falls back to the Google account only where the application has nothing, so a name the
    // applicant edited earlier is never overwritten.
    firstName: firstAnswered(
      initialContents?.firstName,
      defaultNames?.firstName,
    ),
    middleName: asString(initialContents?.middleName),
    lastName: firstAnswered(initialContents?.lastName, defaultNames?.lastName),
    major: asString(initialContents?.major),
    gpaMajor: asString(initialContents?.gpaMajor),
    gpaOverall: asString(initialContents?.gpaOverall),
    yearInProgram: asString(initialContents?.yearInProgram),
    graduationDate: asString(initialContents?.graduationDate),
    courseworkUcsb: asString(initialContents?.courseworkUcsb),
    knowledge: asString(initialContents?.knowledge),
    prevExperience: asString(initialContents?.prevExperience),
    desiredCourses: asString(initialContents?.desiredCourses),
    comments: asString(initialContents?.comments),
    firstChoiceCourse: asString(initialContents?.firstChoiceCourse),
    secondChoiceCourse: asString(initialContents?.secondChoiceCourse),
    availableForLecturesFirstChoice: Boolean(
      initialContents?.availableForLecturesFirstChoice,
    ),
    availableForLecturesSecondChoice: Boolean(
      initialContents?.availableForLecturesSecondChoice,
    ),
    availableForDiscussionFirstChoice: Boolean(
      initialContents?.availableForDiscussionFirstChoice,
    ),
    availableForDiscussionSecondChoice: Boolean(
      initialContents?.availableForDiscussionSecondChoice,
    ),
    residencyStatus: asString(initialContents?.residencyStatus),
    languageExam: asString(initialContents?.languageExam),
    languageExamDatePassed: asString(initialContents?.languageExamDatePassed),
    classLevel: asString(initialContents?.classLevel),
    courseworkOther: asString(initialContents?.courseworkOther),
    coursework290: asString(initialContents?.coursework290),
    videoLink: asString(initialContents?.videoLink),
    previousServiceAsUla: asString(initialContents?.previousServiceAsUla),
  };

  // Stryker disable all
  const {
    register,
    formState: { errors },
    handleSubmit,
    watch,
  } = useForm<ApplicationFormFields>({ defaultValues: defaults });
  // Stryker restore all

  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form's watch() returns a new function each render; React Compiler correctly skips memoizing this component
  const residency = watch("residencyStatus");
  const asksAboutLanguageExam = isTa && VISA_STATUSES.includes(residency);

  const id = (name: string) => `${testIdPrefix}-${name}`;

  // A course chosen earlier stays selectable even if the recruitment no longer offers it, or
  // has not finished loading. Otherwise editing an application would silently drop the choice.
  const courseOptions = (includeNone: boolean, current: string) => {
    const values =
      current === "" || courseList.includes(current)
        ? courseList
        : [current, ...courseList];
    return (
      <>
        <option value="">{includeNone ? "(none)" : "Choose a course"}</option>
        {values.map((course) => (
          <option key={course} value={course}>
            {course}
          </option>
        ))}
      </>
    );
  };

  return (
    <Form onSubmit={handleSubmit((data) => submitAction(toPayload(data)))}>
      <h2 className="h5 mt-3">About you</h2>
      <Row>
        <Form.Group as={Col} md={4} className="mb-3">
          <Form.Label htmlFor={id("firstName")}>First Name</Form.Label>
          <Form.Control
            id={id("firstName")}
            data-testid={id("firstName")}
            isInvalid={Boolean(errors.firstName)}
            {...register("firstName", { required: true })}
          />
          <Form.Control.Feedback type="invalid">
            {errors.firstName && "A first name is required."}
          </Form.Control.Feedback>
        </Form.Group>
        <Form.Group as={Col} md={3} className="mb-3">
          <Form.Label htmlFor={id("middleName")}>Middle Name</Form.Label>
          <Form.Control
            id={id("middleName")}
            data-testid={id("middleName")}
            {...register("middleName")}
          />
        </Form.Group>
        <Form.Group as={Col} md={5} className="mb-3">
          <Form.Label htmlFor={id("lastName")}>Last Name</Form.Label>
          <Form.Control
            id={id("lastName")}
            data-testid={id("lastName")}
            isInvalid={Boolean(errors.lastName)}
            {...register("lastName", { required: true })}
          />
          <Form.Control.Feedback type="invalid">
            {errors.lastName && "A last name is required."}
          </Form.Control.Feedback>
        </Form.Group>
      </Row>

      <h2 className="h5 mt-3">Academics</h2>
      <Row>
        <Form.Group as={Col} md={4} className="mb-3">
          <Form.Label htmlFor={id("major")}>Major</Form.Label>
          <Form.Control
            id={id("major")}
            data-testid={id("major")}
            isInvalid={Boolean(errors.major)}
            {...register("major", { required: true })}
          />
          <Form.Control.Feedback type="invalid">
            {errors.major && "A major is required."}
          </Form.Control.Feedback>
        </Form.Group>
        <Form.Group as={Col} md={2} className="mb-3">
          <Form.Label htmlFor={id("gpaMajor")}>GPA in Major</Form.Label>
          <Form.Control
            id={id("gpaMajor")}
            data-testid={id("gpaMajor")}
            type="number"
            step="0.01"
            {...register("gpaMajor")}
          />
        </Form.Group>
        <Form.Group as={Col} md={2} className="mb-3">
          <Form.Label htmlFor={id("gpaOverall")}>Overall GPA</Form.Label>
          <Form.Control
            id={id("gpaOverall")}
            data-testid={id("gpaOverall")}
            type="number"
            step="0.01"
            {...register("gpaOverall")}
          />
        </Form.Group>
        <Form.Group as={Col} md={2} className="mb-3">
          <Form.Label htmlFor={id("yearInProgram")}>Year in Program</Form.Label>
          <Form.Control
            id={id("yearInProgram")}
            data-testid={id("yearInProgram")}
            {...register("yearInProgram")}
          />
        </Form.Group>
        <Form.Group as={Col} md={2} className="mb-3">
          <Form.Label htmlFor={id("graduationDate")}>
            Expected Graduation
          </Form.Label>
          <Form.Control
            id={id("graduationDate")}
            data-testid={id("graduationDate")}
            placeholder="e.g. S27"
            {...register("graduationDate")}
          />
        </Form.Group>
      </Row>

      {isTa && (
        <Row data-testid={id("ta-only")}>
          <Form.Group as={Col} md={3} className="mb-3">
            <Form.Label htmlFor={id("classLevel")}>Class Level</Form.Label>
            <Form.Select
              id={id("classLevel")}
              data-testid={id("classLevel")}
              {...register("classLevel")}
            >
              <option value="">Choose one</option>
              {CLASS_LEVEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group as={Col} md={3} className="mb-3">
            <Form.Label htmlFor={id("residencyStatus")}>
              Residency Status
            </Form.Label>
            <Form.Select
              id={id("residencyStatus")}
              data-testid={id("residencyStatus")}
              {...register("residencyStatus")}
            >
              <option value="">Choose one</option>
              {RESIDENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          {asksAboutLanguageExam && (
            <>
              <Form.Group as={Col} md={3} className="mb-3">
                <Form.Label htmlFor={id("languageExam")}>
                  Language Exam
                </Form.Label>
                <Form.Select
                  id={id("languageExam")}
                  data-testid={id("languageExam")}
                  {...register("languageExam")}
                >
                  <option value="">Choose one</option>
                  {LANGUAGE_EXAM_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Group as={Col} md={3} className="mb-3">
                <Form.Label htmlFor={id("languageExamDatePassed")}>
                  Date Passed
                </Form.Label>
                <Form.Control
                  id={id("languageExamDatePassed")}
                  data-testid={id("languageExamDatePassed")}
                  type="date"
                  {...register("languageExamDatePassed")}
                />
              </Form.Group>
            </>
          )}
        </Row>
      )}

      {!isTa && (
        <Row data-testid={id("ula-only")}>
          <Form.Group as={Col} md={3} className="mb-3">
            <Form.Label htmlFor={id("previousServiceAsUla")}>
              Quarters Previously Served as a ULA
            </Form.Label>
            <Form.Control
              id={id("previousServiceAsUla")}
              data-testid={id("previousServiceAsUla")}
              type="number"
              min="0"
              {...register("previousServiceAsUla")}
            />
          </Form.Group>
          <Form.Group as={Col} md={9} className="mb-3">
            <Form.Label htmlFor={id("videoLink")}>Video Link</Form.Label>
            <Form.Control
              id={id("videoLink")}
              data-testid={id("videoLink")}
              placeholder="https://"
              {...register("videoLink")}
            />
          </Form.Group>
        </Row>
      )}

      <h2 className="h5 mt-3">Coursework and experience</h2>
      <Form.Group className="mb-3">
        <Form.Label htmlFor={id("courseworkUcsb")}>
          Relevant Coursework at UCSB
        </Form.Label>
        <Form.Control
          id={id("courseworkUcsb")}
          data-testid={id("courseworkUcsb")}
          as="textarea"
          rows={2}
          {...register("courseworkUcsb")}
        />
      </Form.Group>

      {isTa && (
        <>
          <Form.Group className="mb-3">
            <Form.Label htmlFor={id("courseworkOther")}>
              Relevant Coursework Elsewhere
            </Form.Label>
            <Form.Control
              id={id("courseworkOther")}
              data-testid={id("courseworkOther")}
              as="textarea"
              rows={2}
              {...register("courseworkOther")}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label htmlFor={id("coursework290")}>
              290-Level Coursework
            </Form.Label>
            <Form.Control
              id={id("coursework290")}
              data-testid={id("coursework290")}
              as="textarea"
              rows={2}
              {...register("coursework290")}
            />
          </Form.Group>
        </>
      )}

      <Form.Group className="mb-3">
        <Form.Label htmlFor={id("knowledge")}>
          Languages, Tools and Technologies You Know
        </Form.Label>
        <Form.Control
          id={id("knowledge")}
          data-testid={id("knowledge")}
          as="textarea"
          rows={2}
          {...register("knowledge")}
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label htmlFor={id("prevExperience")}>
          Previous Teaching Experience
        </Form.Label>
        <Form.Control
          id={id("prevExperience")}
          data-testid={id("prevExperience")}
          as="textarea"
          rows={2}
          {...register("prevExperience")}
        />
      </Form.Group>

      <h2 className="h5 mt-3">Courses and availability</h2>
      <Row>
        <Form.Group as={Col} md={6} className="mb-3">
          <Form.Label htmlFor={id("firstChoiceCourse")}>
            First Choice Course
          </Form.Label>
          <Form.Select
            id={id("firstChoiceCourse")}
            data-testid={id("firstChoiceCourse")}
            style={{ fontFamily: "monospace", whiteSpace: "pre" }}
            isInvalid={Boolean(errors.firstChoiceCourse)}
            {...register("firstChoiceCourse", { required: true })}
          >
            {courseOptions(false, defaults.firstChoiceCourse ?? "")}
          </Form.Select>
          <Form.Control.Feedback type="invalid">
            {errors.firstChoiceCourse && "A first choice course is required."}
          </Form.Control.Feedback>
          <Form.Check
            className="mt-2"
            type="checkbox"
            id={id("availableForLecturesFirstChoice")}
            data-testid={id("availableForLecturesFirstChoice")}
            label="Available for at least one lecture"
            {...register("availableForLecturesFirstChoice")}
          />
          <Form.Check
            type="checkbox"
            id={id("availableForDiscussionFirstChoice")}
            data-testid={id("availableForDiscussionFirstChoice")}
            label="Available for at least one discussion section"
            {...register("availableForDiscussionFirstChoice")}
          />
        </Form.Group>

        <Form.Group as={Col} md={6} className="mb-3">
          <Form.Label htmlFor={id("secondChoiceCourse")}>
            Second Choice Course
          </Form.Label>
          <Form.Select
            id={id("secondChoiceCourse")}
            data-testid={id("secondChoiceCourse")}
            style={{ fontFamily: "monospace", whiteSpace: "pre" }}
            {...register("secondChoiceCourse")}
          >
            {courseOptions(true, defaults.secondChoiceCourse ?? "")}
          </Form.Select>
          <Form.Check
            className="mt-2"
            type="checkbox"
            id={id("availableForLecturesSecondChoice")}
            data-testid={id("availableForLecturesSecondChoice")}
            label="Available for at least one lecture"
            {...register("availableForLecturesSecondChoice")}
          />
          <Form.Check
            type="checkbox"
            id={id("availableForDiscussionSecondChoice")}
            data-testid={id("availableForDiscussionSecondChoice")}
            label="Available for at least one discussion section"
            {...register("availableForDiscussionSecondChoice")}
          />
        </Form.Group>
      </Row>

      <Form.Group className="mb-3">
        <Form.Label htmlFor={id("desiredCourses")}>
          Any Other Courses You Would Like to Be Considered For
        </Form.Label>
        <Form.Control
          id={id("desiredCourses")}
          data-testid={id("desiredCourses")}
          as="textarea"
          rows={2}
          {...register("desiredCourses")}
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label htmlFor={id("comments")}>Anything Else</Form.Label>
        <Form.Control
          id={id("comments")}
          data-testid={id("comments")}
          as="textarea"
          rows={3}
          {...register("comments")}
        />
      </Form.Group>

      <Button type="submit" data-testid={id("submit")}>
        {buttonLabel}
      </Button>
    </Form>
  );
}
