import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import GradStudentCSVUploadForm from "main/components/Users/GradStudentCSVUploadForm";
import { vi } from "vitest";

describe("GradStudentCSVUploadForm tests", () => {
  const renderForm = (submitAction = vi.fn()) => {
    render(
      <MemoryRouter>
        <GradStudentCSVUploadForm submitAction={submitAction} />
      </MemoryRouter>,
    );
    return submitAction;
  };

  test("renders the file input, submit button, and instructions", () => {
    renderForm();
    expect(
      screen.getByTestId("GradStudentCSVUploadForm-upload"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("GradStudentCSVUploadForm-submit"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Upload Grad Student Emails/)).toBeInTheDocument();
    expect(screen.getByText(/column named/)).toBeInTheDocument();
  });

  test("the file input only accepts .csv", () => {
    renderForm();
    expect(
      screen.getByTestId("GradStudentCSVUploadForm-upload"),
    ).toHaveAttribute("accept", ".csv");
  });

  test("shows a validation error and does not submit when no file is chosen", async () => {
    const submitAction = renderForm();
    await userEvent.click(
      screen.getByTestId("GradStudentCSVUploadForm-submit"),
    );

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
      screen.getByTestId("GradStudentCSVUploadForm-upload"),
      file,
    );
    await userEvent.click(
      screen.getByTestId("GradStudentCSVUploadForm-submit"),
    );

    await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1));
    const submitted = submitAction.mock.calls[0][0];
    expect(submitted.upload[0]).toBe(file);
  });
});
