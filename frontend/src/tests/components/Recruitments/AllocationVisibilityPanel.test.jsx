import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import AllocationVisibilityPanel from "main/components/Recruitments/AllocationVisibilityPanel";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);
const URL = "/api/admin/recruitments/allocationsVisibleToFaculty";

const hidden = {
  ...recruitmentsFixtures.threeRecruitments[2],
  id: 7,
  allocationsVisibleToFaculty: false,
};
const shown = { ...hidden, allocationsVisibleToFaculty: true };

function renderPanel(recruitment, props = {}) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <AllocationVisibilityPanel recruitment={recruitment} {...props} />
    </QueryClientProvider>,
  );
}

const puts = () => axiosMock.history.put.filter((r) => r.url === URL);

describe("AllocationVisibilityPanel tests", () => {
  beforeEach(() => {
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock.onPut(URL).reply(200, {});
  });

  test("while hidden it says so and offers to show, with the default test id", () => {
    renderPanel(hidden);

    const panel = screen.getByTestId("AllocationVisibilityPanel");
    expect(panel).toHaveClass(
      "mb-3",
      "d-flex",
      "align-items-center",
      "flex-wrap",
      "gap-2",
    );
    expect(
      screen.getByTestId("AllocationVisibilityPanel-message"),
    ).toHaveTextContent(
      "Allocations of TAs/ULAs per course are currently hidden from faculty.",
    );
    const button = screen.getByTestId("AllocationVisibilityPanel-toggle");
    expect(button).toHaveTextContent("Show Allocations to Faculty");
    expect(
      screen.getByRole("button", { name: "Show Allocations to Faculty" }),
    ).toBe(button);
    expect(button).toHaveClass("btn-outline-primary", "btn-sm");
  });

  test("a missing flag counts as hidden", () => {
    const { allocationsVisibleToFaculty, ...withoutFlag } = hidden;
    expect(allocationsVisibleToFaculty).toBe(false);
    renderPanel(withoutFlag, { testIdPrefix: "P" });

    expect(screen.getByTestId("P-message")).toHaveTextContent(
      "currently hidden from faculty.",
    );
    expect(screen.getByTestId("P-toggle")).toHaveTextContent(
      "Show Allocations to Faculty",
    );
  });

  test("while shown it says so and offers to hide", () => {
    renderPanel(shown, { testIdPrefix: "P" });

    expect(screen.getByTestId("P-message")).toHaveTextContent(
      "Allocations of TAs/ULAs per course are currently shown to faculty (though only for their own courses)",
    );
    const button = screen.getByTestId("P-toggle");
    expect(button).toHaveTextContent("Hide Allocations from Faculty");
    expect(button).toHaveClass("btn-outline-secondary", "btn-sm");
  });

  test("clicking Show sends visible=true for this recruitment and toasts", async () => {
    renderPanel(hidden, { testIdPrefix: "P" });

    await userEvent.click(screen.getByTestId("P-toggle"));

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0].params).toEqual({ id: 7, visible: true });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Allocations are now shown to faculty.",
      ),
    );
    expect(mockToast).toHaveBeenCalledTimes(1);
  });

  test("clicking Hide sends visible=false and toasts", async () => {
    renderPanel(shown, { testIdPrefix: "P" });

    await userEvent.click(screen.getByTestId("P-toggle"));

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0].params).toEqual({ id: 7, visible: false });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Allocations are now hidden from faculty.",
      ),
    );
    expect(mockToast).toHaveBeenCalledTimes(1);
  });

  test("a failed save toasts the error and not the success message", async () => {
    axiosMock
      .onPut(URL)
      .reply(404, { message: "Recruitment with id 7 not found" });
    renderPanel(hidden, { testIdPrefix: "P" });

    await userEvent.click(screen.getByTestId("P-toggle"));

    await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
    expect(mockToast).not.toHaveBeenCalledWith(
      "Allocations are now shown to faculty.",
    );
  });
});
