import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, test } from "vitest";

import AdminBudgetCard from "main/components/Recruitments/AdminBudgetCard";

const renderCard = (props) =>
  render(
    <MemoryRouter>
      <AdminBudgetCard {...props} />
    </MemoryRouter>,
  );

describe("AdminBudgetCard", () => {
  test("titles the card with the quarter and has three live buttons", () => {
    renderCard({ quarter: "20261", ta: { id: 1 }, ula: { id: 2 } });
    expect(screen.getByTestId("AdminBudgetCard-W26-card")).toHaveClass(
      "card",
      "w-100",
    );
    expect(screen.getByTestId("AdminBudgetCard-W26-title")).toHaveTextContent(
      "W26 Budget",
    );
    const budget = screen.getByTestId("AdminBudgetCard-W26-budget");
    expect(budget).toHaveTextContent("Budget");
    expect(budget).toHaveAttribute("href", "/admin/budget/W26");
    // Issue #358: both allocations buttons open the quarter's Combined Allocation page.
    const ta = screen.getByTestId("AdminBudgetCard-W26-ta-allocations");
    expect(ta).toHaveTextContent("TA allocations");
    expect(ta).toHaveAttribute("href", "/admin/allocations/W26");
    expect(ta).toHaveClass("btn-outline-primary");
    const ula = screen.getByTestId("AdminBudgetCard-W26-ula-allocations");
    expect(ula).toHaveTextContent("ULA allocations");
    expect(ula).toHaveAttribute("href", "/admin/allocations/W26");
  });

  test("a missing recruitment's button is a greyed-out, disabled button with the same label", () => {
    renderCard({ quarter: "20262", ula: { id: 5 } });
    const ta = screen.getByTestId("AdminBudgetCard-S26-ta-allocations");
    expect(ta).toHaveTextContent("TA allocations");
    expect(ta).toBeDisabled();
    expect(ta).toHaveAttribute("aria-disabled", "true");
    expect(ta).toHaveClass("btn-outline-secondary");
    expect(ta.tagName).toBe("BUTTON");
    // The one that exists still goes to the combined page, for its quarter.
    expect(
      screen.getByTestId("AdminBudgetCard-S26-ula-allocations"),
    ).toHaveAttribute("href", "/admin/allocations/S26");
  });

  test("with neither, both allocation buttons are disabled", () => {
    renderCard({ quarter: "20264", testIdPrefix: "X" });
    expect(screen.getByTestId("X-F26-ta-allocations")).toBeDisabled();
    expect(screen.getByTestId("X-F26-ula-allocations")).toBeDisabled();
    expect(screen.getByTestId("X-F26-ula-allocations")).toHaveTextContent(
      "ULA allocations",
    );
  });
});
