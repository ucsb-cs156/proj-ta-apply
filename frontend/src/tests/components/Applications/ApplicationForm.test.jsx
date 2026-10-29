import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";

import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import ApplicationForm from "main/components/Applications/ApplicationForm";
import applicationsFixtures from "fixtures/applicationsFixtures";
import courseSectionsFixtures from "fixtures/courseSectionsFixtures";

const axiosMock = new AxiosMockAdapter(axios);
import noticesFixtures from "fixtures/noticesFixtures";
import priorCourseworkFixtures from "fixtures/priorCourseworkFixtures";

const courses = ["CMPSC     8", "CMPSC   130A", "CMPSC   156"];
const majors = ["Computer Engineering", "Computer Science", "Statistics"];
const topics = ["Compilers", "Java", "Python"];
const interests = ["Grading", "Office hours", "Tutoring"];

function renderForm({
  type = "TA",
  initialContents = undefined,
  defaultNames = undefined,
  submitAction = vi.fn(),
  buttonLabel = undefined,
  courseList = courses,
  recruitmentId = undefined,
  majorList = majors,
  topicList = topics,
  interestList = interests,
  notice = undefined,
} = {}) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ApplicationForm
          type={type}
          courses={courseList}
          recruitmentId={recruitmentId}
          majors={majorList}
          topics={topicList}
          interests={interestList}
          notice={notice}
          initialContents={initialContents}
          defaultNames={defaultNames}
          submitAction={submitAction}
          buttonLabel={buttonLabel}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return submitAction;
}

/** The ULA form's own required questions (issue #72), when the form is a ULA one. */
async function fillRequiredUla(prefix = "ApplicationForm") {
  if (!screen.queryByTestId(`${prefix}-permNumber`)) return;
  await userEvent.type(screen.getByTestId(`${prefix}-permNumber`), "1234567");
  await userEvent.selectOptions(
    screen.getByTestId(`${prefix}-bsMsStudent`),
    "false",
  );
  await userEvent.selectOptions(
    screen.getByTestId(`${prefix}-otherCampusJob`),
    "NO",
  );
  await userEvent.selectOptions(
    screen.getByTestId(`${prefix}-priorUcsbEmployment`),
    "false",
  );
}

/** Names, a listed major and a first choice: everything else required, so one thing can be tested. */
async function fillRequired(prefix = "ApplicationForm") {
  await userEvent.type(screen.getByTestId(`${prefix}-firstName`), "Ada");
  await userEvent.type(screen.getByTestId(`${prefix}-lastName`), "Lovelace");
  await userEvent.selectOptions(
    screen.getByTestId(`${prefix}-major`),
    "Statistics",
  );
  await userEvent.selectOptions(
    screen.getByTestId(`${prefix}-firstChoiceCourse`),
    "CMPSC   156",
  );
  await fillRequiredUla(prefix);
}

/**
 * The label element whose text is `text`, ignoring the required-field mark. Required labels read
 * "First Name *", and getByText wants the whole text, so the mark is stripped before comparing.
 */
const labelNamed = (text) =>
  screen.getByText(
    (_, element) =>
      ["LABEL", "P"].includes(element.tagName) &&
      element.textContent.replace(/\s*\*\s*$/, "").trim() === text,
  );

describe("ApplicationForm tests", () => {
  beforeEach(() => {
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/recruitments/sections")
      .reply(200, courseSectionsFixtures.cmpsc156);
  });

  test("renders the fields common to both kinds of application", () => {
    renderForm();

    [
      "First Name",
      "Middle Name",
      "Last Name",
      "Major",
      "GPA in Major",
      "Overall GPA",
      "Year in Program",
      "Expected Graduation",
      "Topic Proficiency",
      "First Choice Course",
      "Second Choice Course",
      "Other Courses You Would Like to Be Considered For",
      "Anything Else",
    ].forEach((label) => expect(labelNamed(label)).toBeInTheDocument());
  });

  /** Required fields carry the app-wide mark, and the form says what the mark means. */
  test("marks exactly the required fields and explains the mark", () => {
    renderForm({ type: "TA", notice: noticesFixtures.taV2 });

    expect(screen.getByTestId("RequiredFieldExplanation")).toHaveTextContent(
      "Fields marked * are required.",
    );
    // Every mark inside a label, by the label it marks; the explanation's own example mark has
    // no label and is left out.
    const marked = screen
      .getAllByTestId("RequiredField")
      .map((mark) => mark.closest("label"))
      .filter((label) => label !== null)
      .map((label) => label.textContent.replace(/\s*\*\s*$/, "").trim());
    // The agreement comes first: the notice is at the top of the form (issue #77).
    expect(marked).toEqual([
      "I have read and understood the text above, and I agree to the terms and conditions it specifies",
      "First Name",
      "Last Name",
      "Major",
      "First Choice Course",
    ]);
    // And nothing optional is marked.
    ["Middle Name", "GPA in Major", "Second Choice Course"].forEach((label) =>
      expect(labelNamed(label).querySelector(".required-field")).toBeNull(),
    );
  });

  test("each label is wired to its control by id", async () => {
    renderForm({ type: "TA" });
    // Residency F1 so the exam questions are on the page too.
    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-residencyStatus"),
      "F1_STUDENT_VISA",
    );

    const wired = [
      ["First Name", "firstName"],
      ["Middle Name", "middleName"],
      ["Last Name", "lastName"],
      ["Major", "major"],
      ["GPA in Major", "gpaMajor"],
      ["Overall GPA", "gpaOverall"],
      ["Year in Program", "yearInProgram"],
      ["Expected Graduation", "graduationDate"],
      ["Class Level", "classLevel"],
      ["Residency Status", "residencyStatus"],
      ["TA Language Exam", "languageExam"],
      ["Quarter and Year Language Exam Passed", "languageExamDatePassed"],
      ["Previous Teaching Experience", "prevExperience"],
      ["First Choice Course", "firstChoiceCourse"],
      ["Second Choice Course", "secondChoiceCourse"],
      ["Anything Else", "comments"],
    ];
    wired.forEach(([label, name]) => {
      const control = screen.getByTestId(`ApplicationForm-${name}`);
      expect(control).toHaveAttribute("id", `ApplicationForm-${name}`);
      expect(labelNamed(label)).toHaveAttribute(
        "for",
        `ApplicationForm-${name}`,
      );
    });
    // Checkboxes: Form.Check renders its label from the id.
    [
      "availableForLecturesFirstChoice",
      "availableForDiscussionFirstChoice",
      "availableForLecturesSecondChoice",
      "availableForDiscussionSecondChoice",
    ].forEach((name) =>
      expect(screen.getByTestId(`ApplicationForm-${name}`)).toHaveAttribute(
        "id",
        `ApplicationForm-${name}`,
      ),
    );
  });

  test("a ULA application wires its own labels too", () => {
    renderForm({ type: "ULA" });

    [
      ["Quarters Previously Served as a ULA", "previousServiceAsUla"],
      ["Video Link", "videoLink"],
      ["Perm Number", "permNumber"],
      ["BS/MS student?", "bsMsStudent"],
      ["Other campus job this quarter?", "otherCampusJob"],
      ["Prior UCSB employment?", "priorUcsbEmployment"],
      ["I-9 appointment made or planned?", "i9Appointment"],
      ["Changing major?", "changingMajor"],
    ].forEach(([label, name]) => {
      expect(screen.getByTestId(`ApplicationForm-${name}`)).toHaveAttribute(
        "id",
        `ApplicationForm-${name}`,
      );
      expect(labelNamed(label)).toHaveAttribute(
        "for",
        `ApplicationForm-${name}`,
      );
    });
    expect(screen.getByTestId("ApplicationForm-ula-only")).toBeInTheDocument();
  });

  test("the submit button can be relabelled", () => {
    renderForm({ buttonLabel: "Update Application" });

    expect(screen.getByTestId("ApplicationForm-submit")).toHaveTextContent(
      "Update Application",
    );
  });

  test("the submit button defaults to Submit", () => {
    renderForm();

    expect(screen.getByTestId("ApplicationForm-submit")).toHaveTextContent(
      "Submit",
    );
  });

  // ---- which questions each kind asks ----

  test("a TA application asks the TA-only questions and not the ULA ones", () => {
    renderForm({ type: "TA" });

    expect(screen.getByTestId("ApplicationForm-ta-only")).toBeInTheDocument();
    expect(screen.getByTestId("ApplicationForm-classLevel")).toHaveAttribute(
      "id",
      "ApplicationForm-classLevel",
    );
    expect(labelNamed("Class Level")).toHaveAttribute(
      "for",
      "ApplicationForm-classLevel",
    );
    expect(
      screen.getByTestId("ApplicationForm-classLevel"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("ApplicationForm-residencyStatus"),
    ).toBeInTheDocument();

    expect(screen.queryByTestId("ApplicationForm-videoLink")).toBeNull();
    expect(
      screen.queryByTestId("ApplicationForm-previousServiceAsUla"),
    ).toBeNull();
    // Nor any of the Google Form's ULA questions (issue #72).
    for (const name of [
      "permNumber",
      "bsMsStudent",
      "otherCampusJob",
      "priorUcsbEmployment",
      "i9Appointment",
      "changingMajor",
      "graduationDate-note",
      "videoLink-note",
      "course-preferences-guidance",
      "training",
    ]) {
      expect(screen.queryByTestId(`ApplicationForm-${name}`)).toBeNull();
    }
  });

  test("a ULA application asks the ULA-only questions and not the TA ones", () => {
    renderForm({ type: "ULA" });

    expect(screen.getByTestId("ApplicationForm-videoLink")).toBeInTheDocument();
    expect(
      screen.getByTestId("ApplicationForm-previousServiceAsUla"),
    ).toBeInTheDocument();

    expect(screen.queryByTestId("ApplicationForm-classLevel")).toBeNull();
    expect(screen.queryByTestId("ApplicationForm-residencyStatus")).toBeNull();
    expect(screen.queryByTestId("ApplicationForm-languageExam")).toBeNull();
  });

  /** As on the legacy form: every TA applicant is asked, whatever their residency. */
  test("the language exam questions are asked of every TA applicant, with the legacy answers", async () => {
    renderForm({ type: "TA" });

    const exam = screen.getByTestId("ApplicationForm-languageExam");
    expect(exam).toHaveAttribute("id", "ApplicationForm-languageExam");
    expect(labelNamed("TA Language Exam")).toHaveAttribute(
      "for",
      "ApplicationForm-languageExam",
    );
    expect([...exam.options].map((o) => o.textContent)).toEqual([
      "Choose one",
      "exempt (U.S. Citizen)",
      "passed (U.S. Perm. Resident)",
      "passed (F1 or J1 visa)",
      "not passed",
    ]);
    expect([...exam.options].map((o) => o.value)).toEqual([
      "",
      "EXEMPT_US_CITIZEN",
      "PASSED_US_PERMANENT_RESIDENT",
      "PASSED_F1_OR_J1_VISA",
      "NOT_PASSED",
    ]);
    // The quarter and year is free text, as on the legacy form, not a date picker.
    const passed = screen.getByTestId("ApplicationForm-languageExamDatePassed");
    expect(passed).not.toHaveAttribute("type", "date");
    expect(passed).toHaveAttribute("placeholder", "e.g. F25");
    expect(labelNamed("Quarter and Year Language Exam Passed")).toHaveAttribute(
      "for",
      "ApplicationForm-languageExamDatePassed",
    );

    // Still asked after choosing a residency that the old form would have hidden them for.
    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-residencyStatus"),
      "US_CITIZEN",
    );
    expect(
      screen.getByTestId("ApplicationForm-languageExam"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("ApplicationForm-languageExamDatePassed"),
    ).toBeInTheDocument();
  });

  test("the exam questions sit right after Residency, as on the legacy form", () => {
    renderForm({ type: "TA" });

    const row = screen.getByTestId("ApplicationForm-ta-only");
    const order = [...row.querySelectorAll("label")].map((l) => l.textContent);
    expect(order).toEqual([
      "Class Level",
      "Residency Status",
      "TA Language Exam",
      "Quarter and Year Language Exam Passed",
    ]);
  });

  // ---- course choices ----

  test("the course dropdowns offer the recruitment's courses", () => {
    renderForm();

    const first = screen.getByTestId("ApplicationForm-firstChoiceCourse");
    expect([...first.options].map((o) => o.value)).toEqual(["", ...courses]);
    expect(first.options[0]).toHaveTextContent("Choose a course");

    const second = screen.getByTestId("ApplicationForm-secondChoiceCourse");
    expect([...second.options].map((o) => o.value)).toEqual(["", ...courses]);
    // A second choice is optional, so its blank option says so.
    expect(second.options[0]).toHaveTextContent("(none)");
  });

  test("course numbers keep their padding", () => {
    renderForm();

    expect(screen.getByTestId("ApplicationForm-firstChoiceCourse")).toHaveStyle(
      { whiteSpace: "pre", fontFamily: "monospace" },
    );
  });

  /** Otherwise editing an application would silently drop a choice no longer on offer. */
  test("a previously chosen course stays selectable even when it is not on offer", async () => {
    const submitAction = renderForm({
      courseList: ["CMPSC     8"],
      initialContents: {
        priorCoursework: priorCourseworkFixtures.threeCourses,
        firstName: "Ada",
        lastName: "Lovelace",
        major: "Computer Science",
        firstChoiceCourse: "CMPSC   194",
        secondChoiceCourse: "CMPSC   189",
      },
    });

    const first = screen.getByTestId("ApplicationForm-firstChoiceCourse");
    expect([...first.options].map((o) => o.value)).toEqual([
      "",
      "CMPSC   194",
      "CMPSC     8",
    ]);
    expect(first).toHaveValue("CMPSC   194");

    const second = screen.getByTestId("ApplicationForm-secondChoiceCourse");
    expect([...second.options].map((o) => o.value)).toEqual([
      "",
      "CMPSC   189",
      "CMPSC     8",
    ]);
    expect(second).toHaveValue("CMPSC   189");

    await userEvent.click(screen.getByTestId("ApplicationForm-submit"));
    await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1));
    expect(submitAction.mock.calls[0][0].firstChoiceCourse).toBe("CMPSC   194");
  });

  test("tolerates a non-array courses prop", () => {
    renderForm({ courseList: null });

    const first = screen.getByTestId("ApplicationForm-firstChoiceCourse");
    expect([...first.options].map((o) => o.value)).toEqual([""]);
  });

  // ---- lecture and section times ----

  /** The card sits between the dropdown and the availability checkboxes it informs. */
  test("choosing a course shows its lecture and section times above the availability questions", async () => {
    renderForm({ recruitmentId: 7 });

    expect(
      screen.queryByTestId("ApplicationForm-firstChoiceSections"),
    ).toBeNull();
    expect(
      screen.queryByTestId("ApplicationForm-secondChoiceSections"),
    ).toBeNull();

    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-firstChoiceCourse"),
      "CMPSC   156",
    );

    const card = await screen.findByTestId(
      "ApplicationForm-firstChoiceSections",
    );
    expect(card).toHaveTextContent("Lecture and section times for CMPSC 156");
    expect(
      await screen.findByTestId(
        "ApplicationForm-firstChoiceSections-row-0-type",
      ),
    ).toHaveTextContent("Lecture");
    const request = axiosMock.history.get.find(
      (r) => r.url === "/api/recruitments/sections",
    );
    expect(request.params).toEqual({
      recruitmentId: 7,
      courseId: "CMPSC   156",
    });

    // Dropdown, then card, then checkboxes, in that order on the page.
    const select = screen.getByTestId("ApplicationForm-firstChoiceCourse");
    const checkbox = screen.getByTestId(
      "ApplicationForm-availableForLecturesFirstChoice",
    );
    expect(
      select.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      card.compareDocumentPosition(checkbox) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // Still only the first choice has a card.
    expect(
      screen.queryByTestId("ApplicationForm-secondChoiceSections"),
    ).toBeNull();
  });

  test("the second choice gets its own card, and clearing the choice removes it", async () => {
    renderForm({ recruitmentId: 7 });

    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-secondChoiceCourse"),
      "CMPSC   130A",
    );
    expect(
      await screen.findByTestId("ApplicationForm-secondChoiceSections"),
    ).toHaveTextContent("Lecture and section times for CMPSC 130A");
    expect(
      screen.queryByTestId("ApplicationForm-firstChoiceSections"),
    ).toBeNull();

    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-secondChoiceCourse"),
      "",
    );
    await waitFor(() =>
      expect(
        screen.queryByTestId("ApplicationForm-secondChoiceSections"),
      ).toBeNull(),
    );
  });

  test("a previously chosen course shows its times straight away", async () => {
    renderForm({
      recruitmentId: 7,
      initialContents: applicationsFixtures.oneTaApplication,
    });

    expect(
      await screen.findByTestId("ApplicationForm-firstChoiceSections"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("ApplicationForm-secondChoiceSections"),
    ).toBeInTheDocument();
  });

  /** A story or a test with no backend passes no recruitment, and gets no lookups. */
  test("without a recruitment no times are looked up", async () => {
    renderForm({ initialContents: applicationsFixtures.oneTaApplication });

    expect(
      screen.queryByTestId("ApplicationForm-firstChoiceSections"),
    ).toBeNull();
    expect(
      screen.queryByTestId("ApplicationForm-secondChoiceSections"),
    ).toBeNull();
    expect(axiosMock.history.get).toHaveLength(0);
  });

  // ---- availability comments ----

  test("asks for availability comments under each choice and submits them", async () => {
    const submitAction = renderForm({
      type: "ULA",
      initialContents: {
        priorCoursework: [priorCourseworkFixtures.ucsbCourse],
      },
    });

    expect(
      screen.getByText("1st Choice Availability Comments"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("2nd Choice Availability Comments"),
    ).toBeInTheDocument();

    await userEvent.type(
      screen.getByTestId("ApplicationForm-firstName"),
      "Ada",
    );
    await userEvent.type(
      screen.getByTestId("ApplicationForm-lastName"),
      "Lovelace",
    );
    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-major"),
      "Computer Science",
    );
    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-firstChoiceCourse"),
      "CMPSC   156",
    );
    await userEvent.type(
      screen.getByTestId("ApplicationForm-availabilityCommentsFirstChoice"),
      "Free any afternoon",
    );
    await userEvent.type(
      screen.getByTestId("ApplicationForm-availabilityCommentsSecondChoice"),
      "Mornings only",
    );

    await fillRequiredUla();
    await userEvent.click(screen.getByTestId("ApplicationForm-submit"));

    await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1));
    const payload = submitAction.mock.calls[0][0];
    expect(payload.availabilityCommentsFirstChoice).toBe("Free any afternoon");
    expect(payload.availabilityCommentsSecondChoice).toBe("Mornings only");
  });

  test("pre-fills the availability comments, with null as blank", () => {
    renderForm({ initialContents: applicationsFixtures.oneTaApplication });

    expect(
      screen.getByTestId("ApplicationForm-availabilityCommentsFirstChoice"),
    ).toHaveValue("Free any afternoon but Wednesday.");
    expect(
      screen.getByTestId("ApplicationForm-availabilityCommentsSecondChoice"),
    ).toHaveValue("");
  });

  // ---- interest in the other courses ----

  const radio = (course, interest) =>
    screen.getByTestId(`ApplicationForm-courseInterest-${course}-${interest}`);

  test("every course gets the three options, defaulting to not interested", () => {
    renderForm();

    expect(screen.getByText("Enthusiastic")).toBeInTheDocument();
    expect(screen.getByText("Would Consider")).toBeInTheDocument();
    expect(
      screen.getByText("Not Applicable / Not Interested"),
    ).toBeInTheDocument();

    // "CMPSC     8" appears in test ids as "CMPSC-8", the padding collapsed to one dash.
    for (const course of ["CMPSC-8", "CMPSC-130A", "CMPSC-156"]) {
      expect(radio(course, "ENTHUSIASTIC")).not.toBeChecked();
      expect(radio(course, "WOULD_CONSIDER")).not.toBeChecked();
      expect(radio(course, "NOT_INTERESTED")).toBeChecked();
    }
    // Each course's radios form their own group, named after the row.
    expect(radio("CMPSC-8", "ENTHUSIASTIC")).toHaveAttribute(
      "name",
      "ApplicationForm-courseInterest-CMPSC-8",
    );
    expect(radio("CMPSC-8", "ENTHUSIASTIC")).toHaveAttribute(
      "aria-label",
      "CMPSC     8: Enthusiastic",
    );
  });

  test("the course column keeps its padding", () => {
    renderForm();

    const row = screen.getByTestId("ApplicationForm-courseInterest-CMPSC-8");
    expect(row.firstChild).toHaveStyle({
      fontFamily: "monospace",
      whiteSpace: "pre",
    });
    expect(row.firstChild.textContent).toBe("CMPSC     8");
  });

  test("picking an option is remembered per course", async () => {
    renderForm();

    await userEvent.click(radio("CMPSC-8", "ENTHUSIASTIC"));
    await userEvent.click(radio("CMPSC-130A", "WOULD_CONSIDER"));

    expect(radio("CMPSC-8", "ENTHUSIASTIC")).toBeChecked();
    expect(radio("CMPSC-8", "NOT_INTERESTED")).not.toBeChecked();
    expect(radio("CMPSC-130A", "WOULD_CONSIDER")).toBeChecked();
    expect(radio("CMPSC-156", "NOT_INTERESTED")).toBeChecked();
  });

  /** The two choices are already answered, so their rows say which they are instead of asking. */
  test("the first and second choice rows show their rank in place of the options", async () => {
    renderForm();

    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-firstChoiceCourse"),
      "CMPSC   156",
    );
    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-secondChoiceCourse"),
      "CMPSC   130A",
    );

    expect(
      screen.getByTestId("ApplicationForm-courseInterest-CMPSC-156-choice"),
    ).toHaveTextContent("1st choice");
    expect(
      screen.queryByTestId(
        "ApplicationForm-courseInterest-CMPSC-156-ENTHUSIASTIC",
      ),
    ).toBeNull();
    expect(
      screen.getByTestId("ApplicationForm-courseInterest-CMPSC-130A-choice"),
    ).toHaveTextContent("2nd choice");
    expect(
      screen.queryByTestId(
        "ApplicationForm-courseInterest-CMPSC-130A-NOT_INTERESTED",
      ),
    ).toBeNull();
    // The remaining course is still asked about.
    expect(radio("CMPSC-8", "NOT_INTERESTED")).toBeChecked();
    expect(
      screen.queryByTestId("ApplicationForm-courseInterest-CMPSC-8-choice"),
    ).toBeNull();

    // Changing the first choice gives the old one its options back.
    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-firstChoiceCourse"),
      "CMPSC     8",
    );
    expect(
      screen.getByTestId("ApplicationForm-courseInterest-CMPSC-8-choice"),
    ).toHaveTextContent("1st choice");
    expect(radio("CMPSC-156", "NOT_INTERESTED")).toBeChecked();
  });

  /** A course marked earlier and then made a choice is not reported twice. */
  test("submits only the courses marked, leaving out the defaults and the two choices", async () => {
    const submitAction = renderForm({
      type: "ULA",
      initialContents: {
        priorCoursework: [priorCourseworkFixtures.ucsbCourse],
      },
    });

    await userEvent.type(
      screen.getByTestId("ApplicationForm-firstName"),
      "Ada",
    );
    await userEvent.type(
      screen.getByTestId("ApplicationForm-lastName"),
      "Lovelace",
    );
    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-major"),
      "Computer Science",
    );
    await userEvent.click(radio("CMPSC-8", "ENTHUSIASTIC"));
    await userEvent.click(radio("CMPSC-130A", "WOULD_CONSIDER"));
    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-firstChoiceCourse"),
      "CMPSC   156",
    );
    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-secondChoiceCourse"),
      "CMPSC   130A",
    );

    await fillRequiredUla();
    await userEvent.click(screen.getByTestId("ApplicationForm-submit"));

    await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1));
    expect(submitAction.mock.calls[0][0].courseInterests).toEqual({
      "CMPSC     8": "ENTHUSIASTIC",
    });
  });

  test("pre-fills the interest answers from a previous application", () => {
    renderForm({
      type: "TA",
      courseList: ["CMPSC     8", "CMPSC    16", "CMPSC    24"],
      initialContents: applicationsFixtures.oneTaApplication,
    });

    expect(radio("CMPSC-8", "ENTHUSIASTIC")).toBeChecked();
    expect(radio("CMPSC-16", "WOULD_CONSIDER")).toBeChecked();
    expect(radio("CMPSC-24", "NOT_INTERESTED")).toBeChecked();
  });

  /** An application stored before the table existed may come back with no map at all. */
  test("a previous application with no interest map starts at the defaults", () => {
    renderForm({
      initialContents: {
        ...applicationsFixtures.oneTaApplication,
        courseInterests: null,
      },
    });

    expect(radio("CMPSC-8", "NOT_INTERESTED")).toBeChecked();
  });

  test("with no courses on offer, the table says so", () => {
    renderForm({ courseList: [] });

    expect(
      screen.getByTestId("ApplicationForm-courseInterests-none"),
    ).toHaveTextContent("No courses are listed for this recruitment yet.");
    expect(
      screen.queryByTestId("ApplicationForm-courseInterest-CMPSC-8"),
    ).toBeNull();
  });

  // ---- validation ----

  test("a name, major and first choice course are required", async () => {
    const submitAction = renderForm();

    await userEvent.click(screen.getByTestId("ApplicationForm-submit"));

    expect(
      await screen.findByText("A first name is required."),
    ).toBeInTheDocument();
    expect(screen.getByText("A last name is required.")).toBeInTheDocument();
    expect(screen.getByText("A major is required.")).toBeInTheDocument();
    // The major lives outside react-hook-form, so its flag is set by the form's own check.
    expect(screen.getByTestId("ApplicationForm-major")).toHaveClass(
      "is-invalid",
    );
    expect(
      screen.getByText("A first choice course is required."),
    ).toBeInTheDocument();
    expect(submitAction).not.toHaveBeenCalled();

    // Choosing a major clears the flag.
    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-major"),
      "Statistics",
    );
    expect(screen.getByTestId("ApplicationForm-major")).not.toHaveClass(
      "is-invalid",
    );
  });

  // ---- submitting ----

  test("submits the answers, with the numeric ones as numbers", async () => {
    const submitAction = renderForm({
      type: "ULA",
      initialContents: {
        priorCoursework: [priorCourseworkFixtures.ucsbCourse],
      },
    });

    await userEvent.type(
      screen.getByTestId("ApplicationForm-firstName"),
      "Ada",
    );
    await userEvent.type(
      screen.getByTestId("ApplicationForm-lastName"),
      "Lovelace",
    );
    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-major"),
      "Computer Science",
    );
    await userEvent.type(screen.getByTestId("ApplicationForm-gpaMajor"), "3.9");
    await userEvent.type(
      screen.getByTestId("ApplicationForm-previousServiceAsUla"),
      "2",
    );
    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-firstChoiceCourse"),
      "CMPSC   156",
    );
    await userEvent.click(
      screen.getByTestId("ApplicationForm-availableForLecturesFirstChoice"),
    );
    await fillRequiredUla();

    await userEvent.click(screen.getByTestId("ApplicationForm-submit"));

    await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1));
    const payload = submitAction.mock.calls[0][0];
    expect(payload.firstName).toBe("Ada");
    expect(payload.lastName).toBe("Lovelace");
    expect(payload.major).toBe("Computer Science");
    expect(payload.gpaMajor).toBe(3.9);
    // Unanswered, so null rather than zero.
    expect(payload.gpaOverall).toBeNull();
    expect(payload.previousServiceAsUla).toBe(2);
    expect(payload.firstChoiceCourse).toBe("CMPSC   156");
    expect(payload.secondChoiceCourse).toBe("");
    expect(payload.availableForLecturesFirstChoice).toBe(true);
    expect(payload.availableForDiscussionFirstChoice).toBe(false);
    // Nothing rated, so nothing sent: not even undefined entries for the listed topics.
    expect(payload.topicProficiencies).toStrictEqual({});
  });

  // ---- the major ----

  test("the major dropdown offers the list, then Other", () => {
    renderForm();

    const select = screen.getByTestId("ApplicationForm-major");
    expect([...select.options].map((o) => o.textContent)).toEqual([
      "Choose a major",
      "Computer Engineering",
      "Computer Science",
      "Statistics",
      "Other",
    ]);
    expect(select).toHaveValue("");
    // Nothing is complained about before the applicant has tried to submit.
    expect(select).not.toHaveClass("is-invalid");
    // No free-text box until Other is chosen.
    expect(screen.queryByTestId("ApplicationForm-otherMajor")).toBeNull();
  });

  test("choosing Other asks for the major as text and stores the text", async () => {
    const submitAction = renderForm({
      type: "ULA",
      initialContents: {
        priorCoursework: [priorCourseworkFixtures.ucsbCourse],
      },
    });

    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-major"),
      "Other",
    );
    const other = await screen.findByTestId("ApplicationForm-otherMajor");
    expect(other).toHaveValue("");
    expect(other).toHaveAttribute("id", "ApplicationForm-otherMajor");
    expect(labelNamed("Other major")).toHaveAttribute(
      "for",
      "ApplicationForm-otherMajor",
    );
    await userEvent.type(other, "  History of Art ");

    await userEvent.type(
      screen.getByTestId("ApplicationForm-firstName"),
      "Ada",
    );
    await userEvent.type(
      screen.getByTestId("ApplicationForm-lastName"),
      "Lovelace",
    );
    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-firstChoiceCourse"),
      "CMPSC   156",
    );
    await fillRequiredUla();
    await userEvent.click(screen.getByTestId("ApplicationForm-submit"));

    await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1));
    // The text, trimmed; never the word Other or the sentinel.
    expect(submitAction.mock.calls[0][0].major).toBe("History of Art");
  });

  test("Other with nothing typed is still a missing major", async () => {
    const submitAction = renderForm();

    await userEvent.type(
      screen.getByTestId("ApplicationForm-firstName"),
      "Ada",
    );
    await userEvent.type(
      screen.getByTestId("ApplicationForm-lastName"),
      "Lovelace",
    );
    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-firstChoiceCourse"),
      "CMPSC   156",
    );
    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-major"),
      "Other",
    );
    await userEvent.type(
      screen.getByTestId("ApplicationForm-otherMajor"),
      "  ",
    );
    await userEvent.click(screen.getByTestId("ApplicationForm-submit"));

    await waitFor(() =>
      expect(screen.getByTestId("ApplicationForm-otherMajor")).toHaveClass(
        "is-invalid",
      ),
    );
    expect(screen.getByText("Please enter your major.")).toBeInTheDocument();
    // The dropdown itself is not flagged: Other was a valid choice, the text is what is missing.
    expect(screen.getByTestId("ApplicationForm-major")).not.toHaveClass(
      "is-invalid",
    );
    expect(submitAction).not.toHaveBeenCalled();

    // Typing clears the complaint.
    await userEvent.type(screen.getByTestId("ApplicationForm-otherMajor"), "X");
    expect(screen.getByTestId("ApplicationForm-otherMajor")).not.toHaveClass(
      "is-invalid",
    );
  });

  /** The major's own check runs even when react-hook-form stops the submit for other fields. */
  test("a chosen major is not flagged just because another field is missing", async () => {
    const submitAction = renderForm();

    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-major"),
      "Statistics",
    );
    // No names, so the submit is refused for those.
    await userEvent.click(screen.getByTestId("ApplicationForm-submit"));

    expect(
      await screen.findByText("A first name is required."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("ApplicationForm-major")).not.toHaveClass(
      "is-invalid",
    );
    expect(submitAction).not.toHaveBeenCalled();
  });

  test("an Other major of only spaces is flagged along with the other missing fields", async () => {
    renderForm();

    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-major"),
      "Other",
    );
    await userEvent.type(
      screen.getByTestId("ApplicationForm-otherMajor"),
      "   ",
    );
    await userEvent.click(screen.getByTestId("ApplicationForm-submit"));

    await waitFor(() =>
      expect(screen.getByTestId("ApplicationForm-otherMajor")).toHaveClass(
        "is-invalid",
      ),
    );
  });

  test("switching from Other back to a listed major drops the text", async () => {
    renderForm();

    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-major"),
      "Other",
    );
    await userEvent.type(
      screen.getByTestId("ApplicationForm-otherMajor"),
      "Something",
    );
    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-major"),
      "Statistics",
    );

    expect(screen.getByTestId("ApplicationForm-major")).toHaveValue(
      "Statistics",
    );
    expect(screen.queryByTestId("ApplicationForm-otherMajor")).toBeNull();

    // And choosing Other again starts from a blank box, not the old listed value.
    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-major"),
      "Other",
    );
    expect(screen.getByTestId("ApplicationForm-otherMajor")).toHaveValue("");
  });

  /** A stored major that is on the list is simply selected. */
  test("a previous listed major is pre-selected", () => {
    renderForm({ initialContents: applicationsFixtures.oneTaApplication });

    expect(screen.getByTestId("ApplicationForm-major")).toHaveValue(
      "Computer Science",
    );
    expect(screen.queryByTestId("ApplicationForm-otherMajor")).toBeNull();
  });

  /** A stored major that is not on the list (chosen as Other, or since removed) is kept as text. */
  test("a previous major that is not on the list shows as Other with the text", () => {
    renderForm({
      initialContents: {
        ...applicationsFixtures.oneTaApplication,
        major: "Linguistics",
      },
    });

    expect(screen.getByTestId("ApplicationForm-major")).toHaveValue(
      "__OTHER__",
    );
    expect(screen.getByTestId("ApplicationForm-otherMajor")).toHaveValue(
      "Linguistics",
    );
  });

  test("with no majors listed only Other is offered", () => {
    renderForm({ majorList: [] });

    expect(
      [...screen.getByTestId("ApplicationForm-major").options].map(
        (o) => o.textContent,
      ),
    ).toEqual(["Choose a major", "Other"]);
  });

  test("tolerates non-array majors and topics props", () => {
    renderForm({ majorList: null, topicList: null });

    expect(screen.getByTestId("ApplicationForm-major")).toBeInTheDocument();
    expect(
      screen.getByTestId("ApplicationForm-topicProficiencies-none"),
    ).toBeInTheDocument();
  });

  // ---- topic proficiencies ----

  test("every topic gets radio buttons 1 to 5, none chosen, under the instruction", () => {
    renderForm();

    expect(
      screen.getByText(
        "Choose a level of proficiency, with 1 being the lowest, and 5 being the highest.",
      ),
    ).toBeInTheDocument();
    const group = screen.getByTestId("ApplicationForm-topicProficiencies");
    // The column headings are the levels themselves.
    expect(
      [...group.querySelectorAll("thead th")].map((th) => th.textContent),
    ).toEqual(["Topic", "1", "2", "3", "4", "5"]);
    topics.forEach((topic) => {
      const row = screen.getByTestId(
        `ApplicationForm-topic-${topic.replace(/\s+/g, "-")}`,
      );
      expect(row).toHaveTextContent(topic);
      [1, 2, 3, 4, 5].forEach((level) => {
        const radio = screen.getByTestId(
          `ApplicationForm-topic-${topic}-${level}`,
        );
        expect(radio).toHaveAttribute("type", "radio");
        expect(radio).toHaveAttribute(
          "id",
          `ApplicationForm-topic-${topic}-${level}`,
        );
        expect(radio).toHaveAttribute("aria-label", `${topic}: ${level}`);
        expect(radio).not.toBeChecked();
      });
    });
    expect(
      screen.queryByTestId("ApplicationForm-topicProficiencies-none"),
    ).toBeNull();
  });

  test("a topic with a space in its name still gets a usable row id", () => {
    renderForm({ topicList: ["Web Development"] });

    expect(
      screen.getByTestId("ApplicationForm-topic-Web-Development-3"),
    ).toBeInTheDocument();
  });

  test("picking a level is remembered per topic and sent for rated topics only", async () => {
    const submitAction = renderForm({
      type: "ULA",
      initialContents: {
        priorCoursework: [priorCourseworkFixtures.ucsbCourse],
      },
    });

    // A ULA form offers 1 to 3.
    await userEvent.click(screen.getByTestId("ApplicationForm-topic-Java-3"));
    await userEvent.click(screen.getByTestId("ApplicationForm-topic-Python-2"));
    // Changing an answer replaces it.
    await userEvent.click(screen.getByTestId("ApplicationForm-topic-Python-1"));

    expect(screen.getByTestId("ApplicationForm-topic-Java-3")).toBeChecked();
    expect(screen.getByTestId("ApplicationForm-topic-Python-1")).toBeChecked();
    expect(
      screen.getByTestId("ApplicationForm-topic-Python-2"),
    ).not.toBeChecked();
    expect(
      screen.getByTestId("ApplicationForm-topic-Compilers-3"),
    ).not.toBeChecked();

    await userEvent.type(
      screen.getByTestId("ApplicationForm-firstName"),
      "Ada",
    );
    await userEvent.type(
      screen.getByTestId("ApplicationForm-lastName"),
      "Lovelace",
    );
    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-major"),
      "Statistics",
    );
    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-firstChoiceCourse"),
      "CMPSC   156",
    );
    await fillRequiredUla();
    await userEvent.click(screen.getByTestId("ApplicationForm-submit"));

    await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1));
    // Strict: an unrated topic must be absent, not present as undefined.
    expect(submitAction.mock.calls[0][0].topicProficiencies).toStrictEqual({
      Java: 3,
      Python: 1,
    });
  });

  test("a ULA form heads the topic columns with the worded three-point scale", () => {
    renderForm({ type: "ULA" });

    expect(
      screen.getByText(
        "For each topic, choose 1 if you are very comfortable with it, 2 if somewhat comfortable, or 3 if you are not familiar with it.",
      ),
    ).toBeInTheDocument();
    const group = screen.getByTestId("ApplicationForm-topicProficiencies");
    expect(
      [...group.querySelectorAll("thead th")].map((th) => th.textContent),
    ).toEqual([
      "Topic",
      "1-Very comfortable",
      "2-Somewhat comfortable",
      "3-Not familiar",
    ]);
    [1, 2, 3].forEach((level) =>
      expect(
        screen.getByTestId(`ApplicationForm-topic-Java-${level}`),
      ).toHaveAttribute("aria-label", `Java: ${level}`),
    );
    expect(screen.queryByTestId("ApplicationForm-topic-Java-4")).toBeNull();
    expect(screen.queryByTestId("ApplicationForm-topic-Java-5")).toBeNull();
  });

  // ---- interests (ULA only) ----

  test("a ULA form lists each interest with radio buttons 1 to 5 under the instruction", () => {
    renderForm({ type: "ULA" });

    const group = screen.getByTestId("ApplicationForm-interests");
    expect(group).toHaveTextContent("Interests");
    expect(group).toHaveTextContent(
      "For each area, choose how interested you are, with 1 being not interested and 5 being very interested.",
    );
    expect(
      [...group.querySelectorAll("thead th")].map((th) => th.textContent),
    ).toEqual([
      "Interest",
      "1-Not interested",
      "2",
      "3",
      "4",
      "5-Very interested",
    ]);
    interests.forEach((interest) => {
      const row = screen.getByTestId(
        `ApplicationForm-interest-${interest.replace(/\s+/g, "-")}`,
      );
      expect(row).toHaveTextContent(interest);
      [1, 2, 3, 4, 5].forEach((level) => {
        const radio = screen.getByTestId(
          `ApplicationForm-interest-${interest.replace(/\s+/g, "-")}-${level}`,
        );
        expect(radio).toHaveAttribute("type", "radio");
        expect(radio).toHaveAttribute(
          "id",
          `ApplicationForm-interest-${interest.replace(/\s+/g, "-")}-${level}`,
        );
        expect(radio).toHaveAttribute("aria-label", `${interest}: ${level}`);
        expect(radio).not.toBeChecked();
      });
    });
    expect(screen.queryByTestId("ApplicationForm-interests-none")).toBeNull();
  });

  test("a TA form has no interests section and sends no interests", async () => {
    const submitAction = renderForm({
      type: "TA",
      initialContents: {
        priorCoursework: priorCourseworkFixtures.threeCourses,
        // Even a stored answer is not sent from a TA form.
        interests: { Tutoring: 4 },
      },
    });

    expect(screen.queryByTestId("ApplicationForm-interests")).toBeNull();
    expect(
      screen.queryByTestId("ApplicationForm-interest-Tutoring-4"),
    ).toBeNull();

    await userEvent.type(
      screen.getByTestId("ApplicationForm-firstName"),
      "Ada",
    );
    await userEvent.type(
      screen.getByTestId("ApplicationForm-lastName"),
      "Lovelace",
    );
    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-major"),
      "Statistics",
    );
    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-firstChoiceCourse"),
      "CMPSC   156",
    );
    await userEvent.click(screen.getByTestId("ApplicationForm-submit"));

    await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1));
    expect(submitAction.mock.calls[0][0].interests).toStrictEqual({});
  });

  test("picking an interest level is remembered per area and sent for answered areas only", async () => {
    const submitAction = renderForm({
      type: "ULA",
      initialContents: {
        priorCoursework: [priorCourseworkFixtures.ucsbCourse],
      },
    });

    await userEvent.click(
      screen.getByTestId("ApplicationForm-interest-Tutoring-5"),
    );
    await userEvent.click(
      screen.getByTestId("ApplicationForm-interest-Grading-2"),
    );
    // Changing an answer replaces it.
    await userEvent.click(
      screen.getByTestId("ApplicationForm-interest-Grading-1"),
    );

    expect(
      screen.getByTestId("ApplicationForm-interest-Tutoring-5"),
    ).toBeChecked();
    expect(
      screen.getByTestId("ApplicationForm-interest-Grading-1"),
    ).toBeChecked();
    expect(
      screen.getByTestId("ApplicationForm-interest-Grading-2"),
    ).not.toBeChecked();
    expect(
      screen.getByTestId("ApplicationForm-interest-Office-hours-3"),
    ).not.toBeChecked();

    await userEvent.type(
      screen.getByTestId("ApplicationForm-firstName"),
      "Ada",
    );
    await userEvent.type(
      screen.getByTestId("ApplicationForm-lastName"),
      "Lovelace",
    );
    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-major"),
      "Statistics",
    );
    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-firstChoiceCourse"),
      "CMPSC   156",
    );
    await fillRequiredUla();
    await userEvent.click(screen.getByTestId("ApplicationForm-submit"));

    await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1));
    expect(submitAction.mock.calls[0][0].interests).toStrictEqual({
      Tutoring: 5,
      Grading: 1,
    });
  });

  test("pre-fills the interest levels from a previous ULA application", () => {
    renderForm({
      type: "ULA",
      initialContents: applicationsFixtures.oneUlaApplication,
    });

    // Tutoring: 5 and Grading: 2 are stored.
    expect(
      screen.getByTestId("ApplicationForm-interest-Tutoring-5"),
    ).toBeChecked();
    expect(
      screen.getByTestId("ApplicationForm-interest-Grading-2"),
    ).toBeChecked();
  });

  /** An answer for an area no longer on the list must not ride along invisibly. */
  test("a stored level for an area that is no longer listed is not sent", async () => {
    const submitAction = renderForm({
      type: "ULA",
      interestList: ["Tutoring"],
      initialContents: applicationsFixtures.oneUlaApplication,
    });

    await userEvent.click(screen.getByTestId("ApplicationForm-submit"));

    await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1));
    expect(submitAction.mock.calls[0][0].interests).toStrictEqual({
      Tutoring: 5,
    });
  });

  test("a previous ULA application with no interest answers starts unanswered", () => {
    renderForm({
      type: "ULA",
      initialContents: {
        ...applicationsFixtures.oneUlaApplication,
        interests: null,
      },
    });

    [1, 2, 3, 4, 5].forEach((level) =>
      expect(
        screen.getByTestId(`ApplicationForm-interest-Tutoring-${level}`),
      ).not.toBeChecked(),
    );
  });

  test("with no interests listed, the ULA table says so; non-array interests are tolerated", () => {
    renderForm({ type: "ULA", interestList: [] });
    expect(
      screen.getByTestId("ApplicationForm-interests-none"),
    ).toHaveTextContent("No interests are listed yet.");
    cleanup();

    renderForm({ type: "ULA", interestList: null });
    expect(
      screen.getByTestId("ApplicationForm-interests-none"),
    ).toBeInTheDocument();
  });

  test("pre-fills the ratings from a previous application", () => {
    renderForm({ initialContents: applicationsFixtures.oneTaApplication });

    // Java: 5 and React: 3 are stored; React is not on this list, so it is not shown.
    expect(screen.getByTestId("ApplicationForm-topic-Java-5")).toBeChecked();
    expect(screen.queryByTestId("ApplicationForm-topic-React-3")).toBeNull();
  });

  /** A rating for a topic no longer on the list must not ride along invisibly. */
  test("a stored rating for a topic that is no longer listed is not sent", async () => {
    const submitAction = renderForm({
      initialContents: applicationsFixtures.oneTaApplication,
    });

    await userEvent.click(screen.getByTestId("ApplicationForm-submit"));

    await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1));
    expect(submitAction.mock.calls[0][0].topicProficiencies).toStrictEqual({
      Java: 5,
    });
  });

  test("a previous application with no ratings starts unrated", () => {
    renderForm({
      initialContents: {
        ...applicationsFixtures.oneTaApplication,
        topicProficiencies: null,
      },
    });

    [1, 2, 3, 4, 5].forEach((level) =>
      expect(
        screen.getByTestId(`ApplicationForm-topic-Java-${level}`),
      ).not.toBeChecked(),
    );
  });

  test("with no topics listed, the table says so", () => {
    renderForm({ topicList: [] });

    expect(
      screen.getByTestId("ApplicationForm-topicProficiencies-none"),
    ).toHaveTextContent("No topics are listed yet.");
  });

  // ---- prior coursework ----

  /** Three courses, so a TA form's submit can get past the coursework rule. */
  const threeCourses = {
    priorCoursework: priorCourseworkFixtures.threeCourses,
  };

  test("the free-text coursework questions are gone; the coursework table is there", () => {
    renderForm({ type: "TA" });

    expect(screen.queryByText(/Relevant Coursework/)).toBeNull();
    expect(screen.queryByText("290-Level Coursework")).toBeNull();
    expect(
      screen.getByTestId("ApplicationForm-coursework"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("ApplicationForm-coursework-instructions"),
    ).toHaveTextContent("TA applicants must list at least 3 courses");
    expect(
      screen.getByTestId("ApplicationForm-coursework-empty"),
    ).toBeInTheDocument();
  });

  test("a ULA form shows the ULA instruction and needs one course", () => {
    renderForm({ type: "ULA" });
    expect(
      screen.getByTestId("ApplicationForm-coursework-instructions"),
    ).toHaveTextContent("at least one course");
    expect(
      screen.getByTestId("ApplicationForm-coursework-count"),
    ).toHaveTextContent("0 of at least 1 listed");
  });

  test("a TA application with fewer than three courses is not submitted", async () => {
    const submitAction = renderForm({
      type: "TA",
      initialContents: {
        priorCoursework: priorCourseworkFixtures.threeCourses.slice(0, 2),
      },
    });
    await fillRequired();

    await userEvent.click(screen.getByTestId("ApplicationForm-submit"));

    expect(
      await screen.findByTestId("ApplicationForm-coursework-too-few"),
    ).toHaveTextContent("Please list at least 3 courses.");
    expect(submitAction).not.toHaveBeenCalled();
  });

  /** The flag is raised alongside the others when react-hook-form refuses the submit. */
  test("too few courses is flagged alongside other missing fields", async () => {
    renderForm({ type: "TA" });
    await userEvent.click(screen.getByTestId("ApplicationForm-submit"));

    expect(
      await screen.findByTestId("ApplicationForm-coursework-too-few"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("ApplicationForm-major")).toHaveClass(
      "is-invalid",
    );
  });

  test("enough courses are not flagged when only other fields are missing", async () => {
    renderForm({ type: "TA", initialContents: threeCourses });
    await userEvent.click(screen.getByTestId("ApplicationForm-submit"));

    await waitFor(() =>
      expect(screen.getByTestId("ApplicationForm-major")).toHaveClass(
        "is-invalid",
      ),
    );
    expect(
      screen.queryByTestId("ApplicationForm-coursework-too-few"),
    ).toBeNull();
  });

  test("adding the missing course through the modal clears the flag and the courses are submitted", async () => {
    const submitAction = renderForm({
      type: "TA",
      initialContents: {
        priorCoursework: priorCourseworkFixtures.threeCourses.slice(0, 2),
      },
    });
    await fillRequired();
    await userEvent.click(screen.getByTestId("ApplicationForm-submit"));
    await screen.findByTestId("ApplicationForm-coursework-too-few");

    await userEvent.click(
      screen.getByTestId("ApplicationForm-coursework-add-button"),
    );
    await userEvent.click(
      screen.getByTestId("ApplicationForm-coursework-modal-ucsbCourse"),
    );
    await userEvent.type(
      screen.getByTestId("ApplicationForm-coursework-modal-otherSchool"),
      "UCLA",
    );
    await userEvent.type(
      screen.getByTestId("ApplicationForm-coursework-modal-courseNumber"),
      "CS 31",
    );
    await userEvent.click(
      screen.getByTestId("ApplicationForm-coursework-modal-save"),
    );

    await waitFor(() =>
      expect(
        screen.queryByTestId("ApplicationForm-coursework-too-few"),
      ).toBeNull(),
    );
    expect(
      screen.getByTestId("ApplicationForm-coursework-count"),
    ).toHaveTextContent("3 of at least 3 listed");

    await userEvent.click(screen.getByTestId("ApplicationForm-submit"));
    await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1));
    expect(submitAction.mock.calls[0][0].priorCoursework).toEqual([
      priorCourseworkFixtures.ucsbCourse,
      priorCourseworkFixtures.inProgress,
      {
        ucsbCourse: false,
        otherSchool: "UCLA",
        courseNumber: "CS 31",
        courseTitle: null,
        term: null,
        grade: null,
      },
    ]);
  });

  test("deleting a course from the table is reflected in what is submitted", async () => {
    const submitAction = renderForm({
      type: "ULA",
      initialContents: threeCourses,
    });
    await fillRequired();

    await userEvent.click(
      screen.getByTestId(
        "ApplicationForm-coursework-table-cell-row-0-col-delete-button",
      ),
    );
    await userEvent.click(screen.getByTestId("ApplicationForm-submit"));

    await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1));
    expect(submitAction.mock.calls[0][0].priorCoursework).toEqual([
      priorCourseworkFixtures.inProgress,
      priorCourseworkFixtures.elsewhere,
    ]);
  });

  test("pre-fills the course table from a previous application", () => {
    renderForm({ initialContents: applicationsFixtures.oneTaApplication });
    expect(
      screen.getByTestId(
        "ApplicationForm-coursework-table-cell-row-2-col-school",
      ),
    ).toHaveTextContent("Another University");
  });

  test("a previous application with no course list starts empty", () => {
    renderForm({
      initialContents: {
        ...applicationsFixtures.oneTaApplication,
        priorCoursework: undefined,
      },
    });
    expect(
      screen.getByTestId("ApplicationForm-coursework-empty"),
    ).toBeInTheDocument();
  });

  // ---- notices, terms and conditions ----

  test("without a notice there is no agreement section and nothing is required", async () => {
    const submitAction = renderForm({ initialContents: threeCourses });
    expect(screen.queryByTestId("ApplicationForm-notice")).toBeNull();

    await fillRequired();
    await userEvent.click(screen.getByTestId("ApplicationForm-submit"));

    await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1));
    expect(submitAction.mock.calls[0][0].noticeVersionId).toBeNull();
  });

  test("with a notice the box must be ticked before submitting", async () => {
    const submitAction = renderForm({
      notice: noticesFixtures.taV2,
      initialContents: threeCourses,
    });

    const card = screen.getByTestId("ApplicationForm-notice");
    expect(card.querySelector("h1")).toHaveTextContent("TA Terms");
    const box = screen.getByTestId("ApplicationForm-notice-agree");
    expect(box).not.toBeChecked();
    expect(box).not.toHaveClass("is-invalid");

    await fillRequired();
    await userEvent.click(screen.getByTestId("ApplicationForm-submit"));

    await waitFor(() => expect(box).toHaveClass("is-invalid"));
    expect(submitAction).not.toHaveBeenCalled();

    // Ticking clears the complaint and the submission carries the version agreed to.
    await userEvent.click(box);
    expect(box).toBeChecked();
    expect(box).not.toHaveClass("is-invalid");
    await userEvent.click(screen.getByTestId("ApplicationForm-submit"));

    await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1));
    expect(submitAction.mock.calls[0][0].noticeVersionId).toBe(2);
  });

  /** When react-hook-form refuses the submit for other fields, the box is still flagged. */
  test("an unticked box is flagged alongside other missing fields", async () => {
    renderForm({ notice: noticesFixtures.taV2 });

    await userEvent.click(screen.getByTestId("ApplicationForm-submit"));

    await waitFor(() =>
      expect(screen.getByTestId("ApplicationForm-notice-agree")).toHaveClass(
        "is-invalid",
      ),
    );
    expect(screen.getByTestId("ApplicationForm-major")).toHaveClass(
      "is-invalid",
    );
  });

  /** A ticked box is not flagged when only other fields are missing. */
  test("a ticked box is not flagged when other fields are missing", async () => {
    renderForm({ notice: noticesFixtures.taV2 });
    const box = screen.getByTestId("ApplicationForm-notice-agree");
    await userEvent.click(box);

    await userEvent.click(screen.getByTestId("ApplicationForm-submit"));

    await waitFor(() =>
      expect(screen.getByTestId("ApplicationForm-major")).toHaveClass(
        "is-invalid",
      ),
    );
    expect(box).toBeChecked();
    expect(box).not.toHaveClass("is-invalid");
  });

  test("unticking the box after ticking it blocks the submit again", async () => {
    const submitAction = renderForm({
      notice: noticesFixtures.taV2,
      initialContents: threeCourses,
    });
    await fillRequired();
    const box = screen.getByTestId("ApplicationForm-notice-agree");
    await userEvent.click(box);
    await userEvent.click(box);
    expect(box).not.toBeChecked();

    await userEvent.click(screen.getByTestId("ApplicationForm-submit"));

    await waitFor(() => expect(box).toHaveClass("is-invalid"));
    expect(submitAction).not.toHaveBeenCalled();
  });

  /** Editing an application that agreed to this very version starts ticked. */
  test("an application that already agreed to the shown version starts ticked and submits", async () => {
    const submitAction = renderForm({
      initialContents: applicationsFixtures.oneTaApplication, // noticeVersionId: 1
      notice: noticesFixtures.taV1,
    });
    const box = screen.getByTestId("ApplicationForm-notice-agree");
    expect(box).toBeChecked();
    expect(box).not.toHaveClass("is-invalid");

    await userEvent.click(screen.getByTestId("ApplicationForm-submit"));

    await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1));
    expect(submitAction.mock.calls[0][0].noticeVersionId).toBe(1);
  });

  /** A different version is a different text, so agreement to it is not assumed. */
  test("an application that agreed to another version starts unticked", () => {
    renderForm({
      initialContents: applicationsFixtures.oneTaApplication, // noticeVersionId: 1
      notice: noticesFixtures.taV2,
    });
    expect(
      screen.getByTestId("ApplicationForm-notice-agree"),
    ).not.toBeChecked();
  });

  /** An application from before any notice: nothing recorded, so unticked. */
  test("an application with no recorded version starts unticked", () => {
    renderForm({
      initialContents: {
        ...applicationsFixtures.oneTaApplication,
        noticeVersionId: null,
      },
      notice: noticesFixtures.taV1,
    });
    expect(
      screen.getByTestId("ApplicationForm-notice-agree"),
    ).not.toBeChecked();
  });

  // ---- pre-filling ----

  test("pre-fills from a previous application", () => {
    renderForm({
      type: "TA",
      initialContents: applicationsFixtures.oneTaApplication,
    });

    expect(screen.getByTestId("ApplicationForm-firstName")).toHaveValue("Ada");
    expect(screen.getByTestId("ApplicationForm-middleName")).toHaveValue("M");
    expect(screen.getByTestId("ApplicationForm-lastName")).toHaveValue(
      "Lovelace",
    );
    expect(screen.getByTestId("ApplicationForm-gpaMajor")).toHaveValue(3.9);
    expect(screen.getByTestId("ApplicationForm-classLevel")).toHaveValue("PHD");
    expect(screen.getByTestId("ApplicationForm-residencyStatus")).toHaveValue(
      "F1_STUDENT_VISA",
    );
    expect(screen.getByTestId("ApplicationForm-languageExam")).toHaveValue(
      "PASSED_F1_OR_J1_VISA",
    );
    expect(
      screen.getByTestId("ApplicationForm-languageExamDatePassed"),
    ).toHaveValue("F25");
    expect(
      screen.getByTestId("ApplicationForm-availableForLecturesFirstChoice"),
    ).toBeChecked();
    expect(
      screen.getByTestId("ApplicationForm-availableForLecturesSecondChoice"),
    ).not.toBeChecked();
  });

  /** Nulls in a stored application must not surface as the string "null". */
  test("pre-filling turns nulls into blanks", () => {
    renderForm({
      type: "ULA",
      initialContents: applicationsFixtures.oneUlaApplication,
    });

    expect(screen.getByTestId("ApplicationForm-middleName")).toHaveValue("");
    expect(screen.getByTestId("ApplicationForm-videoLink")).toHaveValue(
      "https://example.org/chris",
    );
    expect(
      screen.getByTestId("ApplicationForm-previousServiceAsUla"),
    ).toHaveValue(2);
  });

  // ---- names from the Google account ----

  /** Better than an empty box when there is no previous application to copy from. */
  test("falls back to the signed-in account's names", () => {
    renderForm({ defaultNames: { firstName: "Chris", lastName: "Gaucho" } });

    expect(screen.getByTestId("ApplicationForm-firstName")).toHaveValue(
      "Chris",
    );
    expect(screen.getByTestId("ApplicationForm-lastName")).toHaveValue(
      "Gaucho",
    );
    // Google has no middle name to offer.
    expect(screen.getByTestId("ApplicationForm-middleName")).toHaveValue("");
  });

  /** A previous application is the better answer, so it wins. */
  test("a previous application's names beat the account's", () => {
    renderForm({
      initialContents: applicationsFixtures.oneTaApplication,
      defaultNames: { firstName: "Chris", lastName: "Gaucho" },
    });

    expect(screen.getByTestId("ApplicationForm-firstName")).toHaveValue("Ada");
    expect(screen.getByTestId("ApplicationForm-lastName")).toHaveValue(
      "Lovelace",
    );
  });

  test("the fallback fills only the name that is actually blank", () => {
    renderForm({
      initialContents: { firstName: "", lastName: "Lovelace" },
      defaultNames: { firstName: "Chris", lastName: "Gaucho" },
    });

    expect(screen.getByTestId("ApplicationForm-firstName")).toHaveValue(
      "Chris",
    );
    expect(screen.getByTestId("ApplicationForm-lastName")).toHaveValue(
      "Lovelace",
    );
  });

  /** A Google account may carry neither name, which is no worse than before. */
  test("an account with no names leaves the fields empty", () => {
    renderForm({ defaultNames: { firstName: null, lastName: undefined } });

    expect(screen.getByTestId("ApplicationForm-firstName")).toHaveValue("");
    expect(screen.getByTestId("ApplicationForm-lastName")).toHaveValue("");
  });

  test("with no previous application every field starts empty", () => {
    renderForm();

    expect(screen.getByTestId("ApplicationForm-firstName")).toHaveValue("");
    expect(screen.getByTestId("ApplicationForm-gpaMajor")).toHaveValue(null);
    expect(
      screen.getByTestId("ApplicationForm-availableForLecturesFirstChoice"),
    ).not.toBeChecked();
  });

  // ---- the ULA questions from the Google Form (issue #72) ----

  describe("the ULA questions from the Google Form", () => {
    test("a ULA form asks them, with the form's guidance, and marks the required ones", () => {
      renderForm({ type: "ULA" });

      for (const name of [
        "permNumber",
        "bsMsStudent",
        "otherCampusJob",
        "priorUcsbEmployment",
        "i9Appointment",
        "changingMajor",
      ]) {
        expect(
          screen.getByTestId(`ApplicationForm-${name}`),
        ).toBeInTheDocument();
      }
      for (const label of [
        "Perm Number",
        "BS/MS student?",
        "Other campus job this quarter?",
        "Prior UCSB employment?",
      ]) {
        expect(labelNamed(label).textContent).toMatch(/\*\s*$/);
      }
      expect(
        labelNamed("I-9 appointment made or planned?").textContent,
      ).not.toMatch(/\*/);
      expect(
        screen.getByTestId("ApplicationForm-graduationDate-note"),
      ).toHaveTextContent("you are not eligible to serve as a ULA");
      expect(
        screen.getByTestId("ApplicationForm-videoLink-note"),
      ).toHaveTextContent(
        "For returning ULAs it is optional but strongly encouraged",
      );
      expect(
        screen.getByTestId("ApplicationForm-course-preferences-guidance"),
      ).toHaveTextContent("with a B or better");
      expect(screen.getByText("BS/MS program")).toBeInTheDocument();
      expect(screen.getByText("Prior employment")).toBeInTheDocument();
      expect(screen.getByTestId("ApplicationForm-bs-ms")).toBeInTheDocument();
      expect(
        screen.getByTestId("ApplicationForm-employment"),
      ).toBeInTheDocument();
      // Each select starts on a blank "Choose one".
      for (const name of [
        "bsMsStudent",
        "otherCampusJob",
        "priorUcsbEmployment",
        "i9Appointment",
        "changingMajor",
      ]) {
        const select = screen.getByTestId(`ApplicationForm-${name}`);
        expect(select.options[0].value).toBe("");
        expect(select.options[0].textContent).toBe("Choose one");
      }
      expect(
        screen.getByText(
          "Your answers here do not affect the decision on your application; they let us start the hiring paperwork sooner if you are offered a position.",
        ),
      ).toBeInTheDocument();
      // The follow-ups wait for the answers that reveal them.
      expect(
        screen.queryByTestId("ApplicationForm-studentStatusNextQuarter"),
      ).toBeNull();
      expect(
        screen.queryByTestId("ApplicationForm-wantsTaEligibility"),
      ).toBeNull();
      expect(screen.queryByTestId("ApplicationForm-employeeId")).toBeNull();
      expect(screen.queryByTestId("ApplicationForm-training")).toBeNull();
    });

    test("the perm number is required and must be seven letters or digits", async () => {
      const submitAction = renderForm({
        type: "ULA",
        initialContents: {
          priorCoursework: [priorCourseworkFixtures.ucsbCourse],
        },
      });
      await fillRequired();
      await userEvent.clear(screen.getByTestId("ApplicationForm-permNumber"));

      await userEvent.click(screen.getByTestId("ApplicationForm-submit"));
      expect(
        await screen.findByText("Your perm number is required."),
      ).toBeInTheDocument();
      expect(screen.getByTestId("ApplicationForm-permNumber")).toHaveClass(
        "is-invalid",
      );

      await userEvent.type(
        screen.getByTestId("ApplicationForm-permNumber"),
        "12-4567",
      );
      await userEvent.click(screen.getByTestId("ApplicationForm-submit"));
      expect(
        await screen.findByText(
          "Exactly 7 characters, letters and digits only.",
        ),
      ).toBeInTheDocument();
      expect(submitAction).not.toHaveBeenCalled();

      await userEvent.clear(screen.getByTestId("ApplicationForm-permNumber"));
      await userEvent.type(
        screen.getByTestId("ApplicationForm-permNumber"),
        "a1b2c3d",
      );
      await userEvent.click(screen.getByTestId("ApplicationForm-submit"));
      await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1));
      // Sent as typed; the backend upper-cases it.
      expect(submitAction.mock.calls[0][0].permNumber).toBe("a1b2c3d");
    });

    test("the BS/MS and employment questions are required", async () => {
      const submitAction = renderForm({
        type: "ULA",
        initialContents: {
          priorCoursework: [priorCourseworkFixtures.ucsbCourse],
        },
      });
      await fillRequired();
      await userEvent.selectOptions(
        screen.getByTestId("ApplicationForm-bsMsStudent"),
        "",
      );
      await userEvent.selectOptions(
        screen.getByTestId("ApplicationForm-otherCampusJob"),
        "",
      );
      await userEvent.selectOptions(
        screen.getByTestId("ApplicationForm-priorUcsbEmployment"),
        "",
      );

      await userEvent.click(screen.getByTestId("ApplicationForm-submit"));

      expect(
        await screen.findByText("Please say whether you are a BS/MS student."),
      ).toBeInTheDocument();
      expect(screen.getByTestId("ApplicationForm-bsMsStudent")).toHaveClass(
        "is-invalid",
      );
      expect(screen.getByTestId("ApplicationForm-otherCampusJob")).toHaveClass(
        "is-invalid",
      );
      expect(
        screen.getByTestId("ApplicationForm-priorUcsbEmployment"),
      ).toHaveClass("is-invalid");
      expect(submitAction).not.toHaveBeenCalled();
    });

    test("saying yes to BS/MS asks the two follow-ups, and graduate status warns", async () => {
      renderForm({ type: "ULA" });

      await userEvent.selectOptions(
        screen.getByTestId("ApplicationForm-bsMsStudent"),
        "true",
      );
      const status = screen.getByTestId(
        "ApplicationForm-studentStatusNextQuarter",
      );
      expect(status).toBeInTheDocument();
      expect(
        screen.getByTestId("ApplicationForm-wantsTaEligibility"),
      ).toBeInTheDocument();
      // The follow-ups' labels are wired to their selects.
      expect(status).toHaveAttribute(
        "id",
        "ApplicationForm-studentStatusNextQuarter",
      );
      expect(
        labelNamed("Student status in the quarter you are applying for"),
      ).toHaveAttribute("for", "ApplicationForm-studentStatusNextQuarter");
      expect(
        screen.getByTestId("ApplicationForm-wantsTaEligibility"),
      ).toHaveAttribute("id", "ApplicationForm-wantsTaEligibility");
      expect(
        labelNamed("TA eligibility and the Fall TA training"),
      ).toHaveAttribute("for", "ApplicationForm-wantsTaEligibility");
      expect(
        screen.getByText(
          /Do you want to be eligible for TA positions in the future, and if so, will you enroll in the TA training course the next time it is offered in Fall\?/,
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /You will not be eligible for TA positions unless and until/,
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("ApplicationForm-graduate-warning"),
      ).toBeNull();

      await userEvent.selectOptions(status, "GRADUATE");
      expect(
        screen.getByTestId("ApplicationForm-graduate-warning"),
      ).toHaveTextContent("strongly encouraged to apply to be a TA instead");
      await userEvent.selectOptions(status, "UNDERGRADUATE");
      expect(
        screen.queryByTestId("ApplicationForm-graduate-warning"),
      ).toBeNull();

      await userEvent.selectOptions(
        screen.getByTestId("ApplicationForm-bsMsStudent"),
        "false",
      );
      expect(
        screen.queryByTestId("ApplicationForm-studentStatusNextQuarter"),
      ).toBeNull();
      expect(
        screen.queryByTestId("ApplicationForm-wantsTaEligibility"),
      ).toBeNull();
    });

    test("prior UCSB employment asks for the employee ID, with the UCPath caution", async () => {
      renderForm({ type: "ULA" });

      await userEvent.selectOptions(
        screen.getByTestId("ApplicationForm-priorUcsbEmployment"),
        "true",
      );
      expect(
        screen.getByTestId("ApplicationForm-employeeId"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/It is NOT your perm number and NOT your SSN/),
      ).toBeInTheDocument();
      expect(labelNamed("Employee ID number")).toHaveAttribute(
        "for",
        "ApplicationForm-employeeId",
      );
      expect(screen.getByTestId("ApplicationForm-employeeId")).toHaveAttribute(
        "id",
        "ApplicationForm-employeeId",
      );

      await userEvent.selectOptions(
        screen.getByTestId("ApplicationForm-priorUcsbEmployment"),
        "false",
      );
      expect(screen.queryByTestId("ApplicationForm-employeeId")).toBeNull();
    });

    test("a first-time applicant must answer the training commitment, explaining unsure or cannot", async () => {
      const submitAction = renderForm({
        type: "ULA",
        initialContents: {
          priorCoursework: [priorCourseworkFixtures.ucsbCourse],
        },
      });
      await fillRequired();
      expect(screen.queryByTestId("ApplicationForm-training")).toBeNull();

      await userEvent.type(
        screen.getByTestId("ApplicationForm-previousServiceAsUla"),
        "0",
      );
      expect(
        screen.getByTestId("ApplicationForm-training-statement"),
      ).toHaveTextContent("five mandatory training sessions");
      expect(
        screen.getByTestId("ApplicationForm-training"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("ApplicationForm-trainingCommitment"),
      ).toHaveAttribute("id", "ApplicationForm-trainingCommitment");
      expect(labelNamed("Your commitment")).toHaveAttribute(
        "for",
        "ApplicationForm-trainingCommitment",
      );
      expect(labelNamed("Your commitment").textContent).toMatch(/\*\s*$/);
      expect(
        screen.queryByTestId("ApplicationForm-trainingCommitmentExplanation"),
      ).toBeNull();

      await userEvent.click(screen.getByTestId("ApplicationForm-submit"));
      expect(
        await screen.findByText(
          "As a first-time ULA applicant, please answer this question.",
        ),
      ).toBeInTheDocument();
      expect(submitAction).not.toHaveBeenCalled();

      const commitment = screen.getByTestId(
        "ApplicationForm-trainingCommitment",
      );
      await userEvent.selectOptions(commitment, "AGREE");
      expect(
        screen.queryByTestId("ApplicationForm-trainingCommitmentExplanation"),
      ).toBeNull();
      await userEvent.selectOptions(commitment, "CANNOT");
      expect(
        screen.getByTestId("ApplicationForm-trainingCommitmentExplanation"),
      ).toHaveAttribute("id", "ApplicationForm-trainingCommitmentExplanation");
      expect(labelNamed("Please explain")).toHaveAttribute(
        "for",
        "ApplicationForm-trainingCommitmentExplanation",
      );
      await userEvent.type(
        screen.getByTestId("ApplicationForm-trainingCommitmentExplanation"),
        "Friday lab",
      );
      await userEvent.selectOptions(commitment, "UNSURE");
      expect(
        screen.getByTestId("ApplicationForm-trainingCommitmentExplanation"),
      ).toHaveValue("Friday lab");

      await userEvent.click(screen.getByTestId("ApplicationForm-submit"));
      await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1));
      const payload = submitAction.mock.calls[0][0];
      expect(payload.previousServiceAsUla).toBe(0);
      expect(payload.trainingCommitment).toBe("UNSURE");
      expect(payload.trainingCommitmentExplanation).toBe("Friday lab");
    });

    test("a returning applicant is not asked about the training", async () => {
      renderForm({ type: "ULA" });
      await userEvent.type(
        screen.getByTestId("ApplicationForm-previousServiceAsUla"),
        "2",
      );
      expect(screen.queryByTestId("ApplicationForm-training")).toBeNull();
    });

    test("submits the ULA answers as booleans and codes", async () => {
      const submitAction = renderForm({
        type: "ULA",
        initialContents: {
          priorCoursework: [priorCourseworkFixtures.ucsbCourse],
        },
      });
      await fillRequired();
      await userEvent.selectOptions(
        screen.getByTestId("ApplicationForm-bsMsStudent"),
        "true",
      );
      await userEvent.selectOptions(
        screen.getByTestId("ApplicationForm-studentStatusNextQuarter"),
        "UNDERGRADUATE",
      );
      await userEvent.selectOptions(
        screen.getByTestId("ApplicationForm-wantsTaEligibility"),
        "true",
      );
      await userEvent.selectOptions(
        screen.getByTestId("ApplicationForm-otherCampusJob"),
        "NOT_SURE",
      );
      await userEvent.selectOptions(
        screen.getByTestId("ApplicationForm-priorUcsbEmployment"),
        "true",
      );
      await userEvent.type(
        screen.getByTestId("ApplicationForm-employeeId"),
        "1234567",
      );
      await userEvent.selectOptions(
        screen.getByTestId("ApplicationForm-i9Appointment"),
        "false",
      );
      await userEvent.selectOptions(
        screen.getByTestId("ApplicationForm-changingMajor"),
        "true",
      );

      await userEvent.click(screen.getByTestId("ApplicationForm-submit"));

      await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1));
      const payload = submitAction.mock.calls[0][0];
      expect(payload.permNumber).toBe("1234567");
      expect(payload.bsMsStudent).toBe(true);
      expect(payload.studentStatusNextQuarter).toBe("UNDERGRADUATE");
      expect(payload.wantsTaEligibility).toBe(true);
      expect(payload.otherCampusJob).toBe("NOT_SURE");
      expect(payload.priorUcsbEmployment).toBe(true);
      expect(payload.employeeId).toBe("1234567");
      expect(payload.i9Appointment).toBe(false);
      expect(payload.trainingCommitment).toBeNull();
      expect(payload.changingMajor).toBe(true);
    });

    test("pre-fills the ULA answers from a previous application, with nulls blank", () => {
      renderForm({
        type: "ULA",
        initialContents: {
          ...applicationsFixtures.oneUlaApplication,
          i9Appointment: null,
          changingMajor: null,
        },
      });

      expect(screen.getByTestId("ApplicationForm-permNumber")).toHaveValue(
        "A1B2C3D",
      );
      expect(screen.getByTestId("ApplicationForm-bsMsStudent")).toHaveValue(
        "true",
      );
      expect(
        screen.getByTestId("ApplicationForm-studentStatusNextQuarter"),
      ).toHaveValue("UNDERGRADUATE");
      expect(
        screen.getByTestId("ApplicationForm-wantsTaEligibility"),
      ).toHaveValue("true");
      expect(screen.getByTestId("ApplicationForm-otherCampusJob")).toHaveValue(
        "NOT_SURE",
      );
      expect(
        screen.getByTestId("ApplicationForm-priorUcsbEmployment"),
      ).toHaveValue("true");
      expect(screen.getByTestId("ApplicationForm-employeeId")).toHaveValue(
        "1234567",
      );
      expect(screen.getByTestId("ApplicationForm-i9Appointment")).toHaveValue(
        "",
      );
      expect(screen.getByTestId("ApplicationForm-changingMajor")).toHaveValue(
        "",
      );
    });
  });

  // ---- the notice comes first (issue #77) ----

  test("the notice is shown at the top of the form, before About you and far above Submit", () => {
    renderForm({ notice: noticesFixtures.taV1 });

    const notice = screen.getByTestId("ApplicationForm-notice");
    const aboutYou = screen.getByText("About you");
    const firstName = screen.getByTestId("ApplicationForm-firstName");
    const submit = screen.getByTestId("ApplicationForm-submit");
    expect(
      notice.compareDocumentPosition(aboutYou) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      notice.compareDocumentPosition(firstName) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      notice.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // And still after the required-field explanation that opens the form.
    expect(
      screen
        .getByText(/required/i, { selector: "p *" })
        .compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
