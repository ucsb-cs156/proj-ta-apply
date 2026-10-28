import { useState } from "react";
import { Button, Col, Form, Row, Table } from "react-bootstrap";
import { useForm } from "react-hook-form";
import type { Application } from "main/components/Applications/ApplicationTable";
import CourseSectionsCard from "main/components/Applications/CourseSectionsCard";
import NoticeAgreement from "main/components/Notices/NoticeAgreement";
import RequiredField from "main/components/Common/RequiredField";
import RequiredFieldExplanation from "main/components/Common/RequiredFieldExplanation";
import type { NoticeVersion } from "main/utils/notices";
import {
  COURSE_INTEREST_OPTIONS,
  DEFAULT_COURSE_INTEREST,
  OTHER_MAJOR,
  PROFICIENCY_LEVELS,
  toPayload,
  type ApplicationFormFields,
  type ApplicationPayload,
} from "main/utils/applicationFields";

/**
 * The answers react-hook-form manages. The major, the per-course interest answers and the topic
 * ratings are kept apart in plain state: their option lists arrive from the backend after the form
 * has mounted, and react-hook-form reads its defaults only once, so fields registered late would
 * start unanswered.
 */
type RegisteredFields = Omit<
  ApplicationFormFields,
  "major" | "courseInterests" | "topicProficiencies" | "noticeVersionId"
>;

type ApplicationFormProps = {
  type: "TA" | "ULA";
  /** Course numbers offered by this recruitment, already padded for alignment. */
  courses: string[];
  /**
   * The recruitment the courses belong to, so a chosen course's lecture and section times can be
   * looked up. Without it no times are shown, which suits a story or a test with no backend.
   */
  recruitmentId?: number | string;
  /** The admin-maintained majors list for this kind of application. */
  majors: string[];
  /** The admin-maintained topics list for this kind of application. */
  topics: string[];
  /**
   * The "Notices, Terms and Conditions" version to show and require agreement to: the current one
   * for a new application, the one agreed to for an existing one. Null when none exists yet.
   */
  notice?: NoticeVersion | null;
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

/** "CMPSC   156" becomes "CMPSC-156": a course id or topic as it can appear in an element id. */
const slug = (name: string): string => name.replace(/\s+/g, "-");

export default function ApplicationForm({
  type,
  courses,
  recruitmentId,
  majors,
  topics,
  notice = null,
  initialContents,
  defaultNames,
  submitAction,
  buttonLabel = "Submit",
  testIdPrefix = "ApplicationForm",
}: ApplicationFormProps): React.JSX.Element {
  const isTa = type === "TA";
  const courseList = Array.isArray(courses) ? courses : [];
  // Stryker disable next-line all : don't test default value of empty list
  const majorList = Array.isArray(majors) ? majors : [];
  // Stryker disable next-line all : don't test default value of empty list
  const topicList = Array.isArray(topics) ? topics : [];

  // Kept as plain strings so the course dropdowns can keep an earlier choice selectable.
  const initialFirstChoice = asString(initialContents?.firstChoiceCourse);
  const initialSecondChoice = asString(initialContents?.secondChoiceCourse);

  const defaults: Partial<RegisteredFields> = {
    // Falls back to the Google account only where the application has nothing, so a name the
    // applicant edited earlier is never overwritten.
    firstName: firstAnswered(
      initialContents?.firstName,
      defaultNames?.firstName,
    ),
    middleName: asString(initialContents?.middleName),
    lastName: firstAnswered(initialContents?.lastName, defaultNames?.lastName),
    gpaMajor: asString(initialContents?.gpaMajor),
    gpaOverall: asString(initialContents?.gpaOverall),
    yearInProgram: asString(initialContents?.yearInProgram),
    graduationDate: asString(initialContents?.graduationDate),
    courseworkUcsb: asString(initialContents?.courseworkUcsb),
    prevExperience: asString(initialContents?.prevExperience),
    comments: asString(initialContents?.comments),
    firstChoiceCourse: initialFirstChoice,
    secondChoiceCourse: initialSecondChoice,
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
    availabilityCommentsFirstChoice: asString(
      initialContents?.availabilityCommentsFirstChoice,
    ),
    availabilityCommentsSecondChoice: asString(
      initialContents?.availabilityCommentsSecondChoice,
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
  } = useForm<RegisteredFields>({ defaultValues: defaults });
  // Stryker restore all

  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form's watch() returns a new function each render; React Compiler correctly skips memoizing this component
  const [residency, firstChoice, secondChoice] = watch([
    "residencyStatus",
    "firstChoiceCourse",
    "secondChoiceCourse",
  ]);
  const asksAboutLanguageExam = isTa && VISA_STATUSES.includes(residency);

  // The major is stored as plain text. If it is on the list the dropdown shows it; if not (the
  // applicant chose Other, or the list changed since) the dropdown shows Other with the text
  // beside it. otherChosen remembers an explicit choice of Other while the text is still blank.
  const [major, setMajor] = useState<string>(asString(initialContents?.major));
  const [otherChosen, setOtherChosen] = useState(false);
  const [majorMissing, setMajorMissing] = useState(false);
  const majorListed = majorList.includes(major);
  const majorSelection =
    otherChosen || (major !== "" && !majorListed) ? OTHER_MAJOR : major;
  const asksForOtherMajor = majorSelection === OTHER_MAJOR;

  const chooseMajor = (value: string) => {
    setMajorMissing(false);
    if (value === OTHER_MAJOR) {
      setOtherChosen(true);
      // Whatever was selected gives way to a blank box. (Free text already typed cannot reach
      // here: while it is showing, the dropdown already reads Other and does not change.)
      setMajor("");
    } else {
      setOtherChosen(false);
      setMajor(value);
    }
  };

  // The notice version the applicant has ticked the box for. Starts as whatever the application
  // already records, so editing an application shows the box ticked for the version agreed to.
  const [agreedTo, setAgreedTo] = useState<number | null>(
    initialContents?.noticeVersionId ?? null,
  );
  const [agreementMissing, setAgreementMissing] = useState(false);
  const agreed = notice !== null && agreedTo === notice.id;

  // Only the topics the applicant has rated; an unrated topic has no entry. Keyed by topic name,
  // so a rating survives the list being reordered.
  const [proficiencies, setProficiencies] = useState<Record<string, number>>(
    () => ({ ...(initialContents?.topicProficiencies ?? {}) }),
  );

  // Only the courses the applicant has marked; anything else reads as the default. Keyed by
  // course id, so it does not matter which courses were on the list when the answer was given.
  const [interests, setInterests] = useState<Record<string, string>>(() => ({
    ...(initialContents?.courseInterests ?? {}),
  }));
  const interestIn = (courseId: string): string =>
    interests[courseId] ?? DEFAULT_COURSE_INTEREST;

  /** The rank a course holds, if it is one of the two choices; otherwise null. */
  const rankOf = (courseId: string): string | null => {
    if (courseId === firstChoice) return "1st choice";
    if (courseId === secondChoice) return "2nd choice";
    return null;
  };

  /**
   * One answer per listed course, so the payload says what was asked, not only what changed; and
   * a rating for each listed topic the applicant rated, so a topic dropped from the list since an
   * earlier application does not come along silently.
   */
  const answers = (
    data: RegisteredFields,
    chosenMajor: string,
  ): ApplicationFormFields => ({
    ...data,
    major: chosenMajor,
    noticeVersionId: notice ? notice.id : null,
    courseInterests: Object.fromEntries(
      courseList.map((courseId) => [courseId, interestIn(courseId)]),
    ),
    topicProficiencies: Object.fromEntries(
      topicList
        .filter((topic) => proficiencies[topic] !== undefined)
        .map((topic) => [topic, proficiencies[topic]]),
    ),
  });

  /** The major and the agreement are outside react-hook-form, so their required checks run here. */
  const submit = (data: RegisteredFields) => {
    const chosenMajor = major.trim();
    const missingMajor = chosenMajor === "";
    const missingAgreement = notice !== null && !agreed;
    setMajorMissing(missingMajor);
    setAgreementMissing(missingAgreement);
    if (missingMajor || missingAgreement) {
      return;
    }
    submitAction(toPayload(answers(data, chosenMajor)));
  };
  const flagMissingAnswers = () => {
    if (major.trim() === "") setMajorMissing(true);
    // Stryker disable next-line all : without a notice the flag is never shown, so the null check
    // cannot be told apart from true
    if (notice !== null && !agreed) setAgreementMissing(true);
  };

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
    <Form onSubmit={handleSubmit(submit, flagMissingAnswers)}>
      <p className="mb-0 mt-3">
        <RequiredFieldExplanation />
      </p>
      <h2 className="h5 mt-3">About you</h2>
      <Row>
        <Form.Group as={Col} md={4} className="mb-3">
          <Form.Label htmlFor={id("firstName")}>
            First Name <RequiredField />
          </Form.Label>
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
          <Form.Label htmlFor={id("lastName")}>
            Last Name <RequiredField />
          </Form.Label>
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
          <Form.Label htmlFor={id("major")}>
            Major <RequiredField />
          </Form.Label>
          <Form.Select
            id={id("major")}
            data-testid={id("major")}
            isInvalid={majorMissing && !asksForOtherMajor}
            value={majorSelection}
            onChange={(e) => chooseMajor(e.target.value)}
          >
            <option value="">Choose a major</option>
            {majorList.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value={OTHER_MAJOR}>Other</option>
          </Form.Select>
          <Form.Control.Feedback type="invalid">
            A major is required.
          </Form.Control.Feedback>
          {asksForOtherMajor && (
            <>
              <Form.Label htmlFor={id("otherMajor")} className="mt-2">
                Other major <RequiredField />
              </Form.Label>
              <Form.Control
                id={id("otherMajor")}
                data-testid={id("otherMajor")}
                placeholder="Enter your major"
                isInvalid={majorMissing}
                value={major}
                onChange={(e) => {
                  setMajorMissing(false);
                  setMajor(e.target.value);
                }}
              />
              <Form.Control.Feedback type="invalid">
                Please enter your major.
              </Form.Control.Feedback>
            </>
          )}
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

      <Form.Group className="mb-3" data-testid={id("topicProficiencies")}>
        <Form.Label as="p" className="mb-1">
          Topic Proficiency
        </Form.Label>
        <p className="text-muted small mb-2">
          Choose a level of proficiency, with 1 being the lowest, and 5 being
          the highest.
        </p>
        {topicList.length === 0 ? (
          <p
            className="text-muted small"
            data-testid={id("topicProficiencies-none")}
          >
            No topics are listed yet.
          </p>
        ) : (
          <Table size="sm" responsive className="align-middle">
            <thead>
              <tr>
                <th>Topic</th>
                {PROFICIENCY_LEVELS.map((level) => (
                  <th key={level} className="text-center fw-normal">
                    {level}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topicList.map((topic) => {
                const rowId = id(`topic-${slug(topic)}`);
                return (
                  <tr key={topic} data-testid={rowId}>
                    <td>{topic}</td>
                    {PROFICIENCY_LEVELS.map((level) => (
                      <td key={level} className="text-center">
                        <Form.Check
                          type="radio"
                          name={rowId}
                          id={`${rowId}-${level}`}
                          data-testid={`${rowId}-${level}`}
                          aria-label={`${topic}: ${level}`}
                          value={level}
                          checked={proficiencies[topic] === level}
                          onChange={() =>
                            setProficiencies((previous) => ({
                              ...previous,
                              [topic]: level,
                            }))
                          }
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
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
            First Choice Course <RequiredField />
          </Form.Label>
          <Form.Select
            id={id("firstChoiceCourse")}
            data-testid={id("firstChoiceCourse")}
            style={{ fontFamily: "monospace", whiteSpace: "pre" }}
            isInvalid={Boolean(errors.firstChoiceCourse)}
            {...register("firstChoiceCourse", { required: true })}
          >
            {courseOptions(false, initialFirstChoice)}
          </Form.Select>
          <Form.Control.Feedback type="invalid">
            {errors.firstChoiceCourse && "A first choice course is required."}
          </Form.Control.Feedback>
          {recruitmentId !== undefined && firstChoice !== "" && (
            <CourseSectionsCard
              recruitmentId={recruitmentId}
              courseId={firstChoice}
              testIdPrefix={id("firstChoiceSections")}
            />
          )}
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
          <Form.Label
            className="mt-2 mb-1"
            htmlFor={id("availabilityCommentsFirstChoice")}
          >
            1st Choice Availability Comments
          </Form.Label>
          <Form.Control
            id={id("availabilityCommentsFirstChoice")}
            data-testid={id("availabilityCommentsFirstChoice")}
            as="textarea"
            rows={2}
            {...register("availabilityCommentsFirstChoice")}
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
            {courseOptions(true, initialSecondChoice)}
          </Form.Select>
          {recruitmentId !== undefined && secondChoice !== "" && (
            <CourseSectionsCard
              recruitmentId={recruitmentId}
              courseId={secondChoice}
              testIdPrefix={id("secondChoiceSections")}
            />
          )}
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
          <Form.Label
            className="mt-2 mb-1"
            htmlFor={id("availabilityCommentsSecondChoice")}
          >
            2nd Choice Availability Comments
          </Form.Label>
          <Form.Control
            id={id("availabilityCommentsSecondChoice")}
            data-testid={id("availabilityCommentsSecondChoice")}
            as="textarea"
            rows={2}
            {...register("availabilityCommentsSecondChoice")}
          />
        </Form.Group>
      </Row>

      <Form.Group className="mb-3" data-testid={id("courseInterests")}>
        <Form.Label as="p" className="mb-1">
          Other Courses You Would Like to Be Considered For
        </Form.Label>
        <p className="text-muted small mb-2">
          Your first and second choices are marked below. For every other
          course, say how interested you would be. The default is Not Applicable
          / Not Interested.
        </p>
        {courseList.length === 0 ? (
          <p
            className="text-muted small"
            data-testid={id("courseInterests-none")}
          >
            No courses are listed for this recruitment yet.
          </p>
        ) : (
          <Table size="sm" responsive className="align-middle">
            <thead>
              <tr>
                <th>Course</th>
                {COURSE_INTEREST_OPTIONS.map((option) => (
                  <th key={option.value} className="text-center fw-normal">
                    {option.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {courseList.map((courseId) => {
                const rank = rankOf(courseId);
                const rowId = id(`courseInterest-${slug(courseId)}`);
                return (
                  <tr key={courseId} data-testid={rowId}>
                    <td style={{ fontFamily: "monospace", whiteSpace: "pre" }}>
                      {courseId}
                    </td>
                    {rank ? (
                      <td
                        colSpan={COURSE_INTEREST_OPTIONS.length}
                        className="text-center"
                        data-testid={`${rowId}-choice`}
                      >
                        <strong>{rank}</strong>
                      </td>
                    ) : (
                      COURSE_INTEREST_OPTIONS.map((option) => (
                        <td key={option.value} className="text-center">
                          <Form.Check
                            type="radio"
                            name={rowId}
                            id={`${rowId}-${option.value}`}
                            data-testid={`${rowId}-${option.value}`}
                            aria-label={`${courseId}: ${option.label}`}
                            value={option.value}
                            checked={interestIn(courseId) === option.value}
                            onChange={() =>
                              setInterests((previous) => ({
                                ...previous,
                                [courseId]: option.value,
                              }))
                            }
                          />
                        </td>
                      ))
                    )}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
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

      <NoticeAgreement
        notice={notice}
        agreed={agreed}
        invalid={agreementMissing}
        onChange={(checked) => {
          setAgreementMissing(false);
          setAgreedTo(checked && notice ? notice.id : null);
        }}
        testIdPrefix={id("notice")}
      />

      <Button type="submit" data-testid={id("submit")}>
        {buttonLabel}
      </Button>
    </Form>
  );
}
