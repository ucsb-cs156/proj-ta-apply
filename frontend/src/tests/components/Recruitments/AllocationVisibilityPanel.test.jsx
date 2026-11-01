import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import AllocationVisibilityPanel from "main/components/Recruitments/AllocationVisibilityPanel";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: vi.fn(),
}));

const axiosMock = new AxiosMockAdapter(axios);

const base = { ...recruitmentsFixtures.threeRecruitments[2], id: 7 };

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

describe("AllocationVisibilityPanel tests", () => {
  beforeEach(() => {
    axiosMock.reset();
    axiosMock.resetHistory();
  });

  test("says who sees the allocations, with a Change button and the default test id", () => {
    renderPanel(base);

    const panel = screen.getByTestId("AllocationVisibilityPanel");
    expect(panel).toHaveClass("d-flex", "mb-3");
    expect(
      screen.getByTestId("AllocationVisibilityPanel-message"),
    ).toHaveTextContent("Allocation visibility: Admins only.");
    expect(
      screen
        .getByTestId("AllocationVisibilityPanel-message")
        .querySelector("strong"),
    ).toHaveTextContent("Admins only");
    const change = screen.getByTestId("AllocationVisibilityPanel-change");
    expect(change).toHaveTextContent("Change");
    expect(change).toHaveClass("btn-outline-primary", "btn-sm");
    // There is nothing per course here, and no old switch.
    expect(screen.queryByText(/Release all/)).toBeNull();
    expect(screen.queryByText(/Withdraw all/)).toBeNull();
    expect(screen.queryByText(/Show All Allocations/)).toBeNull();
  });

  test.each([
    ["ADMINS_ONLY", "Admins only"],
    ["OWN_COURSES", "Faculty see their own courses"],
    ["ALL_COURSES", "Faculty see all courses"],
  ])("names the %s state", (visibility, name) => {
    renderPanel({ ...base, allocationVisibility: visibility });
    expect(
      screen.getByTestId("AllocationVisibilityPanel-message"),
    ).toHaveTextContent(`Allocation visibility: ${name}.`);
  });

  test("a recruitment with no setting yet is admins only", () => {
    const { allocationVisibility: _omitted, ...without } = base;
    renderPanel(without);
    expect(
      screen.getByTestId("AllocationVisibilityPanel-message"),
    ).toHaveTextContent("Allocation visibility: Admins only.");
  });

  test("Change opens the Allocation Visibility modal, and Cancel closes it without sending anything", async () => {
    renderPanel(base, { testIdPrefix: "P" });

    expect(screen.queryByTestId("P-modal")).toBeNull();
    await userEvent.click(screen.getByTestId("P-change"));
    expect(await screen.findByTestId("P-modal")).toBeInTheDocument();
    expect(screen.getByText("Allocation Visibility")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("P-modal-cancel"));
    await vi.waitFor(() => expect(screen.queryByTestId("P-modal")).toBeNull());
    expect(axiosMock.history.put).toHaveLength(0);
  });
});
