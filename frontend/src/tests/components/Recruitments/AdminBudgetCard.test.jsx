import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, test } from "vitest";

import AdminBudgetCard, {
  allocateLabel,
} from "main/components/Recruitments/AdminBudgetCard";

const renderCard = (props) =>
  render(
    <MemoryRouter>
      <AdminBudgetCard {...props} />
    </MemoryRouter>,
  );

describe("AdminBudgetCard", () => {
  test("titles the card with the quarter; Budget Planning and the TA and ULA allocation button are live", () => {
    renderCard({ quarter: "20261", ta: { id: 1 }, ula: { id: 2 } });
    expect(screen.getByTestId("AdminBudgetCard-W26-card")).toHaveClass(
      "card",
      "w-100",
    );
    expect(screen.getByTestId("AdminBudgetCard-W26-title")).toHaveTextContent(
      "W26 Budget",
    );
    const budget = screen.getByTestId("AdminBudgetCard-W26-budget");
    expect(budget).toHaveTextContent(/^Budget Planning$/);
    expect(budget).toHaveAttribute("href", "/admin/budget/W26");
    // Issue #358: one button to the quarter's Combined Allocation page.
    const allocate = screen.getByTestId("AdminBudgetCard-W26-allocate");
    expect(allocate).toHaveTextContent(
      /^Allocate TA and ULA slots to Courses$/,
    );
    expect(allocate).toHaveAttribute("href", "/admin/allocations/W26");
    expect(allocate).toHaveClass("btn-outline-primary");
    expect(allocate.tagName).toBe("A");
    expect(
      screen.queryByTestId("AdminBudgetCard-W26-ta-allocations"),
    ).toBeNull();
    expect(
      screen.queryByTestId("AdminBudgetCard-W26-ula-allocations"),
    ).toBeNull();
  });

  test("a quarter with only a ULA recruitment says ULA slots", () => {
    renderCard({ quarter: "20262", ula: { id: 5 } });
    const allocate = screen.getByTestId("AdminBudgetCard-S26-allocate");
    expect(allocate).toHaveTextContent(/^Allocate ULA slots to Courses$/);
    expect(allocate).toHaveAttribute("href", "/admin/allocations/S26");
    expect(allocate).not.toHaveAttribute("aria-disabled");
  });

  test("a quarter with only a TA recruitment says TA slots", () => {
    renderCard({ quarter: "20263", ta: { id: 3 } });
    const allocate = screen.getByTestId("AdminBudgetCard-M26-allocate");
    expect(allocate).toHaveTextContent(/^Allocate TA slots to Courses$/);
    expect(allocate).toHaveAttribute("href", "/admin/allocations/M26");
  });

  test("with neither recruitment the button is greyed out and disabled, with the full label", () => {
    renderCard({ quarter: "20264", testIdPrefix: "X" });
    const allocate = screen.getByTestId("X-F26-allocate");
    expect(allocate).toHaveTextContent(
      /^Allocate TA and ULA slots to Courses$/,
    );
    expect(allocate).toBeDisabled();
    expect(allocate).toHaveAttribute("aria-disabled", "true");
    expect(allocate).toHaveClass("btn-outline-secondary");
    expect(allocate.tagName).toBe("BUTTON");
    expect(allocate).not.toHaveAttribute("href");
    expect(screen.getByTestId("X-F26-budget")).toHaveAttribute(
      "href",
      "/admin/budget/F26",
    );
  });

  test("allocateLabel names the recruitments the quarter has", () => {
    expect(allocateLabel(true, false)).toBe("Allocate TA slots to Courses");
    expect(allocateLabel(false, true)).toBe("Allocate ULA slots to Courses");
    expect(allocateLabel(true, true)).toBe(
      "Allocate TA and ULA slots to Courses",
    );
    expect(allocateLabel(false, false)).toBe(
      "Allocate TA and ULA slots to Courses",
    );
  });
});
