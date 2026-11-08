import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";
import CollapsibleCard from "main/components/Common/CollapsibleCard";

const renderCard = (props = {}) =>
  render(
    <CollapsibleCard title="Change History" storageKey="demo" {...props}>
      <p data-testid="content">Hello</p>
    </CollapsibleCard>,
  );

describe("CollapsibleCard", () => {
  beforeEach(() => localStorage.clear());

  test("is closed by default and does not render its body", () => {
    renderCard();
    const toggle = screen.getByTestId("CollapsibleCard-toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveTextContent("▸ Change History");
    expect(screen.queryByTestId("content")).toBeNull();
    expect(screen.queryByTestId("CollapsibleCard-body")).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  test("the title is a level 2 heading named by the title alone", () => {
    renderCard();
    expect(
      screen.getByRole("heading", { level: 2, name: "Change History" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("CollapsibleCard-subtitle"),
    ).not.toBeInTheDocument();
  });

  /** Issue #391: a smaller line beneath the title, on the header, clickable with it. */
  test("a subtitle is shown beneath the title in a smaller font, whether open or closed", async () => {
    renderCard({ subtitle: "Track changes to hiring targets" });

    const toggle = screen.getByTestId("CollapsibleCard-toggle");
    const subtitle = screen.getByTestId("CollapsibleCard-subtitle");
    expect(toggle).toContainElement(subtitle);
    expect(subtitle).toHaveTextContent("Track changes to hiring targets");
    expect(subtitle).toHaveClass(
      "d-block",
      "fs-6",
      "fw-normal",
      "text-body-secondary",
      "mt-1",
    );
    expect(toggle).toHaveTextContent(
      "▸ Change HistoryTrack changes to hiring targets",
    );
    // Still the one heading, with the title first.
    expect(
      screen.getByRole("heading", { level: 2, name: /^Change History/ }),
    ).toContainElement(subtitle);

    await userEvent.click(toggle);
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.getByTestId("CollapsibleCard-subtitle")).toHaveTextContent(
      "Track changes to hiring targets",
    );
  });

  test("clicking toggles it open and closed, saving each setting", async () => {
    renderCard();
    const toggle = screen.getByTestId("CollapsibleCard-toggle");

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveTextContent("▾ Change History");
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(localStorage.getItem("collapsibleCard.demo")).toBe("open");

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("content")).toBeNull();
    expect(localStorage.getItem("collapsibleCard.demo")).toBe("closed");
  });

  test("starts open when local storage says it was left open", () => {
    localStorage.setItem("collapsibleCard.demo", "open");
    renderCard();
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.getByTestId("CollapsibleCard-toggle")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  test("starts closed when local storage says closed or holds something else", () => {
    localStorage.setItem("collapsibleCard.demo", "closed");
    const first = renderCard();
    expect(screen.queryByTestId("content")).toBeNull();
    first.unmount();

    localStorage.setItem("collapsibleCard.demo", "true");
    renderCard();
    expect(screen.queryByTestId("content")).toBeNull();
  });

  test("each storage key is remembered separately", async () => {
    renderCard({ storageKey: "one" });
    await userEvent.click(screen.getByTestId("CollapsibleCard-toggle"));
    expect(localStorage.getItem("collapsibleCard.one")).toBe("open");
    expect(localStorage.getItem("collapsibleCard.two")).toBeNull();
  });

  test("the test id prefix names the card, toggle and body", async () => {
    renderCard({ testIdPrefix: "Mine" });
    expect(screen.getByTestId("Mine")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("Mine-toggle"));
    expect(screen.getByTestId("Mine-body")).toContainElement(
      screen.getByTestId("content"),
    );
  });
});
