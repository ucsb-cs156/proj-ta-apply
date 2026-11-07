import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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
const mockNavigate = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mockNavigate,
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
    mockNavigate.mockClear();
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
    expect(
      screen.getByRole("link", { name: "Combined allocations" }),
    ).toHaveAttribute("href", "/admin/allocations/F26");
    expect(
      screen.getByRole("link", { name: "Combined allocations" }).parentElement,
    ).toHaveTextContent(/^Choose another quarter \| Combined allocations$/);

    await screen.findByTestId("BudgetPage-bottom-line");
    expect(screen.queryByTestId("BudgetPage-loading")).not.toBeInTheDocument();
    expect(budgetGets()).toHaveLength(1);
    expect(budgetGets()[0].params).toEqual({ quarter: "20264" });
  });

  test("a quarter with both recruitments shows every figure", async () => {
    renderPage("F26");
    await screen.findByTestId("BudgetPage-bottom-line");

    // Costs and funds (issue #388): a six-column table, whole dollars in the boxes except the
    // ULA hourly rate, and the computed cost per ULA, which are dollars and cents.
    expect(
      screen.getByRole("heading", { level: 2, name: "Costs and funds" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /restricted lines \(TAs only, ULAs only\) are spent first/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /estimated cost per ULA per quarter is the ULA hourly rate times the estimated hours per ULA/,
      ),
    ).toBeInTheDocument();
    const moreLink = screen.getByRole("link", {
      name: "More about these figures",
    });
    expect(moreLink).toHaveAttribute("href", "/help/admins#budget");
    expect(moreLink.parentElement).toHaveTextContent(
      "anything further comes from the unrestricted pool. More about these figures.",
    );
    const costsAndFunds = screen.getByTestId("BudgetPage-costs-funds");
    const headers = within(costsAndFunds).getAllByRole("columnheader");
    expect(headers.map((th) => th.textContent)).toEqual(["Costs", "", "Funds"]);
    expect(headers[0]).toHaveAttribute("colspan", "3");
    expect(headers[2]).toHaveAttribute("colspan", "2");
    const rows = [...costsAndFunds.querySelectorAll("tbody tr")];
    expect(rows.map((tr) => tr.getAttribute("data-testid"))).toEqual([
      "BudgetPage-costs-funds-ta",
      "BudgetPage-costs-funds-rate",
      "BudgetPage-costs-funds-hours",
      "BudgetPage-costs-funds-ulaCost",
    ]);
    // Six cells in every row: label, rate or hours, cost per quarter, spacer, label, amount.
    rows.forEach((tr) => expect(tr.querySelectorAll("td")).toHaveLength(6));
    rows.forEach((tr) => {
      const cells = tr.querySelectorAll("td");
      expect(cells[1]).toHaveClass("text-end");
      expect(cells[2]).toHaveClass("text-end");
      expect(cells[3]).toHaveClass("px-4");
      expect(cells[3].textContent).toBe("");
      expect(cells[5]).toHaveClass("text-end");
    });

    // Row 1: the cost per TA (whole dollars, in the third column) and the unrestricted line.
    const taRow = screen.getByTestId("BudgetPage-costs-funds-ta");
    const taCost = screen.getByLabelText(
      "TA: Estimated cost per TA per quarter:",
    );
    expect(taCost).toBe(screen.getByTestId("BudgetPage-avgCost-ta"));
    expect(taCost).toHaveValue("12000");
    expect(taCost).not.toBeDisabled();
    expect(taRow.querySelectorAll("td")[2]).toContainElement(taCost);
    expect(taRow.querySelectorAll("td")[1].textContent).toBe("");
    expect(
      screen.queryByTestId("BudgetPage-avgCost-ta-hint"),
    ).not.toBeInTheDocument();
    const unrestricted = screen.getByLabelText(
      "Unrestricted temp subzero for quarter:",
    );
    expect(unrestricted).toBe(
      screen.getByTestId("BudgetPage-unrestrictedBudget"),
    );
    expect(unrestricted).toHaveValue("100000");
    expect(taRow.querySelectorAll("td")[5]).toContainElement(unrestricted);

    // Row 2: the ULA hourly rate (cents, second column) and the TAs-only line.
    const rateRow = screen.getByTestId("BudgetPage-costs-funds-rate");
    const rate = screen.getByLabelText("ULA: Hourly rate:");
    expect(rate).toBe(screen.getByTestId("BudgetPage-ulaRateDollarsPerHour"));
    expect(rate).toHaveValue("29.38");
    expect(rateRow.querySelectorAll("td")[1]).toContainElement(rate);
    expect(rateRow.querySelectorAll("td")[2].textContent).toBe("");
    expect(
      screen.getByLabelText("Temp subzero for TAs only for quarter:"),
    ).toHaveValue("20000");

    // Row 3: the hours per ULA (whole, no dollar sign) and the ULAs-only line.
    const hoursRow = screen.getByTestId("BudgetPage-costs-funds-hours");
    const hours = screen.getByLabelText(
      "ULA: Estimated hours per ULA per quarter:",
    );
    expect(hours).toBe(
      screen.getByTestId("BudgetPage-estimatedHoursPerULAPerQuarter"),
    );
    expect(hours).toHaveValue("110");
    expect(hoursRow.querySelectorAll("td")[1]).toContainElement(hours);
    expect(
      within(hoursRow.querySelectorAll("td")[1]).queryByText("$"),
    ).toBeNull();
    expect(hoursRow.querySelectorAll("td")[2].textContent).toBe("");
    expect(
      screen.getByLabelText("Temp subzero for ULAs only for quarter:"),
    ).toHaveValue("5000");

    // Row 4: the computed cost per ULA, not a box, and the other funds for ASEs.
    const ulaCostRow = screen.getByTestId("BudgetPage-costs-funds-ulaCost");
    expect(ulaCostRow.querySelectorAll("td")[0]).toHaveTextContent(
      "ULA: Estimated cost per ULA per quarter:",
    );
    expect(ulaCostRow.querySelectorAll("td")[1].textContent).toBe("");
    const ulaCost = screen.getByTestId("BudgetPage-ulaCost");
    expect(ulaCostRow.querySelectorAll("td")[2]).toContainElement(ulaCost);
    expect(ulaCost).toHaveTextContent("$3,231.80");
    expect(ulaCost).toHaveClass("fw-bold");
    expect(within(ulaCostRow).queryAllByRole("textbox")).toHaveLength(1);
    const gift = screen.getByLabelText(
      "Other funds available for ASEs (e.g. gift funds):",
    );
    expect(gift).toBe(screen.getByTestId("BudgetPage-giftFundsForASEs"));
    expect(gift).toHaveValue("32200");
    expect(ulaCostRow.querySelectorAll("td")[5]).toContainElement(gift);

    // Seven boxes, a dollar sign before every one but the hours.
    expect(within(costsAndFunds).getAllByRole("textbox")).toHaveLength(7);
    expect(screen.getAllByText("$")).toHaveLength(6);
    expect(
      screen.queryByTestId("BudgetPage-avgCost-ula"),
    ).not.toBeInTheDocument();

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
    ).toHaveAttribute("href", "/admin/recruitments/5/courses/edit");
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
    ).toHaveAttribute("href", "/admin/recruitments/6/courses/edit");
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
      "BudgetPage-expenses-blank-2",
      "BudgetPage-expenses-total",
    ]);
    expect(screen.getByTestId("BudgetPage-expenses-ta")).toHaveTextContent(
      "Total anticipated cost for TAs$96,000.00",
    );
    // 10 ULAs at the computed $3,231.80.
    expect(screen.getByTestId("BudgetPage-expenses-ula")).toHaveTextContent(
      "Total anticipated cost for ULAs$32,318.00",
    );
    expect(
      screen.getByTestId("BudgetPage-expenses-blank").textContent.trim(),
    ).toBe("");
    expect(
      screen.getByTestId("BudgetPage-expenses-blank-2").textContent.trim(),
    ).toBe("");
    expect(screen.getByTestId("BudgetPage-expenses-total")).toHaveTextContent(
      "Total anticipated expenses$128,318.00",
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
      "BudgetPage-funds-gift",
      "BudgetPage-funds-total",
    ]);
    // The same number of rows on both sides, so the totals line up.
    expect(expenses.querySelectorAll("tbody tr")).toHaveLength(
      funds.querySelectorAll("tbody tr").length,
    );
    expect(screen.getByTestId("BudgetPage-funds-tasOnly")).toHaveTextContent(
      "TAs only budget$20,000.25",
    );
    expect(screen.getByTestId("BudgetPage-funds-ulasOnly")).toHaveTextContent(
      "ULAs only budget$5,000.00",
    );
    expect(
      screen.getByTestId("BudgetPage-funds-unrestricted"),
    ).toHaveTextContent("Unrestricted budget$100,000.00");
    expect(screen.getByTestId("BudgetPage-funds-gift")).toHaveTextContent(
      "Other funds available for ASEs$32,200.00",
    );
    expect(screen.getByTestId("BudgetPage-funds-total")).toHaveTextContent(
      "Total anticipated funds$157,200.25",
    );
    expect(screen.getByTestId("BudgetPage-funds-total")).toHaveClass("fw-bold");
    [...expenses.querySelectorAll("tbody td:nth-child(2)")]
      .concat([...funds.querySelectorAll("tbody td:nth-child(2)")])
      .filter((td) => td.textContent !== "")
      .forEach((td) => expect(td).toHaveClass("text-end"));

    const bottom = screen.getByTestId("BudgetPage-bottom-line");
    expect(bottom).toHaveTextContent("+$28,882.25");
    expect(bottom).toHaveClass("text-success");
    expect(bottom.parentElement).toHaveTextContent(
      "Bottom line (funds minus expenses): +$28,882.25",
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
    // Nothing entered yet (null): empty, enabled boxes, and no cost per ULA to show.
    for (const id of [
      "BudgetPage-ulaRateDollarsPerHour",
      "BudgetPage-estimatedHoursPerULAPerQuarter",
      "BudgetPage-giftFundsForASEs",
    ]) {
      expect(screen.getByTestId(id)).not.toBeDisabled();
      expect(screen.getByTestId(id)).toHaveValue("");
    }
    expect(screen.getByTestId("BudgetPage-ulaCost")).toHaveTextContent("—");
    expect(screen.getByTestId("BudgetPage-unrestrictedBudget")).toHaveValue(
      "0",
    );
    // Other funds not entered count as zero in the funds.
    expect(screen.getByTestId("BudgetPage-funds-gift")).toHaveTextContent(
      "Other funds available for ASEs$0.00",
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

    // The ULA rate and hours are the budget's, so they are there to enter without a ULA
    // recruitment; with the rate alone there is no cost per ULA yet.
    expect(screen.getByTestId("BudgetPage-ulaRateDollarsPerHour")).toHaveValue(
      "29.38",
    );
    expect(
      screen.getByTestId("BudgetPage-estimatedHoursPerULAPerQuarter"),
    ).toHaveValue("");
    expect(screen.getByTestId("BudgetPage-ulaCost")).toHaveTextContent("—");
    expect(screen.getByTestId("BudgetPage-giftFundsForASEs")).toHaveValue("0");
    expect(screen.getByTestId("BudgetPage-funds-gift")).toHaveTextContent(
      "Other funds available for ASEs$0.00",
    );
    expect(screen.getByTestId("BudgetPage-avgCost-ta")).toHaveValue("11000");
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
      { id: 5, avgCostPerPosition: "1", expected: "12000" },
      { id: 5, avgCostPerPosition: "13", expected: "1" },
      { id: 5, avgCostPerPosition: "130", expected: "13" },
      { id: 5, avgCostPerPosition: "1300", expected: "130" },
      { id: 5, avgCostPerPosition: "13000", expected: "1300" },
      { id: 5, avgCostPerPosition: "13000.5", expected: "13000" },
    ]);
    await waitFor(() =>
      expect(budgetGets().length).toBeGreaterThan(getsBefore),
    );
    expect(puts("/api/admin/budget")).toHaveLength(0);
  });

  test("typing the ULA rate, the hours per ULA or the other funds saves it as a budget line under the lines' version (issue #388)", async () => {
    renderPage("F26");
    const rate = await screen.findByTestId("BudgetPage-ulaRateDollarsPerHour");

    await userEvent.clear(rate);
    await userEvent.type(rate, "29.38");
    // "29." is not an amount, so it is not sent.
    await waitFor(() => expect(puts("/api/admin/budget")).toHaveLength(4));
    expect(puts("/api/admin/budget").map((r) => r.params)).toEqual([
      { quarter: "20264", ulaRateDollarsPerHour: "2", version: 3 },
      { quarter: "20264", ulaRateDollarsPerHour: "29", version: 3 },
      { quarter: "20264", ulaRateDollarsPerHour: "29.3", version: 3 },
      { quarter: "20264", ulaRateDollarsPerHour: "29.38", version: 3 },
    ]);

    const hours = screen.getByTestId(
      "BudgetPage-estimatedHoursPerULAPerQuarter",
    );
    await userEvent.clear(hours);
    await userEvent.type(hours, "110");
    await waitFor(() => expect(puts("/api/admin/budget")).toHaveLength(7));
    expect(puts("/api/admin/budget")[6].params).toEqual({
      quarter: "20264",
      estimatedHoursPerULAPerQuarter: "110",
      version: 3,
    });

    const gift = screen.getByTestId("BudgetPage-giftFundsForASEs");
    await userEvent.clear(gift);
    await userEvent.type(gift, "5");
    await waitFor(() => expect(puts("/api/admin/budget")).toHaveLength(8));
    expect(puts("/api/admin/budget")[7].params).toEqual({
      quarter: "20264",
      giftFundsForASEs: "5",
      version: 3,
    });
    // None of them is a recruitment's figure.
    expect(puts("/api/admin/recruitments/avgCostPerPosition")).toHaveLength(0);
  });

  test("the cost per ULA shown is the one the server computed, and follows a save", async () => {
    const recomputed = {
      ...budgetFixtures.bothTypes,
      budget: {
        ...budgetFixtures.bothTypes.budget,
        estimatedHoursPerULAPerQuarter: 100,
      },
      estimatedCostPerULAPerQuarter: 2938,
    };
    axiosMock.onPut("/api/admin/budget").reply(200, recomputed);
    laterReadsAre(recomputed);
    renderPage("F26");
    const hours = await screen.findByTestId(
      "BudgetPage-estimatedHoursPerULAPerQuarter",
    );
    expect(screen.getByTestId("BudgetPage-ulaCost")).toHaveTextContent(
      "$3,231.80",
    );

    await userEvent.clear(hours);
    await userEvent.type(hours, "1");

    await waitFor(() =>
      expect(screen.getByTestId("BudgetPage-ulaCost")).toHaveTextContent(
        "$2,938.00",
      ),
    );
  });

  test("typing a budget line saves just that line for the quarter", async () => {
    renderPage("F26");
    const box = await screen.findByTestId("BudgetPage-tasOnlyBudget");
    const getsBefore = budgetGets().length;

    await userEvent.clear(box);
    await userEvent.type(box, "7.25");

    await waitFor(() => expect(puts("/api/admin/budget")).toHaveLength(3));
    expect(puts("/api/admin/budget").map((r) => r.params)).toEqual([
      { quarter: "20264", tasOnlyBudget: "7", version: 3 },
      { quarter: "20264", tasOnlyBudget: "7.2", version: 3 },
      { quarter: "20264", tasOnlyBudget: "7.25", version: 3 },
    ]);
    await waitFor(() =>
      expect(budgetGets().length).toBeGreaterThan(getsBefore),
    );

    // The box shows whole dollars, but cents may be typed; a third decimal is not an amount, so
    // adding one sends nothing.
    await userEvent.type(
      screen.getByTestId("BudgetPage-unrestrictedBudget"),
      ".125",
    );
    expect(screen.getByTestId("BudgetPage-unrestrictedBudget")).toHaveValue(
      "100000.125",
    );
    expect(screen.getByTestId("BudgetPage-unrestrictedBudget")).toHaveClass(
      "is-invalid",
    );
    // "100000." was not sent either; "100000.1" and "100000.12" were.
    await waitFor(() => expect(puts("/api/admin/budget")).toHaveLength(5));
    expect(
      puts("/api/admin/budget")
        .slice(3)
        .map((r) => r.params.unrestrictedBudget),
    ).toEqual(["100000.1", "100000.12"]);
    await userEvent.clear(screen.getByTestId("BudgetPage-unrestrictedBudget"));
    await userEvent.type(
      screen.getByTestId("BudgetPage-unrestrictedBudget"),
      "1",
    );
    await waitFor(() => expect(puts("/api/admin/budget")).toHaveLength(6));
    expect(puts("/api/admin/budget")[5].params).toEqual({
      quarter: "20264",
      unrestrictedBudget: "1",
      version: 3,
    });

    await userEvent.clear(screen.getByTestId("BudgetPage-ulasOnlyBudget"));
    await userEvent.type(screen.getByTestId("BudgetPage-ulasOnlyBudget"), "0");
    await waitFor(() => expect(puts("/api/admin/budget")).toHaveLength(7));
    expect(puts("/api/admin/budget")[6].params).toEqual({
      quarter: "20264",
      ulasOnlyBudget: "0",
      version: 3,
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
      { id: 6, totalHiringTarget: 1, expected: "10" },
      { id: 6, totalHiringTarget: 12, expected: "1" },
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
        expected: "8",
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
    const rate = screen.getByTestId("BudgetPage-ulaRateDollarsPerHour");
    await userEvent.clear(rate);
    await userEvent.type(rate, "29.385");
    expect(rate).toHaveClass("is-invalid");
    await userEvent.tab();

    // Whole dollars for the cost, cents for the rate, as stored.
    expect(cost).toHaveValue("12000");
    expect(rate).toHaveValue("29.38");
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

  // ---- the version check and compare-and-set (issue #277) ----

  const COST = "/api/admin/recruitments/avgCostPerPosition";
  const TARGET = "/api/admin/recruitments/totalHiringTarget";

  /**
   * The summary as another admin left it: a TAs-only budget of 45,000 and 120 hours per ULA, at
   * version 4.
   */
  const theirs = {
    ...budgetFixtures.bothTypes,
    budget: {
      ...budgetFixtures.bothTypes.budget,
      tasOnlyBudget: 45000,
      estimatedHoursPerULAPerQuarter: 120,
      version: 4,
    },
    estimatedCostPerULAPerQuarter: 3525.6,
    totalFunds: 182200,
  };

  /** Refuses the first budget save as stale and takes every later one. */
  function refuseFirstBudgetSave() {
    let saves = 0;
    axiosMock.onPut("/api/admin/budget").reply(() => {
      saves += 1;
      return saves === 1
        ? [
            409,
            {
              message: "stale",
              version: 4,
              conversionVersion: 1,
              summary: theirs,
            },
          ]
        : [200, theirs];
    });
  }

  test("a stale budget line is refused: the page shows what is stored and offers both choices", async () => {
    refuseFirstBudgetSave();
    renderPage("F26");
    const box = await screen.findByTestId("BudgetPage-tasOnlyBudget");

    await userEvent.clear(box);
    await userEvent.type(box, "4");

    const alert = await screen.findByTestId(
      "BudgetPage-conflict-tasOnlyBudget",
    );
    expect(
      screen.getByTestId("BudgetPage-conflict-tasOnlyBudget-message"),
    ).toHaveTextContent(
      "The TAs-only budget was changed in another tab or window. It is now $45,000.00; you entered $4.00.",
    );
    expect(alert).toHaveClass("alert-warning");
    expect(
      screen.getByRole("button", { name: "Use theirs" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Overwrite" }),
    ).toBeInTheDocument();
    // The page now shows what is stored, everywhere.
    expect(screen.getByTestId("BudgetPage-funds-tasOnly")).toHaveTextContent(
      "TAs only budget$45,000.00",
    );
    expect(screen.getByTestId("BudgetPage-funds-total")).toHaveTextContent(
      "$182,200.00",
    );
    expect(screen.getByTestId("BudgetPage-ulaCost")).toHaveTextContent(
      "$3,525.60",
    );
    expect(puts("/api/admin/budget")).toHaveLength(1);
  });

  test("a stale hours per ULA is refused in plain numbers, and Overwrite saves it against the version stored now (issue #388)", async () => {
    refuseFirstBudgetSave();
    renderPage("F26");
    const box = await screen.findByTestId(
      "BudgetPage-estimatedHoursPerULAPerQuarter",
    );

    await userEvent.clear(box);
    await userEvent.type(box, "4");

    expect(
      await screen.findByTestId(
        "BudgetPage-conflict-estimatedHoursPerULAPerQuarter-message",
      ),
    ).toHaveTextContent(
      "The estimated hours per ULA per quarter was changed in another tab or window. It is now 120; you entered 4.",
    );
    await userEvent.click(
      screen.getByTestId(
        "BudgetPage-conflict-estimatedHoursPerULAPerQuarter-overwrite",
      ),
    );

    await waitFor(() => expect(puts("/api/admin/budget")).toHaveLength(2));
    expect(puts("/api/admin/budget")[1].params).toEqual({
      quarter: "20264",
      estimatedHoursPerULAPerQuarter: "4",
      version: 4,
    });
  });

  test("a stale ULA rate or other funds is refused in dollars and cents", async () => {
    let saves = 0;
    axiosMock.onPut("/api/admin/budget").reply(() => {
      saves += 1;
      return [
        409,
        {
          message: "stale",
          version: 4 + saves,
          conversionVersion: 1,
          summary: {
            ...theirs,
            budget: {
              ...theirs.budget,
              ulaRateDollarsPerHour: 30.5,
              giftFundsForASEs: null,
              version: 4 + saves,
            },
          },
        },
      ];
    });
    renderPage("F26");
    const rate = await screen.findByTestId("BudgetPage-ulaRateDollarsPerHour");
    await userEvent.clear(rate);
    await userEvent.type(rate, "1");
    const gift = screen.getByTestId("BudgetPage-giftFundsForASEs");
    await userEvent.clear(gift);
    await userEvent.type(gift, "2");

    expect(
      await screen.findByTestId(
        "BudgetPage-conflict-ulaRateDollarsPerHour-message",
      ),
    ).toHaveTextContent(
      "The ULA hourly rate was changed in another tab or window. It is now $30.50; you entered $1.00.",
    );
    // Other funds not entered on their side read as zero.
    expect(
      await screen.findByTestId("BudgetPage-conflict-giftFundsForASEs-message"),
    ).toHaveTextContent(
      "The other funds available for ASEs was changed in another tab or window. It is now $0.00; you entered $2.00.",
    );
    expect(screen.getByTestId("BudgetPage-ulaRateDollarsPerHour")).toHaveValue(
      "30.50",
    );
  });

  test("Use theirs drops what was typed and sends nothing", async () => {
    refuseFirstBudgetSave();
    renderPage("F26");
    const box = await screen.findByTestId("BudgetPage-tasOnlyBudget");
    await userEvent.clear(box);
    await userEvent.type(box, "4");
    await screen.findByTestId("BudgetPage-conflict-tasOnlyBudget");

    await userEvent.click(
      screen.getByTestId("BudgetPage-conflict-tasOnlyBudget-theirs"),
    );

    expect(
      screen.queryByTestId("BudgetPage-conflict-tasOnlyBudget"),
    ).not.toBeInTheDocument();
    expect(puts("/api/admin/budget")).toHaveLength(1);
  });

  test("Overwrite saves what was typed again, against the version that is stored now", async () => {
    refuseFirstBudgetSave();
    renderPage("F26");
    const box = await screen.findByTestId("BudgetPage-tasOnlyBudget");
    await userEvent.clear(box);
    await userEvent.type(box, "4");
    await screen.findByTestId("BudgetPage-conflict-tasOnlyBudget");

    await userEvent.click(
      screen.getByTestId("BudgetPage-conflict-tasOnlyBudget-overwrite"),
    );

    await waitFor(() => expect(puts("/api/admin/budget")).toHaveLength(2));
    expect(puts("/api/admin/budget")[1].params).toEqual({
      quarter: "20264",
      tasOnlyBudget: "4",
      version: 4,
    });
    expect(
      screen.queryByTestId("BudgetPage-conflict-tasOnlyBudget"),
    ).not.toBeInTheDocument();
  });

  test("typing more while a figure is in conflict updates what Overwrite would save, and sends nothing", async () => {
    refuseFirstBudgetSave();
    renderPage("F26");
    const box = await screen.findByTestId("BudgetPage-tasOnlyBudget");
    await userEvent.clear(box);
    await userEvent.type(box, "4");
    await screen.findByTestId("BudgetPage-conflict-tasOnlyBudget");

    await userEvent.type(box, "5");

    expect(
      screen.getByTestId("BudgetPage-conflict-tasOnlyBudget-message"),
    ).toHaveTextContent("you entered $45.00.");
    expect(puts("/api/admin/budget")).toHaveLength(1);
    await userEvent.click(
      screen.getByTestId("BudgetPage-conflict-tasOnlyBudget-overwrite"),
    );
    await waitFor(() => expect(puts("/api/admin/budget")).toHaveLength(2));
    expect(puts("/api/admin/budget")[1].params.tasOnlyBudget).toBe("45");
  });

  test("a save after a good one carries the version the good one answered with", async () => {
    axiosMock.onPut("/api/admin/budget").reply(200, theirs);
    renderPage("F26");
    const box = await screen.findByTestId("BudgetPage-tasOnlyBudget");

    await userEvent.clear(box);
    await userEvent.type(box, "12");

    await waitFor(() => expect(puts("/api/admin/budget")).toHaveLength(2));
    expect(puts("/api/admin/budget").map((r) => r.params.version)).toEqual([
      3, 4,
    ]);
  });

  test("a budget line carries the lines' version and never the factor's count, so a factor changed on the combined page is no conflict (issue #375)", async () => {
    // Someone saved the conversion factor meanwhile: its count rose, the lines' version did not.
    axiosMock.onPut("/api/admin/budget").reply(200, {
      ...budgetFixtures.bothTypes,
      budget: {
        ...budgetFixtures.bothTypes.budget,
        conversionTAtoULA: 2,
        conversionVersion: 5,
      },
    });
    renderPage("F26");
    const box = await screen.findByTestId("BudgetPage-tasOnlyBudget");

    await userEvent.clear(box);
    await userEvent.type(box, "12");

    await waitFor(() => expect(puts("/api/admin/budget")).toHaveLength(2));
    expect(puts("/api/admin/budget").map((r) => r.params)).toEqual([
      { quarter: "20264", tasOnlyBudget: "1", version: 3 },
      { quarter: "20264", tasOnlyBudget: "12", version: 3 },
    ]);
    expect(screen.queryByTestId(/^BudgetPage-conflict-/)).toBeNull();
  });

  test("a refused average cost shows what is stored, and Overwrite expects it", async () => {
    let saves = 0;
    axiosMock.onPut(COST).reply(() => {
      saves += 1;
      return saves === 1
        ? [
            409,
            { message: "stale", recruitment: { avgCostPerPosition: 15000 } },
          ]
        : [200, {}];
    });
    renderPage("F26");
    const box = await screen.findByTestId("BudgetPage-avgCost-ta");
    await userEvent.clear(box);
    await userEvent.type(box, "1");

    expect(
      await screen.findByTestId("BudgetPage-conflict-cost-ta-message"),
    ).toHaveTextContent(
      "The estimated cost per TA was changed in another tab or window. It is now $15,000.00; you entered $1.00.",
    );

    await userEvent.click(
      screen.getByTestId("BudgetPage-conflict-cost-ta-overwrite"),
    );

    await waitFor(() => expect(puts(COST)).toHaveLength(2));
    expect(puts(COST)[1].params).toEqual({
      id: 5,
      avgCostPerPosition: "1",
      expected: "15000",
    });
    expect(screen.queryByTestId("BudgetPage-conflict-cost-ta")).toBeNull();
  });

  test("a refused hiring target says so in plain numbers, and Use theirs expects the stored value next", async () => {
    let saves = 0;
    axiosMock.onPut(TARGET).reply(() => {
      saves += 1;
      return saves === 1
        ? [409, { message: "stale", recruitment: { totalHiringTarget: 9 } }]
        : [200, {}];
    });
    renderPage("F26");
    const box = await screen.findByTestId("BudgetPage-target-ula-input");
    await userEvent.clear(box);
    await userEvent.type(box, "1");

    expect(
      await screen.findByTestId("BudgetPage-conflict-target-ula-message"),
    ).toHaveTextContent(
      "The ULA hiring target was changed in another tab or window. It is now 9; you entered 1.",
    );
    await userEvent.click(
      screen.getByTestId("BudgetPage-conflict-target-ula-theirs"),
    );
    expect(screen.queryByTestId("BudgetPage-conflict-target-ula")).toBeNull();

    await userEvent.clear(box);
    await userEvent.type(box, "7");
    await waitFor(() => expect(puts(TARGET)).toHaveLength(2));
    expect(puts(TARGET)[1].params).toEqual({
      id: 6,
      totalHiringTarget: 7,
      expected: "9",
    });
  });

  test("a figure that has no stored value yet is saved without an expected value", async () => {
    axiosMock
      .onGet("/api/admin/budget", { params: { quarter: "20264" } })
      .reply(200, {
        ...budgetFixtures.bothTypes,
        ta: { ...budgetFixtures.bothTypes.ta, avgCostPerPosition: null },
      });
    renderPage("F26");
    const box = await screen.findByTestId("BudgetPage-avgCost-ta");
    expect(box).toHaveValue("");

    await userEvent.type(box, "5");

    await waitFor(() => expect(puts(COST)).toHaveLength(1));
    expect(puts(COST)[0].params).toEqual({ id: 5, avgCostPerPosition: "5" });
    expect(puts(COST)[0].params.expected).toBeUndefined();
  });

  test("a refusal with a missing answer is shown as zero rather than breaking the page", async () => {
    axiosMock.onPut(COST).reply(409, {});
    axiosMock.onPut(TARGET).reply(409, {});
    renderPage("F26");
    const cost = await screen.findByTestId("BudgetPage-avgCost-ta");
    await userEvent.clear(cost);
    await userEvent.type(cost, "1");
    const target = screen.getByTestId("BudgetPage-target-ta-input");
    await userEvent.clear(target);
    await userEvent.type(target, "1");

    expect(
      await screen.findByTestId("BudgetPage-conflict-cost-ta-message"),
    ).toHaveTextContent("It is now $0.00;");
    expect(
      await screen.findByTestId("BudgetPage-conflict-target-ta-message"),
    ).toHaveTextContent("It is now 0;");
  });

  test("a save that never reached the server is logged, not toasted", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    axiosMock.onPut(TARGET).networkError();
    renderPage("F26");
    await userEvent.type(
      await screen.findByTestId("BudgetPage-target-ta-input"),
      "1",
    );

    await waitFor(() =>
      expect(log).toHaveBeenCalledWith(
        "Backend request failed",
        expect.anything(),
      ),
    );
    expect(mockToast).not.toHaveBeenCalled();
    log.mockRestore();
  });

  const userGets = () =>
    axiosMock.history.get.filter((r) => r.url === "/api/currentUser");

  /** Answers the first read of F26 as usual and later ones as `later`; or never, if null. */
  function laterReadsAre(later) {
    let reads = 0;
    axiosMock
      .onGet("/api/admin/budget", { params: { quarter: "20264" } })
      .reply(() => {
        reads += 1;
        if (reads === 1) return [200, budgetFixtures.bothTypes];
        return later === null ? new Promise(() => {}) : [200, later];
      });
  }

  test("no notice is shown until a save is refused", async () => {
    renderPage("F26");
    await screen.findByTestId("BudgetPage-bottom-line");
    expect(
      document.querySelectorAll('[data-testid^="BudgetPage-conflict-"]'),
    ).toHaveLength(0);
  });

  test("a saved budget line shows the answer to the save, before any re-read", async () => {
    laterReadsAre(null);
    axiosMock.onPut("/api/admin/budget").reply(200, theirs);
    renderPage("F26");
    const box = await screen.findByTestId("BudgetPage-tasOnlyBudget");

    await userEvent.clear(box);
    await userEvent.type(box, "4");

    await waitFor(() =>
      expect(screen.getByTestId("BudgetPage-funds-tasOnly")).toHaveTextContent(
        "TAs only budget$45,000.00",
      ),
    );
  });

  test("a refused budget line shows the answer to the save, before any re-read", async () => {
    laterReadsAre(null);
    refuseFirstBudgetSave();
    renderPage("F26");
    const box = await screen.findByTestId("BudgetPage-tasOnlyBudget");

    await userEvent.clear(box);
    await userEvent.type(box, "4");

    await waitFor(() =>
      expect(screen.getByTestId("BudgetPage-funds-tasOnly")).toHaveTextContent(
        "TAs only budget$45,000.00",
      ),
    );
  });

  test("a save re-reads the budget and nothing else", async () => {
    renderPage("F26");
    const box = await screen.findByTestId("BudgetPage-avgCost-ta");
    const before = budgetGets().length;

    await userEvent.clear(box);
    await userEvent.type(box, "1");

    await waitFor(() => expect(budgetGets().length).toBeGreaterThan(before));
    expect(userGets()).toHaveLength(1);
  });

  test("a refused figure re-reads the budget and nothing else", async () => {
    axiosMock
      .onPut(COST)
      .reply(409, { recruitment: { avgCostPerPosition: 15000 } });
    renderPage("F26");
    const box = await screen.findByTestId("BudgetPage-avgCost-ta");
    const before = budgetGets().length;

    await userEvent.clear(box);
    await userEvent.type(box, "1");

    await screen.findByTestId("BudgetPage-conflict-cost-ta");
    await waitFor(() => expect(budgetGets().length).toBeGreaterThan(before));
    expect(userGets()).toHaveLength(1);
  });

  test("a figure changed by a re-read is still compared with the value first seen", async () => {
    laterReadsAre({
      ...budgetFixtures.bothTypes,
      ta: {
        ...budgetFixtures.bothTypes.ta,
        avgCostPerPosition: 77,
        totalHiringTarget: 5,
      },
      ula: {
        ...budgetFixtures.bothTypes.ula,
        avgCostPerPosition: 1,
        totalHiringTarget: 11,
      },
    });
    renderPage("F26");
    const cost = await screen.findByTestId("BudgetPage-avgCost-ta");
    await userEvent.clear(cost);
    await userEvent.type(cost, "1");
    await waitFor(() =>
      expect(screen.getByTestId("BudgetPage-target-ta-input")).toHaveValue("5"),
    );

    const taTarget = screen.getByTestId("BudgetPage-target-ta-input");
    await userEvent.clear(taTarget);
    await userEvent.type(taTarget, "9");
    const ulaTarget = screen.getByTestId("BudgetPage-target-ula-input");
    await userEvent.clear(ulaTarget);
    await userEvent.type(ulaTarget, "4");
    await userEvent.clear(cost);
    await userEvent.type(cost, "6");

    await waitFor(() => expect(puts(TARGET)).toHaveLength(2));
    await waitFor(() => expect(puts(COST)).toHaveLength(2));
    expect(puts(TARGET).map((r) => [r.params.id, r.params.expected])).toEqual([
      [5, "8"],
      [6, "10"],
    ]);
    // The first save of the figure expected what was first seen; the next, what that save set.
    expect(puts(COST).map((r) => [r.params.id, r.params.expected])).toEqual([
      [5, "12000"],
      [5, "1"],
    ]);
  });

  test("a refused budget line with no figures in the answer is shown as zero", async () => {
    axiosMock.onPut("/api/admin/budget").reply(409, {});
    renderPage("F26");
    const box = await screen.findByTestId("BudgetPage-tasOnlyBudget");
    await userEvent.clear(box);
    await userEvent.type(box, "4");

    expect(
      await screen.findByTestId("BudgetPage-conflict-tasOnlyBudget-message"),
    ).toHaveTextContent("It is now $0.00; you entered $4.00.");
  });

  test("a refusal with no answer at all is still shown, as zero, naming the figure", async () => {
    axiosMock.onPut("/api/admin/budget").reply(409);
    axiosMock.onPut(COST).reply(409);
    axiosMock.onPut(TARGET).reply(409);
    renderPage("F26");
    for (const [id, field, name] of [
      [
        "BudgetPage-unrestrictedBudget",
        "unrestrictedBudget",
        "unrestricted budget",
      ],
      ["BudgetPage-tasOnlyBudget", "tasOnlyBudget", "TAs-only budget"],
      ["BudgetPage-ulasOnlyBudget", "ulasOnlyBudget", "ULAs-only budget"],
      [
        "BudgetPage-ulaRateDollarsPerHour",
        "ulaRateDollarsPerHour",
        "ULA hourly rate",
      ],
      [
        "BudgetPage-estimatedHoursPerULAPerQuarter",
        "estimatedHoursPerULAPerQuarter",
        "estimated hours per ULA per quarter",
      ],
      [
        "BudgetPage-giftFundsForASEs",
        "giftFundsForASEs",
        "other funds available for ASEs",
      ],
      ["BudgetPage-avgCost-ta", "cost-ta", "estimated cost per TA"],
      ["BudgetPage-target-ta-input", "target-ta", "TA hiring target"],
      ["BudgetPage-target-ula-input", "target-ula", "ULA hiring target"],
    ]) {
      const box = await screen.findByTestId(id);
      await userEvent.clear(box);
      await userEvent.type(box, "4");
      const message = await screen.findByTestId(
        `BudgetPage-conflict-${field}-message`,
      );
      expect(message.textContent).toMatch(
        new RegExp(
          `^The ${name} was changed in another tab or window\\. It is now \\$?0(\\.00)?; you entered`,
        ),
      );
    }
  });

  // ---- the multi-tab warning (issue #277) ----

  const HEARTBEAT = "/api/admin/budget/heartbeat?quarter=20264";
  const heartbeats = () =>
    axiosMock.history.post.filter((r) =>
      r.url.startsWith("/api/admin/budget/heartbeat"),
    );
  // The shared wording of an admin page (issue #298).
  const ADMIN = "We recommend that only one admin edits this page at a time.";
  const phill = {
    label: "phtcon@ucsb.edu (Phill Conrad)",
    samePerson: false,
    admin: true,
  };
  const me = { label: "me@example.org (Me)", samePerson: true };
  const MODAL = "BudgetPage-multiple-tabs-modal";

  test("this quarter's tab heartbeats for this quarter once the budget is there, and its saves name the same tab", async () => {
    renderPage("F26");
    expect(heartbeats()).toHaveLength(0);

    await waitFor(() => expect(heartbeats()).toHaveLength(1));
    expect(heartbeats()[0].url).toBe(HEARTBEAT);
    const id = heartbeats()[0].headers["X-Client-Id"];
    expect(id).toMatch(/^[0-9a-f-]{36}$/);

    const line = screen.getByTestId("BudgetPage-tasOnlyBudget");
    await userEvent.clear(line);
    await userEvent.type(line, "1");
    await waitFor(() =>
      expect(puts("/api/admin/budget").length).toBeGreaterThan(0),
    );
    expect(puts("/api/admin/budget")[0].headers["X-Client-Id"]).toBe(id);
  });

  test("there is no heartbeat for something that is not a quarter", async () => {
    renderPage("F2");
    await screen.findByTestId("BudgetPage-bad-quarter");
    expect(heartbeats()).toHaveLength(0);
  });

  test("nobody else: no banner and no modal", async () => {
    axiosMock
      .onPost(HEARTBEAT)
      .reply(200, { others: [], heartbeatSeconds: 20 });
    renderPage("F26");
    await waitFor(() => expect(heartbeats()).toHaveLength(1));

    expect(screen.queryByTestId("BudgetPage-multiple-tabs")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("another admin is named in the banner, and the budget is still there to use", async () => {
    axiosMock
      .onPost(HEARTBEAT)
      .reply(200, { others: [phill], heartbeatSeconds: 20, newest: false });
    renderPage("F26");

    expect(
      await screen.findByTestId("BudgetPage-multiple-tabs"),
    ).toHaveTextContent(
      `phtcon@ucsb.edu (Phill Conrad) is also editing this budget page. ${ADMIN}`,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("BudgetPage-tasOnlyBudget")).toBeInTheDocument();
  });

  test("the user's own other tab, and another admin, are told apart", async () => {
    axiosMock
      .onPost(HEARTBEAT)
      .reply(200, { others: [me, phill], heartbeatSeconds: 20 });
    renderPage("F26");

    expect(
      await screen.findByTestId("BudgetPage-multiple-tabs"),
    ).toHaveTextContent(
      `You and phtcon@ucsb.edu (Phill Conrad) are also editing this budget page in other windows or tabs. ${ADMIN}`,
    );
  });

  test("only the user's own other tab: the admin sentence, not the risk sentence", async () => {
    axiosMock
      .onPost(HEARTBEAT)
      .reply(200, { others: [me], heartbeatSeconds: 20, newest: false });
    renderPage("F26");

    expect(
      await screen.findByTestId("BudgetPage-multiple-tabs"),
    ).toHaveTextContent(
      `You are also editing this budget page in another tab or window. ${ADMIN}`,
    );
  });

  test("the newest tab is asked what to do", async () => {
    axiosMock.onPost(HEARTBEAT).reply(200, {
      others: [phill],
      heartbeatSeconds: 20,
      newest: true,
      arrivedAtMillis: 1000,
    });
    renderPage("F26");

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    // The later tab says who "already" has it, in the modal and in the banner.
    expect(screen.getByTestId(`${MODAL}-message`)).toHaveTextContent(
      `phtcon@ucsb.edu (Phill Conrad) already has this budget page open for editing. ${ADMIN}`,
    );
    expect(screen.getByTestId("BudgetPage-multiple-tabs")).toHaveTextContent(
      `phtcon@ucsb.edu (Phill Conrad) already has this budget page open for editing. ${ADMIN}`,
    );

    fireEvent.click(screen.getByTestId(`${MODAL}-continue`));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("BudgetPage-multiple-tabs")).toBeInTheDocument();
  });

  test("Leave this page says goodbye for this quarter, naming this tab, and goes home", async () => {
    const fetchMock = vi.fn().mockResolvedValue({});
    vi.stubGlobal("fetch", fetchMock);
    axiosMock.onPost(HEARTBEAT).reply(200, {
      others: [phill],
      heartbeatSeconds: 20,
      newest: true,
      arrivedAtMillis: 1000,
    });
    renderPage("F26");
    await screen.findByRole("dialog");
    await waitFor(() => expect(heartbeats()).toHaveLength(1));

    fireEvent.click(screen.getByTestId(`${MODAL}-leave`));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/budget/leave?quarter=20264");
    expect(init.keepalive).toBe(true);
    expect(init.headers["X-Client-Id"]).toBe(
      heartbeats()[0].headers["X-Client-Id"],
    );
    expect(mockNavigate).toHaveBeenCalledWith("/");
    vi.unstubAllGlobals();
  });

  test("leaving the page says goodbye even though no pagehide happened", async () => {
    const fetchMock = vi.fn().mockResolvedValue({});
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = renderPage("F26");
    await waitFor(() => expect(heartbeats()).toHaveLength(1));

    unmount();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/budget/leave?quarter=20264",
      expect.objectContaining({ method: "POST", keepalive: true }),
    );
    vi.unstubAllGlobals();
  });
});
