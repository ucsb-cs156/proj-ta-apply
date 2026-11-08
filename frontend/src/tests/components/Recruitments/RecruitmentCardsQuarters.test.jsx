import { fireEvent, render, screen, within } from "@testing-library/react";
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

/** Opens every quarter card that starts closed (issue #379: every quarter but the newest). */
const openClosedQuarters = () =>
  screen
    .queryAllByTestId(/^Cards-quarter-[WSMF]\d\d-toggle$/)
    .filter((toggle) => toggle.getAttribute("aria-expanded") === "false")
    .forEach((toggle) => fireEvent.click(toggle));

/**
 * Quarter cards and the recruitment cards nested in each, in page order, e.g. ["W26", "TA W26",
 * "ULA W26"]; a closed quarter lists just itself.
 */
const sequence = () =>
  screen.getAllByTestId(/^Cards-quarter-[WSMF]\d\d-card$/).flatMap((card) => {
    const quarter = within(card).getByTestId(
      /^Cards-quarter-[WSMF]\d\d-title$/,
    ).textContent;
    return [
      quarter,
      ...within(card)
        .queryAllByTestId(/^Cards-card-\d+-type$/)
        .map((type) => `${type.textContent} ${quarter}`),
    ];
  });

describe("RecruitmentCards quarter cards", () => {
  beforeEach(() => {
    localStorage.clear();
    axiosMock.reset();
    axiosMock.onGet(/\/steps$/).reply(404, {});
  });

  test("a quarter with both recruitments has one card with Budget Planning and the TA and ULA allocation button, and both nested cards", () => {
    renderCards([w26Ta, w26Ula]);
    expect(screen.getAllByText("W26")).toHaveLength(1);
    expect(screen.queryByText("W26 Budget")).toBeNull();
    const budget = screen.getByTestId("Cards-quarter-W26-budget");
    expect(budget).toHaveTextContent("Budget Planning");
    expect(budget).toHaveAttribute("href", "/admin/budget/W26");
    // Issue #358: one button to the quarter's Combined Allocation page, labelled by its recruitments.
    const allocate = screen.getByTestId("Cards-quarter-W26-allocate");
    expect(allocate).toHaveTextContent("Allocate TA and ULA slots to Courses");
    expect(allocate).toHaveAttribute("href", "/admin/allocations/W26");
    expect(screen.queryByTestId("Cards-budget-W26-card")).toBeNull();
    // The only quarter is the newest, so it is open with its two cards.
    expect(sequence()).toEqual(["W26", "TA W26", "ULA W26"]);
  });

  test("a TA-only quarter's button says TA slots and navigates to the combined page without toggling", async () => {
    renderCards([s26Ta]);
    expect(screen.getByText("S26")).toBeInTheDocument();
    const allocate = screen.getByTestId("Cards-quarter-S26-allocate");
    expect(allocate).toHaveTextContent("Allocate TA slots to Courses");
    expect(allocate).toHaveAttribute("href", "/admin/allocations/S26");
    expect(sequence()).toEqual(["S26", "TA S26"]);
    await userEvent.click(allocate);
    expect(screen.getByTestId("where")).toHaveTextContent(
      "/admin/allocations/S26",
    );
    expect(sequence()).toEqual(["S26", "TA S26"]);
  });

  test("a ULA-only quarter's button says ULA slots", () => {
    renderCards([w26Ula]);
    const allocate = screen.getByTestId("Cards-quarter-W26-allocate");
    expect(allocate).toHaveTextContent("Allocate ULA slots to Courses");
    expect(allocate).toHaveAttribute("href", "/admin/allocations/W26");
    expect(allocate).not.toHaveAttribute("aria-disabled");
    expect(sequence()).toEqual(["W26", "ULA W26"]);
  });

  test("clicking Budget Planning navigates to the quarter's budget page without toggling", async () => {
    renderCards();
    await userEvent.click(screen.getByTestId("Cards-quarter-S26-budget"));
    expect(screen.getByTestId("where")).toHaveTextContent("/admin/budget/S26");
    expect(screen.getByTestId("Cards-quarter-S26-toggle")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await userEvent.click(screen.getByTestId("Cards-quarter-W26-budget"));
    expect(screen.getByTestId("where")).toHaveTextContent("/admin/budget/W26");
    expect(screen.getByTestId("Cards-quarter-W26-toggle")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  test("with more than one of a type in a quarter, there is still one card and the button is live", () => {
    const a = { ...w26Ta, id: 7 };
    const b = { ...w26Ta, id: 9 };
    const c = { ...w26Ta, id: 8 };
    renderCards([a, b, c]);
    expect(screen.getAllByText("W26")).toHaveLength(1);
    expect(screen.getByTestId("Cards-quarter-W26-allocate")).toHaveTextContent(
      "Allocate TA slots to Courses",
    );
    expect(sequence()).toEqual(["W26", "TA W26", "TA W26", "TA W26"]);
  });

  test("whichever order they come in", () => {
    const a = { ...w26Ula, id: 7 };
    const b = { ...w26Ula, id: 9 };
    renderCards([b, a]);
    expect(screen.getByTestId("Cards-quarter-W26-allocate")).toHaveTextContent(
      "Allocate ULA slots to Courses",
    );
  });

  test("each quarter's cards are inside its quarter card and no other", () => {
    renderCards();
    openClosedQuarters();
    const w26 = screen.getByTestId("Cards-quarter-W26-card");
    expect(within(w26).getByText("W26")).toBeInTheDocument();
    expect(within(w26).queryByText("S26")).toBeNull();
    expect(within(w26).getAllByTestId(/^Cards-card-\d+-card$/)).toEqual([
      screen.getByTestId("Cards-card-1-card"),
      screen.getByTestId("Cards-card-2-card"),
    ]);
    const s26 = screen.getByTestId("Cards-quarter-S26-card");
    expect(within(s26).getAllByTestId(/^Cards-card-\d+-card$/)).toEqual([
      screen.getByTestId("Cards-card-0-card"),
    ]);
  });

  test("no recruitments, no quarter cards", () => {
    renderCards([]);
    expect(screen.queryByTestId(/^Cards-quarter-/)).toBeNull();
  });

  test("by default (newest first) the newest quarter is open above the closed older one", () => {
    renderCards();
    expect(sequence()).toEqual(["S26", "TA S26", "W26"]);
    openClosedQuarters();
    expect(sequence()).toEqual(["S26", "TA S26", "W26", "TA W26", "ULA W26"]);
  });

  test("Oldest first puts the older quarter, still closed, above the open newest one", async () => {
    renderCards();
    await userEvent.click(screen.getByTestId("Cards-order-oldest"));
    expect(sequence()).toEqual(["W26", "S26", "TA S26"]);
    openClosedQuarters();
    expect(sequence()).toEqual(["W26", "TA W26", "ULA W26", "S26", "TA S26"]);
    await userEvent.click(screen.getByTestId("Cards-order-newest"));
    expect(sequence()).toEqual(["S26", "TA S26", "W26", "TA W26", "ULA W26"]);
  });
});
