import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { vi } from "vitest";

import RecruitmentForm from "main/components/Recruitments/RecruitmentForm";
import { quarterRange } from "main/utils/quarterUtilities";

const quarters = quarterRange("20211", "20214");

function renderForm(submitAction = vi.fn(), qs = quarters) {
  render(
    <MemoryRouter>
      <RecruitmentForm quarters={qs} submitAction={submitAction} />
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

  /** No configured quarters is degenerate, but it must not crash the page. */
  test("renders without a quarter when the range is empty", () => {
    renderForm(vi.fn(), []);
    expect(screen.getByTestId("RecruitmentForm-submit")).toBeInTheDocument();
  });
});
