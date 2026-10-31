import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import BudgetPage from "main/pages/Admin/BudgetPage";
import budgetFixtures from "fixtures/budgetFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);

function renderPage(qyy = "F26") {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[`/admin/budget/${qyy}`]}>
        <Routes>
          <Route path="/admin/budget/:qyy" element={<BudgetPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const budgetGets = () =>
  axiosMock.history.get.filter((r) => r.url === "/api/admin/budget");
const puts = (url) => axiosMock.history.put.filter((r) => r.url === url);

describe("BudgetPage tests", () => {
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
    axiosMock
      .onGet("/api/admin/budget", { params: { quarter: "20264" } })
      .reply(200, budgetFixtures.bothTypes);
    axiosMock
      .onGet("/api/admin/budget", { params: { quarter: "20262" } })
      .reply(200, budgetFixtures.ulaOnly);
    axiosMock
      .onGet("/api/admin/budget", { params: { quarter: "20261" } })
      .reply(200, budgetFixtures.taOnlyOverBudget);
    axiosMock.onPut("/api/admin/budget").reply(200, budgetFixtures.bothTypes);
    axiosMock
      .onPut("/api/admin/recruitments/avgCostPerPosition")
      .reply(200, {});
    axiosMock.onPut("/api/admin/recruitments/totalHiringTarget").reply(200, {});
  });

  test("something that is not a quarter is explained, and nothing is fetched", async () => {
    renderPage("F2");

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Budget for Quarter",
      }),
    ).toBeInTheDocument();
    const message = screen.getByTestId("BudgetPage-bad-quarter");
    expect(message).toHaveTextContent(
      "“F2” is not a quarter. Quarters are written as a letter and two digits, such as F26. Choose a quarter.",
    );
    expect(
      within(message).getByRole("link", { name: "Choose a quarter" }),
    ).toHaveAttribute("href", "/admin/budget/selectQuarter");
    expect(screen.queryByTestId("BudgetPage-loading")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter((r) => r.url === "/api/currentUser"),
      ).toHaveLength(1),
    );
    expect(budgetGets()).toHaveLength(0);
  });

  test("shows Loading until the summary arrives", async () => {
    renderPage("F26");

    expect(
      screen.getByRole("heading", { level: 1, name: "Budget for F26" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("BudgetPage-loading")).toHaveTextContent(
      "Loading…",
    );
    expect(
      screen.getByRole("link", { name: "Choose another quarter" }),
    ).toHaveAttribute("href", "/admin/budget/selectQuarter");

    await screen.findByTestId("BudgetPage-bottom-line");
    expect(screen.queryByTestId("BudgetPage-loading")).not.toBeInTheDocument();
    expect(budgetGets()).toHaveLength(1);
    expect(budgetGets()[0].params).toEqual({ quarter: "20264" });
  });

  test("a quarter with both recruitments shows every figure", async () => {
    renderPage("F26");
    await screen.findByTestId("BudgetPage-bottom-line");

    // Costs and funds, as entered, two decimals in the boxes.
    expect(
      screen.getByRole("heading", { level: 2, name: "Costs and funds" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /restricted lines \(TAs only, ULAs only\) are spent first/,
      ),
    ).toBeInTheDocument();
    const moreLink = screen.getByRole("link", {
      name: "More about these figures",
    });
    expect(moreLink).toHaveAttribute("href", "/help/admins#budget");
    expect(moreLink.parentElement).toHaveTextContent(
      "anything further comes from the unrestricted pool. More about these figures.",
    );
    expect(
      screen.getByLabelText("Total estimated average cost per TA:"),
    ).toHaveValue("12000.00");
    expect(
      screen.getByLabelText("Total estimated average cost per ULA:"),
    ).toHaveValue("2500.50");
    expect(screen.getByTestId("BudgetPage-avgCost-ta")).not.toBeDisabled();
    expect(screen.getByTestId("BudgetPage-avgCost-ula")).not.toBeDisabled();
    expect(
      screen.queryByTestId("BudgetPage-avgCost-ta-hint"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByLabelText('Total estimated "unrestricted" budget:'),
    ).toHaveValue("100000.00");
    expect(
      screen.getByLabelText('Total estimated additional "TAs only" budget:'),
    ).toHaveValue("20000.25");
    expect(
      screen.getByLabelText('Total estimated additional "ULAs only" budget:'),
    ).toHaveValue("5000.00");
    expect(screen.getAllByText("$")).toHaveLength(5);

    // Hiring targets beside the allocations; both differ here.
    expect(
      screen.getByRole("heading", { level: 2, name: "Hiring targets" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("BudgetPage-target-ta")).toContainElement(
      screen.getByTestId("BudgetPage-target-ta-input"),
    );
    expect(screen.getByTestId("BudgetPage-target-ula")).toContainElement(
      screen.getByTestId("BudgetPage-target-ula-input"),
    );
    expect(screen.getByTestId("BudgetPage-enrollment-ta")).toContainElement(
      screen.getByTestId("BudgetPage-enrollment-ta-total"),
    );
    expect(screen.getByTestId("BudgetPage-enrollment-ula")).toContainElement(
      screen.getByTestId("BudgetPage-enrollment-ula-ratio"),
    );
    expect(
      screen.getByLabelText("Total number of TAs expected to be hired:"),
    ).toHaveValue("8");
    expect(
      screen.getByLabelText("Total number of ULAs expected to be hired:"),
    ).toHaveValue("10");
    expect(
      screen.getByTestId("BudgetPage-target-ta-input").parentElement.style
        .width,
    ).toBe("6em");
    expect(
      screen.getByTestId("BudgetPage-target-ta-allocated"),
    ).toHaveTextContent("TAs allocated to courses so far: 9");
    const taDifference = screen.getByTestId("BudgetPage-target-ta-difference");
    expect(taDifference).toHaveTextContent(
      "Difference (allocated minus target): +1",
    );
    expect(taDifference).toHaveClass("text-danger", "fw-bold");
    const taMismatch = screen.getByTestId("BudgetPage-target-ta-mismatch");
    expect(taMismatch).toHaveTextContent(
      "The allocations do not add up to the target. Adjust them on the TA Recruitment Courses page.",
    );
    expect(taMismatch).toHaveClass("text-danger");
    expect(
      within(taMismatch).getByRole("link", {
        name: "TA Recruitment Courses page",
      }),
    ).toHaveAttribute("href", "/admin/recruitments/5/courses");
    expect(
      screen.getByTestId("BudgetPage-target-ula-allocated"),
    ).toHaveTextContent("ULAs allocated to courses so far: 7");
    expect(
      screen.getByTestId("BudgetPage-target-ula-difference"),
    ).toHaveTextContent("Difference (allocated minus target): -3");
    expect(
      within(screen.getByTestId("BudgetPage-target-ula-mismatch")).getByRole(
        "link",
        {
          name: "ULA Recruitment Courses page",
        },
      ),
    ).toHaveAttribute("href", "/admin/recruitments/6/courses");
    expect(
      screen.queryByTestId("BudgetPage-target-ta-none"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("BudgetPage-target-ula-none"),
    ).not.toBeInTheDocument();

    // Enrollment totals and ratios.
    expect(
      screen.getByText(/TA and ULA recruitments may cover different courses/),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("BudgetPage-enrollment-ta-total"),
    ).toHaveTextContent("Total enrollment estimate for TA courses: 400");
    expect(
      screen.getByTestId("BudgetPage-enrollment-ta-ratio"),
    ).toHaveTextContent("Overall TA:student ratio: 1:50");
    expect(
      screen.getByTestId("BudgetPage-enrollment-ula-total"),
    ).toHaveTextContent("Total enrollment estimate for ULA courses: 400");
    expect(
      screen.getByTestId("BudgetPage-enrollment-ula-ratio"),
    ).toHaveTextContent("Overall ULA:student ratio: 1:40");

    // The budget tables, in dollars and cents.
    expect(
      screen.getByRole("heading", { level: 2, name: "Budget" }),
    ).toBeInTheDocument();
    const expenses = screen.getByTestId("BudgetPage-expenses");
    expect(within(expenses).getByRole("columnheader")).toHaveTextContent(
      "Expenses",
    );
    expect(
      [...expenses.querySelectorAll("tbody tr")].map((tr) =>
        tr.getAttribute("data-testid"),
      ),
    ).toEqual([
      "BudgetPage-expenses-ta",
      "BudgetPage-expenses-ula",
      "BudgetPage-expenses-blank",
      "BudgetPage-expenses-total",
    ]);
    expect(screen.getByTestId("BudgetPage-expenses-ta")).toHaveTextContent(
      "Total anticipated cost for TAs$96,000.00",
    );
    expect(screen.getByTestId("BudgetPage-expenses-ula")).toHaveTextContent(
      "Total anticipated cost for ULAs$25,005.00",
    );
    expect(
      screen.getByTestId("BudgetPage-expenses-blank").textContent.trim(),
    ).toBe("");
    expect(screen.getByTestId("BudgetPage-expenses-total")).toHaveTextContent(
      "Total anticipated expenses$121,005.00",
    );
    expect(screen.getByTestId("BudgetPage-expenses-total")).toHaveClass(
      "fw-bold",
    );
    const funds = screen.getByTestId("BudgetPage-funds");
    expect(within(funds).getByRole("columnheader")).toHaveTextContent("Funds");
    expect(
      [...funds.querySelectorAll("tbody tr")].map((tr) =>
        tr.getAttribute("data-testid"),
      ),
    ).toEqual([
      "BudgetPage-funds-tasOnly",
      "BudgetPage-funds-ulasOnly",
      "BudgetPage-funds-unrestricted",
      "BudgetPage-funds-total",
    ]);
    expect(screen.getByTestId("BudgetPage-funds-tasOnly")).toHaveTextContent(
      "TAs only budget$20,000.25",
    );
    expect(screen.getByTestId("BudgetPage-funds-ulasOnly")).toHaveTextContent(
      "ULAs only budget$5,000.00",
    );
    expect(
      screen.getByTestId("BudgetPage-funds-unrestricted"),
    ).toHaveTextContent("Unrestricted budget$100,000.00");
    expect(screen.getByTestId("BudgetPage-funds-total")).toHaveTextContent(
      "Total anticipated funds$125,000.25",
    );
    expect(screen.getByTestId("BudgetPage-funds-total")).toHaveClass("fw-bold");
    [...document.querySelectorAll("tbody td:nth-child(2)")]
      .filter((td) => td.textContent !== "")
      .forEach((td) => expect(td).toHaveClass("text-end"));

    const bottom = screen.getByTestId("BudgetPage-bottom-line");
    expect(bottom).toHaveTextContent("+$3,995.25");
    expect(bottom).toHaveClass("text-success");
    expect(bottom.parentElement).toHaveTextContent(
      "Bottom line (funds minus expenses): +$3,995.25",
    );
  });

  test("a quarter with only a ULA recruitment greys out the TA figures", async () => {
    renderPage("S26");
    await screen.findByTestId("BudgetPage-bottom-line");

    const taCost = screen.getByTestId("BudgetPage-avgCost-ta");
    expect(taCost).toBeDisabled();
    expect(taCost).toHaveValue("");
    expect(screen.getByTestId("BudgetPage-avgCost-ta-hint")).toHaveTextContent(
      "No TA recruitment for S26.",
    );
    // No cost entered yet: an empty, enabled box.
    const ulaCost = screen.getByTestId("BudgetPage-avgCost-ula");
    expect(ulaCost).not.toBeDisabled();
    expect(ulaCost).toHaveValue("");
    expect(
      screen.queryByTestId("BudgetPage-avgCost-ula-hint"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("BudgetPage-unrestrictedBudget")).toHaveValue(
      "0.00",
    );

    expect(screen.getByTestId("BudgetPage-target-ta-none")).toHaveTextContent(
      "No TA recruitment for S26.",
    );
    expect(
      screen.queryByTestId("BudgetPage-target-ta"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("BudgetPage-target-ula-input")).toHaveValue("4");
    const difference = screen.getByTestId("BudgetPage-target-ula-difference");
    expect(difference).toHaveTextContent(
      "Difference (allocated minus target): 0",
    );
    expect(difference.className).toBe("");
    expect(
      screen.queryByTestId("BudgetPage-target-ula-mismatch"),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByTestId("BudgetPage-enrollment-ta"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("BudgetPage-enrollment-ula-total"),
    ).toHaveTextContent("Total enrollment estimate for ULA courses: 0");
    expect(
      screen.getByTestId("BudgetPage-enrollment-ula-ratio"),
    ).toHaveTextContent("Overall ULA:student ratio: —");

    expect(screen.getByTestId("BudgetPage-expenses-ta")).toHaveTextContent(
      "Total anticipated cost for TAs$0.00",
    );
    expect(screen.getByTestId("BudgetPage-expenses-ula")).toHaveTextContent(
      "Total anticipated cost for ULAs$0.00",
    );
    expect(screen.getByTestId("BudgetPage-expenses-total")).toHaveTextContent(
      "$0.00",
    );
    expect(screen.getByTestId("BudgetPage-funds-total")).toHaveTextContent(
      "$0.00",
    );
    const bottom = screen.getByTestId("BudgetPage-bottom-line");
    expect(bottom).toHaveTextContent("$0.00");
    expect(bottom.className).toBe("");
  });

  test("a quarter with only a TA recruitment that is over budget shows a red bottom line", async () => {
    renderPage("W26");
    await screen.findByTestId("BudgetPage-bottom-line");

    expect(screen.getByTestId("BudgetPage-avgCost-ula")).toBeDisabled();
    expect(screen.getByTestId("BudgetPage-avgCost-ula-hint")).toHaveTextContent(
      "No ULA recruitment for W26.",
    );
    expect(screen.getByTestId("BudgetPage-target-ula-none")).toHaveTextContent(
      "No ULA recruitment for W26.",
    );
    expect(
      screen.queryByTestId("BudgetPage-enrollment-ula"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("BudgetPage-enrollment-ta-ratio"),
    ).toHaveTextContent("1:25");
    expect(screen.getByTestId("BudgetPage-expenses-ta")).toHaveTextContent(
      "$66,000.00",
    );
    expect(screen.getByTestId("BudgetPage-expenses-ula")).toHaveTextContent(
      "$0.00",
    );
    expect(screen.getByTestId("BudgetPage-funds-total")).toHaveTextContent(
      "$50,000.00",
    );
    const bottom = screen.getByTestId("BudgetPage-bottom-line");
    expect(bottom).toHaveTextContent("-$16,000.00");
    expect(bottom).toHaveClass("text-danger");
  });

  test("typing a cost per TA saves it and re-reads the summary", async () => {
    renderPage("F26");
    const box = await screen.findByTestId("BudgetPage-avgCost-ta");
    const getsBefore = budgetGets().length;

    await userEvent.clear(box);
    await userEvent.type(box, "13000.5");

    await waitFor(() =>
      expect(puts("/api/admin/recruitments/avgCostPerPosition")).toHaveLength(
        6,
      ),
    );
    expect(
      puts("/api/admin/recruitments/avgCostPerPosition").map((r) => r.params),
    ).toEqual([
      { id: 5, avgCostPerPosition: "1" },
      { id: 5, avgCostPerPosition: "13" },
      { id: 5, avgCostPerPosition: "130" },
      { id: 5, avgCostPerPosition: "1300" },
      { id: 5, avgCostPerPosition: "13000" },
      { id: 5, avgCostPerPosition: "13000.5" },
    ]);
    await waitFor(() =>
      expect(budgetGets().length).toBeGreaterThan(getsBefore),
    );
    expect(puts("/api/admin/budget")).toHaveLength(0);
  });

  test("typing a cost per ULA saves it against the ULA recruitment", async () => {
    renderPage("F26");
    const box = await screen.findByTestId("BudgetPage-avgCost-ula");

    await userEvent.clear(box);
    await userEvent.type(box, "9");

    await waitFor(() =>
      expect(puts("/api/admin/recruitments/avgCostPerPosition")).toHaveLength(
        1,
      ),
    );
    expect(
      puts("/api/admin/recruitments/avgCostPerPosition")[0].params,
    ).toEqual({
      id: 6,
      avgCostPerPosition: "9",
    });
  });

  test("typing a budget line saves just that line for the quarter", async () => {
    renderPage("F26");
    const box = await screen.findByTestId("BudgetPage-tasOnlyBudget");
    const getsBefore = budgetGets().length;

    await userEvent.clear(box);
    await userEvent.type(box, "7.25");

    await waitFor(() => expect(puts("/api/admin/budget")).toHaveLength(3));
    expect(puts("/api/admin/budget").map((r) => r.params)).toEqual([
      { quarter: "20264", tasOnlyBudget: "7" },
      { quarter: "20264", tasOnlyBudget: "7.2" },
      { quarter: "20264", tasOnlyBudget: "7.25" },
    ]);
    await waitFor(() =>
      expect(budgetGets().length).toBeGreaterThan(getsBefore),
    );

    // A third decimal is not an amount, so adding one sends nothing.
    await userEvent.type(
      screen.getByTestId("BudgetPage-unrestrictedBudget"),
      "1",
    );
    expect(screen.getByTestId("BudgetPage-unrestrictedBudget")).toHaveValue(
      "100000.001",
    );
    expect(screen.getByTestId("BudgetPage-unrestrictedBudget")).toHaveClass(
      "is-invalid",
    );
    expect(puts("/api/admin/budget")).toHaveLength(3);
    await userEvent.clear(screen.getByTestId("BudgetPage-unrestrictedBudget"));
    await userEvent.type(
      screen.getByTestId("BudgetPage-unrestrictedBudget"),
      "1",
    );
    await waitFor(() => expect(puts("/api/admin/budget")).toHaveLength(4));
    expect(puts("/api/admin/budget")[3].params).toEqual({
      quarter: "20264",
      unrestrictedBudget: "1",
    });

    await userEvent.clear(screen.getByTestId("BudgetPage-ulasOnlyBudget"));
    await userEvent.type(screen.getByTestId("BudgetPage-ulasOnlyBudget"), "0");
    await waitFor(() => expect(puts("/api/admin/budget")).toHaveLength(5));
    expect(puts("/api/admin/budget")[4].params).toEqual({
      quarter: "20264",
      ulasOnlyBudget: "0",
    });
  });

  test("typing a hiring target saves it as a number and re-reads the summary", async () => {
    renderPage("F26");
    const box = await screen.findByTestId("BudgetPage-target-ula-input");
    const getsBefore = budgetGets().length;

    await userEvent.clear(box);
    await userEvent.type(box, "12");

    await waitFor(() =>
      expect(puts("/api/admin/recruitments/totalHiringTarget")).toHaveLength(2),
    );
    expect(
      puts("/api/admin/recruitments/totalHiringTarget").map((r) => r.params),
    ).toEqual([
      { id: 6, totalHiringTarget: 1 },
      { id: 6, totalHiringTarget: 12 },
    ]);
    await waitFor(() =>
      expect(budgetGets().length).toBeGreaterThan(getsBefore),
    );

    await userEvent.clear(screen.getByTestId("BudgetPage-target-ta-input"));
    await userEvent.type(screen.getByTestId("BudgetPage-target-ta-input"), "3");
    await waitFor(() =>
      expect(puts("/api/admin/recruitments/totalHiringTarget")).toHaveLength(3),
    );
    expect(puts("/api/admin/recruitments/totalHiringTarget")[2].params).toEqual(
      {
        id: 5,
        totalHiringTarget: 3,
      },
    );
  });

  test("invalid entries are never sent and revert on blur", async () => {
    renderPage("F26");
    const cost = await screen.findByTestId("BudgetPage-avgCost-ta");

    await userEvent.clear(cost);
    await userEvent.type(cost, "12.345");
    expect(cost).toHaveClass("is-invalid");
    const target = screen.getByTestId("BudgetPage-target-ta-input");
    await userEvent.clear(target);
    await userEvent.type(target, "0");
    expect(target).toHaveClass("is-invalid");
    await userEvent.tab();

    expect(cost).toHaveValue("12000.00");
    expect(target).toHaveValue("8");
    // "1", "12", "12.3" and "12.34" were valid along the way; "12." and "12.345" were not.
    expect(
      puts("/api/admin/recruitments/avgCostPerPosition").map(
        (r) => r.params.avgCostPerPosition,
      ),
    ).toEqual(["1", "12", "12.3", "12.34"]);
    expect(puts("/api/admin/recruitments/totalHiringTarget")).toHaveLength(0);
  });

  test("a refused save is toasted", async () => {
    axiosMock
      .onPut("/api/admin/budget")
      .reply(400, { message: "tasOnlyBudget must not be negative" });
    renderPage("F26");
    const box = await screen.findByTestId("BudgetPage-tasOnlyBudget");

    await userEvent.clear(box);
    await userEvent.type(box, "5");

    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockToast.mock.calls[0][0]).toMatch(/400/);
  });

  test("a quarter the backend does not know is toasted and stays loading", async () => {
    axiosMock
      .onGet("/api/admin/budget", { params: { quarter: "20994" } })
      .reply(404, { message: "No recruitment for quarter 20994" });
    renderPage("F99");

    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockToast.mock.calls[0][0]).toMatch(
      /Error communicating with backend via GET on \/api\/admin\/budget/,
    );
    expect(screen.getByTestId("BudgetPage-loading")).toBeInTheDocument();
  });
});
