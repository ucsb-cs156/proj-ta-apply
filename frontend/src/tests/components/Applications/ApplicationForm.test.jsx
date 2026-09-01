import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";

import ApplicationForm from "main/components/Applications/ApplicationForm";
import applicationsFixtures from "fixtures/applicationsFixtures";

const courses = ["CMPSC     8", "CMPSC   130A", "CMPSC   156"];

function renderForm({
  type = "TA",
  initialContents = undefined,
  submitAction = vi.fn(),
  buttonLabel = undefined,
  courseList = courses,
} = {}) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ApplicationForm
          type={type}
          courses={courseList}
          initialContents={initialContents}
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
      "First Choice Course",
      "Second Choice Course",
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

  test("with no previous application every field starts empty", () => {
    renderForm();

    expect(screen.getByTestId("ApplicationForm-firstName")).toHaveValue("");
    expect(screen.getByTestId("ApplicationForm-gpaMajor")).toHaveValue(null);
    expect(
      screen.getByTestId("ApplicationForm-availableForLecturesFirstChoice"),
    ).not.toBeChecked();
  });
});
