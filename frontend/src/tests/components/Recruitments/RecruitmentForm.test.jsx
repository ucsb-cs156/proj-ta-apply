import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { vi } from "vitest";

import RecruitmentForm from "main/components/Recruitments/RecruitmentForm";
import { quarterRange } from "main/utils/quarterUtilities";

const quarters = quarterRange("20211", "20214");

function renderForm(submitAction = vi.fn(), qs = quarters, onCancel = vi.fn()) {
  render(
    <MemoryRouter>
      <RecruitmentForm
        quarters={qs}
        submitAction={submitAction}
        onCancel={onCancel}
      />
    </MemoryRouter>,
  );
  return submitAction;
}

describe("RecruitmentForm tests", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("renders the quarter, type and both date fields", () => {
    renderForm();
    // Issue #108: the form is a modal's body and footer, with its own buttons.
    expect(screen.getByTestId("RecruitmentForm-submit")).toHaveTextContent(
      "Create New Recruitment",
    );
    expect(screen.getByTestId("RecruitmentForm-cancel")).toHaveTextContent(
      "Cancel",
    );
    expect(
      screen.getByTestId("RecruitmentForm-submit").parentElement,
    ).toHaveClass("modal-footer");
    expect(
      screen.getByTestId("RecruitmentForm-type").closest(".modal-body"),
    ).not.toBeNull();
    expect(screen.getByTestId("RecruitmentForm.Quarter")).toBeInTheDocument();
    expect(screen.getByTestId("RecruitmentForm-type")).toBeInTheDocument();
    expect(
      screen.getByTestId("RecruitmentForm-tentativeOpeningDate"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("RecruitmentForm-primaryConsiderationDate"),
    ).toBeInTheDocument();
  });

  test("submits the selected quarter, type and dates", async () => {
    const submitAction = renderForm();

    await userEvent.selectOptions(
      screen.getByTestId("RecruitmentForm.Quarter"),
      "20213",
    );
    await userEvent.selectOptions(
      screen.getByTestId("RecruitmentForm-type"),
      "ULA",
    );
    await userEvent.type(
      screen.getByTestId("RecruitmentForm-tentativeOpeningDate"),
      "2026-01-05",
    );
    await userEvent.type(
      screen.getByTestId("RecruitmentForm-primaryConsiderationDate"),
      "2026-01-20",
    );
    await userEvent.click(screen.getByTestId("RecruitmentForm-submit"));

    await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1));
    expect(submitAction.mock.calls[0][0]).toEqual({
      quarter: "20213",
      type: "ULA",
      tentativeOpeningDate: "2026-01-05",
      primaryConsiderationDate: "2026-01-20",
    });
  });

  test("both dates are required", async () => {
    const submitAction = renderForm();

    await userEvent.click(screen.getByTestId("RecruitmentForm-submit"));

    expect(
      await screen.findByText(/A tentative opening date is required./),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/A primary consideration date is required./),
    ).toBeInTheDocument();
    expect(submitAction).not.toHaveBeenCalled();
  });

  test("each label is wired to its control", () => {
    renderForm();

    expect(screen.getByLabelText("Type")).toBe(
      screen.getByTestId("RecruitmentForm-type"),
    );
    expect(screen.getByLabelText(/Tentative Opening Date/)).toBe(
      screen.getByTestId("RecruitmentForm-tentativeOpeningDate"),
    );
    expect(screen.getByLabelText(/Primary Consideration Date/)).toBe(
      screen.getByTestId("RecruitmentForm-primaryConsiderationDate"),
    );
    for (const name of [
      "type",
      "tentativeOpeningDate",
      "primaryConsiderationDate",
    ]) {
      expect(screen.getByTestId(`RecruitmentForm-${name}`)).toHaveAttribute(
        "id",
        `RecruitmentForm-${name}`,
      );
    }
  });

  test("Cancel calls back without submitting", async () => {
    const onCancel = vi.fn();
    const submitAction = renderForm(vi.fn(), quarters, onCancel);

    await userEvent.click(screen.getByTestId("RecruitmentForm-cancel"));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(submitAction).not.toHaveBeenCalled();
  });

  /** No configured quarters is degenerate, but it must not crash the page. */
  test("renders without a quarter when the range is empty", () => {
    renderForm(vi.fn(), []);
    expect(screen.getByTestId("RecruitmentForm-submit")).toBeInTheDocument();
  });
});
