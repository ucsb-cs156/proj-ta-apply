import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, test } from "vitest";

import AdminQuarterCard, {
  QUARTER_CARD_STORAGE_PREFIX,
  allocateLabel,
} from "main/components/Recruitments/AdminQuarterCard";

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

const renderCard = (props, children = <p data-testid="inside">Nested</p>) =>
  render(
    <MemoryRouter>
      <AdminQuarterCard {...props}>{children}</AdminQuarterCard>
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

describe("AdminQuarterCard", () => {
  beforeEach(() => localStorage.clear());

  test("the header row is headed by the quarter alone, with Budget Planning and the TA and ULA allocation button live", () => {
    renderCard({ quarter: "20261", ta: { id: 1 }, ula: { id: 2 } });
    const card = screen.getByTestId("AdminQuarterCard-W26-card");
    expect(card).toHaveClass("card", "w-100", "mb-3");
    const title = screen.getByTestId("AdminQuarterCard-W26-title");
    expect(title).toHaveTextContent(/^W26$/);
    expect(title).toHaveClass("fs-5");
    expect(title.tagName).toBe("STRONG");
    expect(screen.queryByText(/Budget$/)).toBeNull();
    const header = card.querySelector(".card-header");
    expect(header).toHaveClass("bg-light", "d-flex", "align-items-center");
    const budget = screen.getByTestId("AdminQuarterCard-W26-budget");
    expect(budget).toHaveTextContent(/^Budget Planning$/);
    expect(budget).toHaveAttribute("href", "/admin/budget/W26");
    expect(header).toContainElement(budget);
    // Issue #358: one button to the quarter's Combined Allocation page.
    const allocate = screen.getByTestId("AdminQuarterCard-W26-allocate");
    expect(allocate).toHaveTextContent(
      /^Allocate TA and ULA slots to Courses$/,
    );
    expect(allocate).toHaveAttribute("href", "/admin/allocations/W26");
    expect(allocate).toHaveClass("btn-outline-primary");
    expect(allocate.tagName).toBe("A");
    expect(header).toContainElement(allocate);
    // Issue #427: the instructors' feedback on the quarter's allocations.
    const feedback = screen.getByTestId(
      "AdminQuarterCard-W26-instructorFeedback",
    );
    expect(feedback).toHaveTextContent(/^Instructor Feedback$/);
    expect(feedback).toHaveAttribute("href", "/admin/instructorFeedback/W26");
    expect(feedback).toHaveClass("btn", "btn-outline-primary");
    expect(feedback.tagName).toBe("A");
    // The buttons sit together after the toggle, outside it.
    const buttons = screen.getByTestId("AdminQuarterCard-W26-buttons");
    expect(Array.from(buttons.children)).toEqual([budget, allocate, feedback]);
    expect(buttons).toHaveClass("d-flex", "gap-2");
    expect(buttons.previousElementSibling).toBe(
      screen.getByTestId("AdminQuarterCard-W26-toggle"),
    );
    expect(
      screen.getByTestId("AdminQuarterCard-W26-toggle"),
    ).not.toContainElement(budget);
  });

  test("the toggle is a button with aria-expanded that spans the rest of the row, carrying the caret and the title", () => {
    renderCard({ quarter: "20261", ta: { id: 1 }, defaultOpen: true });
    const toggle = screen.getByTestId("AdminQuarterCard-W26-toggle");
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle).toHaveAttribute("type", "button");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveClass(
      "btn",
      "btn-link",
      "flex-grow-1",
      "text-start",
      "text-reset",
      "text-decoration-none",
    );
    expect(toggle).toContainElement(
      screen.getByTestId("AdminQuarterCard-W26-title"),
    );
    const caret = screen.getByTestId("AdminQuarterCard-W26-caret");
    expect(caret).toHaveTextContent("▾");
    expect(caret).toHaveAttribute("aria-hidden", "true");
    expect(toggle).toContainElement(caret);
    // The accessible name is the quarter: the caret is hidden from it.
    expect(screen.getByRole("button", { name: "W26", expanded: true })).toBe(
      toggle,
    );
  });

  test("starts closed unless told otherwise: the body and what is nested in it are not rendered", () => {
    renderCard({ quarter: "20261", ta: { id: 1 } });
    expect(screen.getByTestId("AdminQuarterCard-W26-toggle")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByTestId("AdminQuarterCard-W26-caret")).toHaveTextContent(
      "▸",
    );
    expect(screen.queryByTestId("AdminQuarterCard-W26-body")).toBeNull();
    expect(screen.queryByTestId("inside")).toBeNull();
    // The buttons are still there to click.
    expect(screen.getByTestId("AdminQuarterCard-W26-budget")).toBeVisible();
    expect(localStorage.length).toBe(0);
  });

  test("defaultOpen shows the nested content in the body", () => {
    renderCard({ quarter: "20261", ta: { id: 1 }, defaultOpen: true });
    const body = screen.getByTestId("AdminQuarterCard-W26-body");
    expect(body).toHaveClass("card-body", "pb-0");
    expect(body).toContainElement(screen.getByTestId("inside"));
  });

  test("clicking the row closes and opens the card, remembering each setting for the quarter", async () => {
    renderCard({ quarter: "20261", ta: { id: 1 }, defaultOpen: true });
    const toggle = screen.getByTestId("AdminQuarterCard-W26-toggle");

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("AdminQuarterCard-W26-caret")).toHaveTextContent(
      "▸",
    );
    expect(screen.queryByTestId("inside")).toBeNull();
    expect(localStorage.getItem(`${QUARTER_CARD_STORAGE_PREFIX}W26`)).toBe(
      "closed",
    );

    await userEvent.click(screen.getByTestId("AdminQuarterCard-W26-title"));
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("inside")).toBeInTheDocument();
    expect(localStorage.getItem(`${QUARTER_CARD_STORAGE_PREFIX}W26`)).toBe(
      "open",
    );
    expect(QUARTER_CARD_STORAGE_PREFIX).toBe("adminQuarterCard.");
  });

  test("the keyboard toggles it too", async () => {
    renderCard({ quarter: "20261", ta: { id: 1 } });
    const toggle = screen.getByTestId("AdminQuarterCard-W26-toggle");
    toggle.focus();
    await userEvent.keyboard("{Enter}");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("inside")).toBeInTheDocument();
    await userEvent.keyboard(" ");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("what this browser remembers for the quarter wins over the default", () => {
    localStorage.setItem(`${QUARTER_CARD_STORAGE_PREFIX}W26`, "closed");
    const first = renderCard({
      quarter: "20261",
      ta: { id: 1 },
      defaultOpen: true,
    });
    expect(screen.queryByTestId("inside")).toBeNull();
    first.unmount();

    localStorage.setItem(`${QUARTER_CARD_STORAGE_PREFIX}W26`, "open");
    renderCard({ quarter: "20261", ta: { id: 1 } });
    expect(screen.getByTestId("inside")).toBeInTheDocument();
    // Another quarter is remembered on its own.
    expect(
      localStorage.getItem(`${QUARTER_CARD_STORAGE_PREFIX}S26`),
    ).toBeNull();
  });

  test("clicking a button in the header navigates and does not toggle the card", async () => {
    renderCard({ quarter: "20261", ta: { id: 1 }, ula: { id: 2 } });
    const toggle = screen.getByTestId("AdminQuarterCard-W26-toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(screen.getByTestId("AdminQuarterCard-W26-budget"));
    expect(screen.getByTestId("where")).toHaveTextContent("/admin/budget/W26");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("inside")).toBeNull();

    await userEvent.click(screen.getByTestId("AdminQuarterCard-W26-allocate"));
    expect(screen.getByTestId("where")).toHaveTextContent(
      "/admin/allocations/W26",
    );
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(
      screen.getByTestId("AdminQuarterCard-W26-instructorFeedback"),
    );
    expect(screen.getByTestId("where")).toHaveTextContent(
      "/admin/instructorFeedback/W26",
    );
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(localStorage.length).toBe(0);
  });

  test("a quarter with only a ULA recruitment says ULA slots", () => {
    renderCard({ quarter: "20262", ula: { id: 5 } });
    const allocate = screen.getByTestId("AdminQuarterCard-S26-allocate");
    expect(allocate).toHaveTextContent(/^Allocate ULA slots to Courses$/);
    expect(allocate).toHaveAttribute("href", "/admin/allocations/S26");
    expect(allocate).not.toHaveAttribute("aria-disabled");
  });

  test("a quarter with only a TA recruitment says TA slots", () => {
    renderCard({ quarter: "20263", ta: { id: 3 } });
    const allocate = screen.getByTestId("AdminQuarterCard-M26-allocate");
    expect(allocate).toHaveTextContent(/^Allocate TA slots to Courses$/);
    expect(allocate).toHaveAttribute("href", "/admin/allocations/M26");
  });

  test("with neither recruitment the button is greyed out and disabled, with the full label, and clicking it does not toggle", async () => {
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
    expect(within(screen.getByTestId("X-F26-card")).getByText("F26")).toBe(
      screen.getByTestId("X-F26-title"),
    );
    await userEvent.click(allocate);
    expect(screen.getByTestId("X-F26-toggle")).toHaveAttribute(
      "aria-expanded",
      "false",
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
