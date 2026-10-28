import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";

import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import ApplicationForm from "main/components/Applications/ApplicationForm";
import applicationsFixtures from "fixtures/applicationsFixtures";
import courseSectionsFixtures from "fixtures/courseSectionsFixtures";

const axiosMock = new AxiosMockAdapter(axios);

const courses = ["CMPSC     8", "CMPSC   130A", "CMPSC   156"];

function renderForm({
  type = "TA",
  initialContents = undefined,
  defaultNames = undefined,
  submitAction = vi.fn(),
  buttonLabel = undefined,
  courseList = courses,
  recruitmentId = undefined,
} = {}) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ApplicationForm
          type={type}
          courses={courseList}
          recruitmentId={recruitmentId}
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
      "Relevant Coursework at UCSB",
      "First Choice Course",
      "Second Choice Course",
      "Other Courses You Would Like to Be Considered For",
      "Anything Else",
    ].forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());
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
    ).toBeInTheDocument();
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
    const submitAction = renderForm({ type: "ULA" });

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
    await userEvent.type(
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
    const submitAction = renderForm({ type: "ULA" });

    await userEvent.type(
      screen.getByTestId("ApplicationForm-firstName"),
      "Ada",
    );
    await userEvent.type(
      screen.getByTestId("ApplicationForm-lastName"),
      "Lovelace",
    );
    await userEvent.type(
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
    expect(
      screen.getByText("A first choice course is required."),
    ).toBeInTheDocument();
    expect(submitAction).not.toHaveBeenCalled();
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
    await userEvent.type(
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
