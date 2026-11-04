import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";

import ApplicationForm from "main/components/Applications/ApplicationForm";

// Issue #309: only the Submit button submits the application; Enter in a field and the buttons
// of the course dialog (portalled out of the form, but inside it in the React tree) never do.
const courses = ["CMPSC     8", "CMPSC   156"];

function renderForm(type, submitAction = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ApplicationForm
          type={type}
          courses={courses}
          majors={["Computer Science"]}
          topics={["Java"]}
          interests={["Grading"]}
          submitAction={submitAction}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return submitAction;
}

describe.each(["TA", "ULA"])("ApplicationForm %s Enter and dialogs", (type) => {
  afterEach(cleanup);

  test.each(["firstName", "middleName", "lastName", "gpaMajor", "gpaOverall"])(
    "Enter in the %s field does not submit or flag anything",
    async (name) => {
      const submitAction = renderForm(type);
      const field = screen.getByTestId(`ApplicationForm-${name}`);
      await userEvent.type(field, "x{Enter}");
      expect(submitAction).not.toHaveBeenCalled();
      expect(screen.queryByTestId("ApplicationForm-missing")).toBeNull();
    },
  );

  test("Enter in a select and a checkbox does not submit", async () => {
    const submitAction = renderForm(type);
    const major = screen.getByTestId("ApplicationForm-major");
    major.focus();
    await userEvent.keyboard("{Enter}");
    const checkbox = document.querySelector("input[type=checkbox]");
    checkbox.focus();
    await userEvent.keyboard("{Enter}");
    expect(submitAction).not.toHaveBeenCalled();
    expect(screen.queryByTestId("ApplicationForm-missing")).toBeNull();
  });

  test("Enter in the comments textarea still adds a new line", async () => {
    renderForm(type);
    const comments = screen.getByTestId("ApplicationForm-comments");
    await userEvent.type(comments, "a{Enter}b");
    expect(comments.value).toBe("a\nb");
  });

  test("the course dialog's Save button adds the course without submitting the application", async () => {
    const submitAction = renderForm(type);
    await userEvent.click(
      screen.getByTestId("ApplicationForm-coursework-add-button"),
    );
    await userEvent.type(
      screen.getByTestId("ApplicationForm-coursework-modal-courseNumber"),
      "CMPSC 24",
    );
    await userEvent.click(
      screen.getByTestId("ApplicationForm-coursework-modal-save"),
    );
    await waitFor(() =>
      expect(
        screen.queryByTestId("ApplicationForm-coursework-modal-save"),
      ).toBeNull(),
    );
    expect(screen.getByText("CMPSC 24")).toBeInTheDocument();
    expect(submitAction).not.toHaveBeenCalled();
    expect(screen.queryByTestId("ApplicationForm-missing")).toBeNull();
  });

  test("Enter in the course dialog adds just that course, not the application", async () => {
    const submitAction = renderForm(type);
    await userEvent.click(
      screen.getByTestId("ApplicationForm-coursework-add-button"),
    );
    await userEvent.type(
      screen.getByTestId("ApplicationForm-coursework-modal-courseNumber"),
      "CMPSC 32{Enter}",
    );
    await waitFor(() =>
      expect(
        screen.queryByTestId("ApplicationForm-coursework-modal-save"),
      ).toBeNull(),
    );
    expect(screen.getByText("CMPSC 32")).toBeInTheDocument();
    expect(submitAction).not.toHaveBeenCalled();
    expect(screen.queryByTestId("ApplicationForm-missing")).toBeNull();
  });

  test("an invalid Save in the dialog does not submit the application", async () => {
    const submitAction = renderForm(type);
    await userEvent.click(
      screen.getByTestId("ApplicationForm-coursework-add-button"),
    );
    await userEvent.click(
      screen.getByTestId("ApplicationForm-coursework-modal-save"),
    );
    expect(submitAction).not.toHaveBeenCalled();
    expect(screen.queryByTestId("ApplicationForm-missing")).toBeNull();
  });

  test("the Submit Application button still submits (flagging what is missing)", async () => {
    renderForm(type);
    await userEvent.click(screen.getByTestId("ApplicationForm-submit"));
    expect(
      await screen.findByTestId("ApplicationForm-missing"),
    ).toBeInTheDocument();
  });
});
