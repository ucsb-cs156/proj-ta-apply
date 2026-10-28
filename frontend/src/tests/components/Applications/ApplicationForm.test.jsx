import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";

import ApplicationForm from "main/components/Applications/ApplicationForm";
import applicationsFixtures from "fixtures/applicationsFixtures";

const courses = ["CMPSC     8", "CMPSC   130A", "CMPSC   156"];
const majors = ["Computer Engineering", "Computer Science", "Statistics"];
const topics = ["Compilers", "Java", "Python"];

function renderForm({
  type = "TA",
  initialContents = undefined,
  defaultNames = undefined,
  submitAction = vi.fn(),
  buttonLabel = undefined,
  courseList = courses,
  majorList = majors,
  topicList = topics,
} = {}) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ApplicationForm
          type={type}
          courses={courseList}
          majors={majorList}
          topics={topicList}
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

describe("ApplicationForm tests", () => {
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
      "Relevant Coursework at UCSB",
      "Topic Proficiency",
      "First Choice Course",
      "Second Choice Course",
      "Other Courses You Would Like to Be Considered For",
      "Anything Else",
    ].forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());
  });

  /** Every label points at its control, so clicking a label focuses the right box. */
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
      ["Language Exam", "languageExam"],
      ["Date Passed", "languageExamDatePassed"],
      ["Relevant Coursework at UCSB", "courseworkUcsb"],
      ["Relevant Coursework Elsewhere", "courseworkOther"],
      ["290-Level Coursework", "coursework290"],
      ["Previous Teaching Experience", "prevExperience"],
      ["First Choice Course", "firstChoiceCourse"],
      ["Second Choice Course", "secondChoiceCourse"],
      ["Anything Else", "comments"],
    ];
    wired.forEach(([label, name]) => {
      const control = screen.getByTestId(`ApplicationForm-${name}`);
      expect(control).toHaveAttribute("id", `ApplicationForm-${name}`);
      expect(screen.getByText(label)).toHaveAttribute(
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
    ].forEach(([label, name]) => {
      expect(screen.getByTestId(`ApplicationForm-${name}`)).toHaveAttribute(
        "id",
        `ApplicationForm-${name}`,
      );
      expect(screen.getByText(label)).toHaveAttribute(
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
    expect(screen.getByText("Class Level")).toHaveAttribute(
      "for",
      "ApplicationForm-classLevel",
    );
    expect(
      screen.getByTestId("ApplicationForm-classLevel"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("ApplicationForm-residencyStatus"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("ApplicationForm-courseworkOther"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("ApplicationForm-coursework290"),
    ).toBeInTheDocument();

    expect(screen.queryByTestId("ApplicationForm-videoLink")).toBeNull();
    expect(
      screen.queryByTestId("ApplicationForm-previousServiceAsUla"),
    ).toBeNull();
  });

  test("a ULA application asks the ULA-only questions and not the TA ones", () => {
    renderForm({ type: "ULA" });

    expect(screen.getByTestId("ApplicationForm-videoLink")).toBeInTheDocument();
    expect(
      screen.getByTestId("ApplicationForm-previousServiceAsUla"),
    ).toBeInTheDocument();

    expect(screen.queryByTestId("ApplicationForm-classLevel")).toBeNull();
    expect(screen.queryByTestId("ApplicationForm-residencyStatus")).toBeNull();
    expect(screen.queryByTestId("ApplicationForm-courseworkOther")).toBeNull();
    expect(screen.queryByTestId("ApplicationForm-coursework290")).toBeNull();
    expect(screen.queryByTestId("ApplicationForm-languageExam")).toBeNull();
  });

  /** Only F1 and J1 holders take the exam, so nobody else is asked about it. */
  test("the language exam questions appear only for a visa holder", async () => {
    renderForm({ type: "TA" });

    expect(screen.queryByTestId("ApplicationForm-languageExam")).toBeNull();

    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-residencyStatus"),
      "US_CITIZEN",
    );
    expect(screen.queryByTestId("ApplicationForm-languageExam")).toBeNull();

    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-residencyStatus"),
      "F1_STUDENT_VISA",
    );
    expect(
      await screen.findByTestId("ApplicationForm-languageExam"),
    ).toHaveAttribute("id", "ApplicationForm-languageExam");
    expect(screen.getByText("Language Exam")).toHaveAttribute(
      "for",
      "ApplicationForm-languageExam",
    );
    expect(
      screen.getByTestId("ApplicationForm-languageExamDatePassed"),
    ).toBeInTheDocument();

    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-residencyStatus"),
      "J1_STUDENT_VISA",
    );
    expect(
      await screen.findByTestId("ApplicationForm-languageExam"),
    ).toBeInTheDocument();
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
    const submitAction = renderForm({ type: "ULA" });

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
    const submitAction = renderForm({ type: "ULA" });

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
    const submitAction = renderForm({ type: "ULA" });

    await userEvent.selectOptions(
      screen.getByTestId("ApplicationForm-major"),
      "Other",
    );
    const other = await screen.findByTestId("ApplicationForm-otherMajor");
    expect(other).toHaveValue("");
    expect(other).toHaveAttribute("id", "ApplicationForm-otherMajor");
    expect(screen.getByText("Other major")).toHaveAttribute(
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
    const submitAction = renderForm({ type: "ULA" });

    await userEvent.click(screen.getByTestId("ApplicationForm-topic-Java-5"));
    await userEvent.click(screen.getByTestId("ApplicationForm-topic-Python-2"));
    // Changing an answer replaces it.
    await userEvent.click(screen.getByTestId("ApplicationForm-topic-Python-1"));

    expect(screen.getByTestId("ApplicationForm-topic-Java-5")).toBeChecked();
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
    await userEvent.click(screen.getByTestId("ApplicationForm-submit"));

    await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1));
    // Strict: an unrated topic must be absent, not present as undefined.
    expect(submitAction.mock.calls[0][0].topicProficiencies).toStrictEqual({
      Java: 5,
      Python: 1,
    });
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
    // F1, so the exam questions are asked, and answered.
    expect(screen.getByTestId("ApplicationForm-languageExam")).toHaveValue(
      "PASSED",
    );
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
});
