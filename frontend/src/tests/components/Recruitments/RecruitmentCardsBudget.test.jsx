import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { beforeEach, describe, expect, test } from "vitest";

import RecruitmentCards from "main/components/Recruitments/RecruitmentCards";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

const axiosMock = new AxiosMockAdapter(axios);

// Fixture: S26 TA (id 3), W26 ULA (id 2), W26 TA (id 1).
const three = recruitmentsFixtures.threeRecruitments;
const [s26Ta, w26Ula, w26Ta] = three;

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderCards(recruitments = three) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <RecruitmentCards recruitments={recruitments} testIdPrefix="Cards" />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Budget cards and recruitment cards in page order, e.g. ["W26 Budget", "TA W26", ...]. */
const sequence = () => {
  const out = [];
  let quarter = "";
  document
    .querySelectorAll(
      '[data-testid$="-title"], [data-testid$="-quarter"], [data-testid$="-type"]',
    )
    .forEach((el) => {
      const text = el.textContent;
      if (text.endsWith("Budget")) out.push(text);
      else if (text === "TA" || text === "ULA") out.push(`${text} ${quarter}`);
      else quarter = text;
    });
  return out;
};

describe("RecruitmentCards budget cards", () => {
  beforeEach(() => {
    axiosMock.reset();
    axiosMock.onGet(/\/steps$/).reply(404, {});
  });

  test("a quarter with both recruitments has one card with Budget Planning and the TA and ULA allocation button", () => {
    renderCards([w26Ta, w26Ula]);
    expect(screen.getAllByText("W26 Budget")).toHaveLength(1);
    const budget = screen.getByTestId("Cards-budget-W26-budget");
    expect(budget).toHaveTextContent("Budget Planning");
    expect(budget).toHaveAttribute("href", "/admin/budget/W26");
    // Issue #358: one button to the quarter's Combined Allocation page, labelled by its recruitments.
    const allocate = screen.getByTestId("Cards-budget-W26-allocate");
    expect(allocate).toHaveTextContent("Allocate TA and ULA slots to Courses");
    expect(allocate).toHaveAttribute("href", "/admin/allocations/W26");
    expect(screen.queryByTestId("Cards-budget-W26-ta-allocations")).toBeNull();
    expect(screen.queryByTestId("Cards-budget-W26-ula-allocations")).toBeNull();
  });

  test("a TA-only quarter's button says TA slots and navigates to the combined page", async () => {
    renderCards([s26Ta]);
    expect(screen.getByText("S26 Budget")).toBeInTheDocument();
    const allocate = screen.getByTestId("Cards-budget-S26-allocate");
    expect(allocate).toHaveTextContent("Allocate TA slots to Courses");
    expect(allocate).toHaveAttribute("href", "/admin/allocations/S26");
    await userEvent.click(allocate);
    expect(screen.getByTestId("where")).toHaveTextContent(
      "/admin/allocations/S26",
    );
  });

  test("a ULA-only quarter's button says ULA slots", () => {
    renderCards([w26Ula]);
    const allocate = screen.getByTestId("Cards-budget-W26-allocate");
    expect(allocate).toHaveTextContent("Allocate ULA slots to Courses");
    expect(allocate).toHaveAttribute("href", "/admin/allocations/W26");
    expect(allocate).not.toHaveAttribute("aria-disabled");
  });

  test("clicking Budget Planning navigates to the quarter's budget page", async () => {
    renderCards();
    await userEvent.click(screen.getByTestId("Cards-budget-S26-budget"));
    expect(screen.getByTestId("where")).toHaveTextContent("/admin/budget/S26");
  });

  test("with more than one of a type in a quarter, there is still one card and the button is live", () => {
    const a = { ...w26Ta, id: 7 };
    const b = { ...w26Ta, id: 9 };
    const c = { ...w26Ta, id: 8 };
    renderCards([a, b, c]);
    expect(screen.getAllByText("W26 Budget")).toHaveLength(1);
    expect(screen.getByTestId("Cards-budget-W26-allocate")).toHaveTextContent(
      "Allocate TA slots to Courses",
    );
  });

  test("whichever order they come in", () => {
    const a = { ...w26Ula, id: 7 };
    const b = { ...w26Ula, id: 9 };
    renderCards([b, a]);
    expect(screen.getByTestId("Cards-budget-W26-allocate")).toHaveTextContent(
      "Allocate ULA slots to Courses",
    );
  });

  test("each quarter's cards are wrapped together", () => {
    renderCards();
    const w26 = screen.getByTestId("Cards-quarter-20261");
    expect(within(w26).getByText("W26 Budget")).toBeInTheDocument();
    expect(within(w26).queryByText("S26 Budget")).toBeNull();
    expect(screen.getByTestId("Cards-quarter-20262")).toBeInTheDocument();
  });

  test("no recruitments, no budget cards", () => {
    renderCards([]);
    expect(screen.queryByText(/Budget$/)).toBeNull();
  });

  test("by default (Quarter, newest first) each budget card is above its quarter", () => {
    renderCards();
    expect(sequence()).toEqual([
      "S26 Budget",
      "TA S26",
      "W26 Budget",
      "TA W26",
      "ULA W26",
    ]);
  });

  test.each([
    [
      "quarter ascending",
      ["quarter"],
      ["W26 Budget", "TA W26", "ULA W26", "S26 Budget", "TA S26"],
    ],
    [
      "type ascending",
      ["type"],
      ["S26 Budget", "TA S26", "W26 Budget", "TA W26", "ULA W26"],
    ],
    [
      "type descending",
      ["type", "type"],
      ["W26 Budget", "ULA W26", "TA W26", "S26 Budget", "TA S26"],
    ],
    [
      "status ascending",
      ["applicationStatus"],
      ["S26 Budget", "TA S26", "W26 Budget", "TA W26", "ULA W26"],
    ],
    [
      "status descending",
      ["applicationStatus", "applicationStatus"],
      ["W26 Budget", "ULA W26", "TA W26", "S26 Budget", "TA S26"],
    ],
  ])(
    "sorting by %s moves each budget card with its quarter",
    async (_name, clicks, expected) => {
      renderCards();
      for (const key of clicks) {
        await userEvent.click(screen.getByTestId(`Cards-sort-${key}`));
      }
      expect(sequence()).toEqual(expected);
    },
  );
});
