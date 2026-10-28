import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import RoleEmailCsvUploadForm from "main/components/Users/RoleEmailCsvUploadForm";
import { vi } from "vitest";

describe("RoleEmailCsvUploadForm tests", () => {
  const renderForm = (submitAction = vi.fn()) => {
    render(
      <MemoryRouter>
        <RoleEmailCsvUploadForm
          submitAction={submitAction}
          label="Upload Instructor Emails (CSV)"
          testIdPrefix="InstructorCSVUploadForm"
        />
      </MemoryRouter>,
    );
    return submitAction;
  };

  test("renders the file input, submit button, and instructions", () => {
    renderForm();
    expect(
      screen.getByTestId("InstructorCSVUploadForm-upload"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("InstructorCSVUploadForm-submit"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Upload Instructor Emails/)).toBeInTheDocument();
    expect(screen.getByText(/column named/)).toBeInTheDocument();
  });

  test("the file input only accepts .csv", () => {
    renderForm();
    expect(
      screen.getByTestId("InstructorCSVUploadForm-upload"),
    ).toHaveAttribute("accept", ".csv");
  });

  test("shows a validation error and does not submit when no file is chosen", async () => {
    const submitAction = renderForm();
    await userEvent.click(screen.getByTestId("InstructorCSVUploadForm-submit"));

    expect(
      await screen.findByText(/A CSV file is required./),
    ).toBeInTheDocument();
    expect(submitAction).not.toHaveBeenCalled();
  });

  test("calls submitAction with the chosen file", async () => {
    const submitAction = renderForm();
    const file = new File(["email\na@ucsb.edu\n"], "grads.csv", {
      type: "text/csv",
    });

    await userEvent.upload(
      screen.getByTestId("InstructorCSVUploadForm-upload"),
      file,
    );
    await userEvent.click(screen.getByTestId("InstructorCSVUploadForm-submit"));

    await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1));
    const submitted = submitAction.mock.calls[0][0];
    expect(submitted.upload[0]).toBe(file);
  });

  test("renders with a caller-supplied label and test id prefix", () => {
    render(
      <MemoryRouter>
        <RoleEmailCsvUploadForm
          submitAction={vi.fn()}
          label="Upload Instructor Emails (CSV)"
          testIdPrefix="InstructorCSVUploadForm"
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByTestId("InstructorCSVUploadForm-upload"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("InstructorCSVUploadForm-submit"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/^Upload Instructor Emails \(CSV\)/),
    ).toBeInTheDocument();
  });

  test("the label is wired to the input, with an id unique to the instance", () => {
    render(
      <MemoryRouter>
        <RoleEmailCsvUploadForm
          submitAction={vi.fn()}
          label="Upload Instructor Emails (CSV)"
          testIdPrefix="InstructorCSVUploadForm"
        />
      </MemoryRouter>,
    );

    const input = screen.getByLabelText(/^Upload Instructor Emails \(CSV\)/);
    expect(input).toBe(screen.getByTestId("InstructorCSVUploadForm-upload"));
    expect(input.id).toBe("InstructorCSVUploadForm-upload-input");
  });
});
