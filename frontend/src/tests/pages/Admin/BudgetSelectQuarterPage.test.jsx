import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import BudgetSelectQuarterPage from "main/pages/Admin/BudgetSelectQuarterPage";
import budgetFixtures from "fixtures/budgetFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);

function renderPage() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <BudgetSelectQuarterPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("BudgetSelectQuarterPage tests", () => {
  beforeEach(() => {
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.adminUser);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
  });

  test("lists the quarters newest first, each linking to its budget, with an x per type", async () => {
    axiosMock
      .onGet("/api/admin/budget/quarters")
      .reply(200, budgetFixtures.quarters);
    renderPage();

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Budget for Quarter",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Only quarters with a recruitment are listed/),
    ).toBeInTheDocument();
    await screen.findByTestId("BudgetSelectQuarterPage-table");

    const headers = [...screen.getAllByRole("columnheader")].map(
      (th) => th.textContent,
    );
    expect(headers).toEqual(["Quarter", "TA", "ULA"]);
    expect(
      [...document.querySelectorAll("tbody tr")].map((tr) =>
        tr.getAttribute("data-testid"),
      ),
    ).toEqual([
      "BudgetSelectQuarterPage-row-20264",
      "BudgetSelectQuarterPage-row-20262",
      "BudgetSelectQuarterPage-row-20261",
    ]);

    const f26 = screen.getByTestId("BudgetSelectQuarterPage-link-20264");
    expect(f26).toHaveTextContent("F26");
    expect(f26).toHaveAttribute("href", "/admin/budget/F26");
    expect(
      screen.getByTestId("BudgetSelectQuarterPage-link-20262"),
    ).toHaveAttribute("href", "/admin/budget/S26");
    expect(
      screen.getByTestId("BudgetSelectQuarterPage-link-20261"),
    ).toHaveTextContent("W26");

    expect(
      screen.getByTestId("BudgetSelectQuarterPage-ta-20264"),
    ).toHaveTextContent("x");
    expect(
      screen.getByTestId("BudgetSelectQuarterPage-ula-20264"),
    ).toHaveTextContent("x");
    expect(
      screen.getByTestId("BudgetSelectQuarterPage-ta-20262"),
    ).toHaveTextContent("");
    expect(
      screen.getByTestId("BudgetSelectQuarterPage-ula-20262"),
    ).toHaveTextContent("x");
    expect(
      screen.getByTestId("BudgetSelectQuarterPage-ta-20261"),
    ).toHaveTextContent("x");
    expect(
      screen.getByTestId("BudgetSelectQuarterPage-ula-20261"),
    ).toHaveTextContent("");
    expect(screen.getByTestId("BudgetSelectQuarterPage-ta-20261")).toHaveClass(
      "text-center",
    );
    expect(
      screen.getByTestId("BudgetSelectQuarterPage-table").style.width,
    ).toBe("auto");
    expect(
      screen.queryByTestId("BudgetSelectQuarterPage-empty"),
    ).not.toBeInTheDocument();
  });

  test("says so when there are no recruitments", async () => {
    axiosMock.onGet("/api/admin/budget/quarters").reply(200, []);
    renderPage();

    expect(
      await screen.findByTestId("BudgetSelectQuarterPage-empty"),
    ).toHaveTextContent(
      "No recruitments yet, so there is nothing to budget for.",
    );
    expect(
      screen.queryByTestId("BudgetSelectQuarterPage-table"),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter(
          (r) => r.url === "/api/admin/budget/quarters",
        ),
      ).toHaveLength(1),
    );
  });

  test("a backend error is toasted and the page stays empty", async () => {
    axiosMock.onGet("/api/admin/budget/quarters").reply(500);
    renderPage();

    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockToast.mock.calls[0][0]).toMatch(
      /Error communicating with backend via GET on \/api\/admin\/budget\/quarters/,
    );
    expect(
      screen.getByTestId("BudgetSelectQuarterPage-empty"),
    ).toBeInTheDocument();
  });
});
