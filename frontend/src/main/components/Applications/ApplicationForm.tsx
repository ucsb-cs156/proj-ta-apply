import { useState } from "react";
import { Alert, Button, Col, Form, Row, Table } from "react-bootstrap";
import { useForm } from "react-hook-form";
import type { Application } from "main/components/Applications/ApplicationTable";
import CourseSectionsCard from "main/components/Applications/CourseSectionsCard";
import NoticeAgreement from "main/components/Notices/NoticeAgreement";
import PriorCourseworkSection from "main/components/PriorCoursework/PriorCourseworkSection";
import { MIN_COURSES, type PriorCourse } from "main/utils/priorCoursework";
import RequiredField from "main/components/Common/RequiredField";
import RequiredFieldExplanation from "main/components/Common/RequiredFieldExplanation";
import type { NoticeVersion } from "main/utils/notices";
import {
  COURSE_INTEREST_OPTIONS,
  DEFAULT_COURSE_INTEREST,
  INTEREST_LEVELS,
  OTHER_MAJOR,
  proficiencyInstruction,
  proficiencyLevels,
  toPayload,
  type ApplicationFormFields,
  type ApplicationPayload,
} from "main/utils/applicationFields";
import {
  BS_MS_QUESTION,
  CHANGING_MAJOR_QUESTION,
  COURSE_PREFERENCES_GUIDANCE,
  EMPLOYEE_ID_NOTE,
  EMPLOYMENT_INTRO,
  GRADUATE_WARNING,
  GRADUATION_NOTE,
  I9_QUESTION,
  OTHER_CAMPUS_JOB_OPTIONS,
  OTHER_CAMPUS_JOB_QUESTION,
  PERM_NUMBER_HINT,
  PERM_NUMBER_PATTERN,
  PRIOR_EMPLOYMENT_QUESTION,
  STUDENT_STATUS_OPTIONS,
  STUDENT_STATUS_QUESTION,
  TA_ELIGIBILITY_NOTE,
  TA_ELIGIBILITY_QUESTION,
  TRAINING_COMMITMENT_OPTIONS,
  TRAINING_EXPLANATION_PROMPT,
  TRAINING_STATEMENT,
  VIDEO_GUIDANCE,
  YES_NO_OPTIONS,
  booleanToSelect,
  type Option,
} from "main/utils/ulaQuestions";

/**
 * The answers react-hook-form manages. The major, the per-course interest answers, the topic
 * ratings and the interest levels are kept apart in plain state: their option lists arrive from the
 * backend after the form has mounted, and react-hook-form reads its defaults only once, so fields
 * registered late would start unanswered.
 */
type RegisteredFields = Omit<
  ApplicationFormFields,
  | "major"
  | "courseInterests"
  | "topicProficiencies"
  | "interests"
  | "noticeVersionId"
  | "priorCoursework"
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
  /** The admin-maintained ULA interests list; a TA form has no interests section and ignores it. */
  interests?: string[];
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

/** The TA language exam answers, worded and ordered as on the legacy form. */
const LANGUAGE_EXAM_OPTIONS = [
  { value: "EXEMPT_US_CITIZEN", label: "exempt (U.S. Citizen)" },
  {
    value: "PASSED_US_PERMANENT_RESIDENT",
    label: "passed (U.S. Perm. Resident)",
  },
  { value: "PASSED_F1_OR_J1_VISA", label: "passed (F1 or J1 visa)" },
  { value: "NOT_PASSED", label: "not passed" },
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
  interests: interestOptions,
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
  // Stryker disable next-line all : don't test default value of empty list
  const interestList = Array.isArray(interestOptions) ? interestOptions : [];
  const topicLevels = proficiencyLevels(type);

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
    videoLink: asString(initialContents?.videoLink),
    previousServiceAsUla: asString(initialContents?.previousServiceAsUla),
    permNumber: asString(initialContents?.permNumber),
    bsMsStudent: booleanToSelect(initialContents?.bsMsStudent),
    studentStatusNextQuarter: asString(
      initialContents?.studentStatusNextQuarter,
    ),
    wantsTaEligibility: booleanToSelect(initialContents?.wantsTaEligibility),
    otherCampusJob: asString(initialContents?.otherCampusJob),
    priorUcsbEmployment: booleanToSelect(initialContents?.priorUcsbEmployment),
    employeeId: asString(initialContents?.employeeId),
    i9Appointment: booleanToSelect(initialContents?.i9Appointment),
    trainingCommitment: asString(initialContents?.trainingCommitment),
    trainingCommitmentExplanation: asString(
      initialContents?.trainingCommitmentExplanation,
    ),
    changingMajor: booleanToSelect(initialContents?.changingMajor),
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
  const watched = watch([
    "firstChoiceCourse",
    "secondChoiceCourse",
    "bsMsStudent",
    "studentStatusNextQuarter",
    "priorUcsbEmployment",
    "previousServiceAsUla",
    "trainingCommitment",
  ]);
  const [
    firstChoice,
    secondChoice,
    bsMsStudent,
    studentStatus,
    priorUcsbEmployment,
    previousService,
    trainingCommitment,
  ] = watched;
  // The ULA questions that depend on an earlier answer, as the Google Form revealed them.
  const asksBsMsFollowUps = !isTa && bsMsStudent === "true";
  const asksEmployeeId = !isTa && priorUcsbEmployment === "true";
  const asksTraining = !isTa && previousService === "0";
  const asksTrainingExplanation =
    asksTraining && ["UNSURE", "CANNOT"].includes(trainingCommitment);

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

  // The prior courses, edited in their own table and modal; sent with the rest on submit.
  const [priorCoursework, setPriorCoursework] = useState<PriorCourse[]>(() => [
    ...(initialContents?.priorCoursework ?? []),
  ]);
  const [tooFewCourses, setTooFewCourses] = useState(false);
  const enoughCourses = priorCoursework.length >= MIN_COURSES[type];

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

  // Likewise only the interest areas the applicant has answered for, keyed by name.
  const [interestLevels, setInterestLevels] = useState<Record<string, number>>(
    () => ({ ...(initialContents?.interests ?? {}) }),
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
    priorCoursework,
    noticeVersionId: notice ? notice.id : null,
    courseInterests: Object.fromEntries(
      courseList.map((courseId) => [courseId, interestIn(courseId)]),
    ),
    topicProficiencies: Object.fromEntries(
      topicList
        .filter((topic) => proficiencies[topic] !== undefined)
        .map((topic) => [topic, proficiencies[topic]]),
    ),
    // A TA form never shows the section, so it sends nothing for it.
    interests: isTa
      ? {}
      : Object.fromEntries(
          interestList
            .filter((interest) => interestLevels[interest] !== undefined)
            .map((interest) => [interest, interestLevels[interest]]),
        ),
  });

  /** The major and the agreement are outside react-hook-form, so their required checks run here. */
  const submit = (data: RegisteredFields) => {
    const chosenMajor = major.trim();
    const missingMajor = chosenMajor === "";
    const missingAgreement = notice !== null && !agreed;
    setMajorMissing(missingMajor);
    setAgreementMissing(missingAgreement);
    setTooFewCourses(!enoughCourses);
    if (missingMajor || missingAgreement || !enoughCourses) {
      return;
    }
    submitAction(toPayload(answers(data, chosenMajor)));
  };
  const flagMissingAnswers = () => {
    if (major.trim() === "") setMajorMissing(true);
    if (!enoughCourses) setTooFewCourses(true);
    // Stryker disable next-line all : without a notice the flag is never shown, so the null check
    // cannot be told apart from true
    if (notice !== null && !agreed) setAgreementMissing(true);
  };

  const id = (name: string) => `${testIdPrefix}-${name}`;

  /** A select with a blank first option, for the ULA questions that take one of a few answers. */
  const choices = (options: Option[], blank = "Choose one") => (
    <>
      <option value="">{blank}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </>
  );

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
          {!isTa && (
            <Form.Text muted data-testid={id("graduationDate-note")}>
              {GRADUATION_NOTE}
            </Form.Text>
          )}
        </Form.Group>
      </Row>
      {!isTa && (
        <Row>
          <Form.Group as={Col} md={6} className="mb-3">
            <Form.Label htmlFor={id("changingMajor")}>
              Changing major?
            </Form.Label>
            <Form.Select
              id={id("changingMajor")}
              data-testid={id("changingMajor")}
              {...register("changingMajor")}
            >
              {choices(YES_NO_OPTIONS)}
            </Form.Select>
            <Form.Text muted>{CHANGING_MAJOR_QUESTION}</Form.Text>
          </Form.Group>
        </Row>
      )}

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
          <Form.Group as={Col} md={3} className="mb-3">
            <Form.Label htmlFor={id("languageExam")}>
              TA Language Exam
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
              Quarter and Year Language Exam Passed
            </Form.Label>
            <Form.Control
              id={id("languageExamDatePassed")}
              data-testid={id("languageExamDatePassed")}
              placeholder="e.g. F25"
              {...register("languageExamDatePassed")}
            />
          </Form.Group>
        </Row>
      )}

      {!isTa && (
        <>
          <Row data-testid={id("ula-only")}>
            <Form.Group as={Col} md={3} className="mb-3">
              <Form.Label htmlFor={id("permNumber")}>
                Perm Number <RequiredField />
              </Form.Label>
              <Form.Control
                id={id("permNumber")}
                data-testid={id("permNumber")}
                placeholder="e.g. 1234567"
                isInvalid={Boolean(errors.permNumber)}
                {...register("permNumber", {
                  required: true,
                  pattern: PERM_NUMBER_PATTERN,
                })}
              />
              <Form.Control.Feedback type="invalid">
                {errors.permNumber?.type === "required"
                  ? "Your perm number is required."
                  : errors.permNumber &&
                    "Exactly 7 characters, letters and digits only."}
              </Form.Control.Feedback>
              <Form.Text muted>{PERM_NUMBER_HINT}</Form.Text>
            </Form.Group>
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
            <Form.Group as={Col} md={6} className="mb-3">
              <Form.Label htmlFor={id("videoLink")}>Video Link</Form.Label>
              <Form.Control
                id={id("videoLink")}
                data-testid={id("videoLink")}
                placeholder="https://"
                {...register("videoLink")}
              />
              <Form.Text muted data-testid={id("videoLink-note")}>
                {VIDEO_GUIDANCE}
              </Form.Text>
            </Form.Group>
          </Row>

          <h2 className="h5 mt-3">BS/MS program</h2>
          <Row data-testid={id("bs-ms")}>
            <Form.Group as={Col} md={4} className="mb-3">
              <Form.Label htmlFor={id("bsMsStudent")}>
                BS/MS student? <RequiredField />
              </Form.Label>
              <Form.Select
                id={id("bsMsStudent")}
                data-testid={id("bsMsStudent")}
                isInvalid={Boolean(errors.bsMsStudent)}
                {...register("bsMsStudent", { required: true })}
              >
                {choices(YES_NO_OPTIONS)}
              </Form.Select>
              <Form.Control.Feedback type="invalid">
                Please say whether you are a BS/MS student.
              </Form.Control.Feedback>
              <Form.Text muted>{BS_MS_QUESTION}</Form.Text>
            </Form.Group>
            {asksBsMsFollowUps && (
              <>
                <Form.Group as={Col} md={4} className="mb-3">
                  <Form.Label htmlFor={id("studentStatusNextQuarter")}>
                    Student status in the quarter you are applying for
                  </Form.Label>
                  <Form.Select
                    id={id("studentStatusNextQuarter")}
                    data-testid={id("studentStatusNextQuarter")}
                    {...register("studentStatusNextQuarter")}
                  >
                    {choices(STUDENT_STATUS_OPTIONS)}
                  </Form.Select>
                  <Form.Text muted>{STUDENT_STATUS_QUESTION}</Form.Text>
                  {studentStatus === "GRADUATE" && (
                    <Alert
                      variant="warning"
                      className="mt-2 small"
                      data-testid={id("graduate-warning")}
                    >
                      {GRADUATE_WARNING}
                    </Alert>
                  )}
                </Form.Group>
                <Form.Group as={Col} md={4} className="mb-3">
                  <Form.Label htmlFor={id("wantsTaEligibility")}>
                    TA eligibility and the Fall TA training
                  </Form.Label>
                  <Form.Select
                    id={id("wantsTaEligibility")}
                    data-testid={id("wantsTaEligibility")}
                    {...register("wantsTaEligibility")}
                  >
                    {choices(YES_NO_OPTIONS)}
                  </Form.Select>
                  <Form.Text muted>
                    {TA_ELIGIBILITY_QUESTION} {TA_ELIGIBILITY_NOTE}
                  </Form.Text>
                </Form.Group>
              </>
            )}
          </Row>

          <h2 className="h5 mt-3">Prior employment</h2>
          <p className="text-muted small mb-2">{EMPLOYMENT_INTRO}</p>
          <Row data-testid={id("employment")}>
            <Form.Group as={Col} md={4} className="mb-3">
              <Form.Label htmlFor={id("otherCampusJob")}>
                Other campus job this quarter? <RequiredField />
              </Form.Label>
              <Form.Select
                id={id("otherCampusJob")}
                data-testid={id("otherCampusJob")}
                isInvalid={Boolean(errors.otherCampusJob)}
                {...register("otherCampusJob", { required: true })}
              >
                {choices(OTHER_CAMPUS_JOB_OPTIONS)}
              </Form.Select>
              <Form.Control.Feedback type="invalid">
                Please answer this question.
              </Form.Control.Feedback>
              <Form.Text muted>{OTHER_CAMPUS_JOB_QUESTION}</Form.Text>
            </Form.Group>
            <Form.Group as={Col} md={4} className="mb-3">
              <Form.Label htmlFor={id("priorUcsbEmployment")}>
                Prior UCSB employment? <RequiredField />
              </Form.Label>
              <Form.Select
                id={id("priorUcsbEmployment")}
                data-testid={id("priorUcsbEmployment")}
                isInvalid={Boolean(errors.priorUcsbEmployment)}
                {...register("priorUcsbEmployment", { required: true })}
              >
                {choices(YES_NO_OPTIONS)}
              </Form.Select>
              <Form.Control.Feedback type="invalid">
                Please answer this question.
              </Form.Control.Feedback>
              <Form.Text muted>{PRIOR_EMPLOYMENT_QUESTION}</Form.Text>
              {asksEmployeeId && (
                <>
                  <Form.Label htmlFor={id("employeeId")} className="mt-2">
                    Employee ID number
                  </Form.Label>
                  <Form.Control
                    id={id("employeeId")}
                    data-testid={id("employeeId")}
                    {...register("employeeId")}
                  />
                  <Form.Text muted>{EMPLOYEE_ID_NOTE}</Form.Text>
                </>
              )}
            </Form.Group>
            <Form.Group as={Col} md={4} className="mb-3">
              <Form.Label htmlFor={id("i9Appointment")}>
                I-9 appointment made or planned?
              </Form.Label>
              <Form.Select
                id={id("i9Appointment")}
                data-testid={id("i9Appointment")}
                {...register("i9Appointment")}
              >
                {choices(YES_NO_OPTIONS)}
              </Form.Select>
              <Form.Text muted>{I9_QUESTION}</Form.Text>
            </Form.Group>
          </Row>

          {asksTraining && (
            <>
              <h2 className="h5 mt-3">Training for new ULAs</h2>
              <p className="small mb-2" data-testid={id("training-statement")}>
                {TRAINING_STATEMENT}
              </p>
              <Row data-testid={id("training")}>
                <Form.Group as={Col} md={6} className="mb-3">
                  <Form.Label htmlFor={id("trainingCommitment")}>
                    Your commitment <RequiredField />
                  </Form.Label>
                  <Form.Select
                    id={id("trainingCommitment")}
                    data-testid={id("trainingCommitment")}
                    isInvalid={Boolean(errors.trainingCommitment)}
                    {...register("trainingCommitment", {
                      validate: (value) => !asksTraining || value !== "",
                    })}
                  >
                    {choices(TRAINING_COMMITMENT_OPTIONS)}
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">
                    As a first-time ULA applicant, please answer this question.
                  </Form.Control.Feedback>
                </Form.Group>
                {asksTrainingExplanation && (
                  <Form.Group as={Col} md={6} className="mb-3">
                    <Form.Label htmlFor={id("trainingCommitmentExplanation")}>
                      Please explain
                    </Form.Label>
                    <Form.Control
                      id={id("trainingCommitmentExplanation")}
                      data-testid={id("trainingCommitmentExplanation")}
                      as="textarea"
                      rows={2}
                      {...register("trainingCommitmentExplanation")}
                    />
                    <Form.Text muted>{TRAINING_EXPLANATION_PROMPT}</Form.Text>
                  </Form.Group>
                )}
              </Row>
            </>
          )}
        </>
      )}

      <PriorCourseworkSection
        type={type}
        courses={priorCoursework}
        onChange={(courses) => {
          setPriorCoursework(courses);
          if (courses.length >= MIN_COURSES[type]) setTooFewCourses(false);
        }}
        invalid={tooFewCourses}
        testIdPrefix={id("coursework")}
      />

      <h2 className="h5 mt-3">Experience</h2>
      <Form.Group className="mb-3" data-testid={id("topicProficiencies")}>
        <Form.Label as="p" className="mb-1">
          Topic Proficiency
        </Form.Label>
        <p className="text-muted small mb-2">{proficiencyInstruction(type)}</p>
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
                {topicLevels.map((level) => (
                  <th key={level.value} className="text-center fw-normal">
                    {level.label}
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
                    {topicLevels.map(({ value: level }) => (
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

      {!isTa && (
        <Form.Group className="mb-3" data-testid={id("interests")}>
          <Form.Label as="p" className="mb-1">
            Interests
          </Form.Label>
          <p className="text-muted small mb-2">
            For each area, choose how interested you are, with 1 being not
            interested and 5 being very interested.
          </p>
          {interestList.length === 0 ? (
            <p className="text-muted small" data-testid={id("interests-none")}>
              No interests are listed yet.
            </p>
          ) : (
            <Table size="sm" responsive className="align-middle">
              <thead>
                <tr>
                  <th>Interest</th>
                  {INTEREST_LEVELS.map((level) => (
                    <th key={level.value} className="text-center fw-normal">
                      {level.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {interestList.map((interest) => {
                  const rowId = id(`interest-${slug(interest)}`);
                  return (
                    <tr key={interest} data-testid={rowId}>
                      <td>{interest}</td>
                      {INTEREST_LEVELS.map(({ value: level }) => (
                        <td key={level} className="text-center">
                          <Form.Check
                            type="radio"
                            name={rowId}
                            id={`${rowId}-${level}`}
                            data-testid={`${rowId}-${level}`}
                            aria-label={`${interest}: ${level}`}
                            value={level}
                            checked={interestLevels[interest] === level}
                            onChange={() =>
                              setInterestLevels((previous) => ({
                                ...previous,
                                [interest]: level,
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
      )}

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

      <h2 className="h5 mt-3">
        {isTa ? "Courses" : "Courses and availability"}
      </h2>
      {!isTa && (
        <p
          className="text-muted small mb-2"
          data-testid={id("course-preferences-guidance")}
        >
          {COURSE_PREFERENCES_GUIDANCE}
        </p>
      )}
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
          {!isTa && (
            <>
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
            </>
          )}
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
          {!isTa && (
            <>
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
            </>
          )}
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
