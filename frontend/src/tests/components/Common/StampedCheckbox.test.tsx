import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import StampedCheckbox from "main/components/Common/StampedCheckbox";

const STAMP = "2026-11-21T08:05:00";

describe("StampedCheckbox tests", () => {
  test("with a stamp it is checked, with the date and time under it", () => {
    render(
      <StampedCheckbox
        id="sent"
        label="Formal Offer Sent"
        stamp={STAMP}
        onChange={vi.fn()}
      />,
    );

    const box = screen.getByTestId("StampedCheckbox-checkbox");
    expect(box).toBeChecked();
    expect(box).toBeEnabled();
    expect(box).toHaveAttribute("type", "checkbox");
    expect(box).toHaveAttribute("id", "sent");
    expect(screen.getByTestId("StampedCheckbox")).toContainElement(box);

    const stamp = screen.getByTestId("StampedCheckbox-stamp");
    expect(screen.getByTestId("StampedCheckbox")).toContainElement(stamp);
    expect(screen.getByTestId("StampedCheckbox-stamp-date")).toHaveTextContent(
      "11/21/26",
    );
    expect(screen.getByTestId("StampedCheckbox-stamp-time")).toHaveTextContent(
      "8:05 AM",
    );
    // the stamp comes after the box
    expect(box.compareDocumentPosition(stamp)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  test("with no stamp it is unchecked, with nothing under it", () => {
    render(
      <StampedCheckbox
        id="sent"
        label="Formal Offer Sent"
        stamp={null}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("StampedCheckbox-checkbox")).not.toBeChecked();
    expect(
      screen.queryByTestId("StampedCheckbox-stamp"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("StampedCheckbox")).toHaveTextContent(
      /^Formal Offer Sent$/,
    );
  });

  test("the label is shown, tied to the box, and is the box's accessible name", () => {
    render(
      <StampedCheckbox
        id="sent"
        label="Formal Offer Sent"
        stamp={null}
        onChange={vi.fn()}
      />,
    );
    const label = screen.getByText("Formal Offer Sent");
    expect(label.tagName).toBe("LABEL");
    expect(label).toHaveAttribute("for", "sent");
    expect(label).toBeVisible();
    expect(screen.getByLabelText("Formal Offer Sent")).toBe(
      screen.getByTestId("StampedCheckbox-checkbox"),
    );
    expect(screen.getByRole("checkbox", { name: "Formal Offer Sent" })).toBe(
      screen.getByTestId("StampedCheckbox-checkbox"),
    );
  });

  test("hideLabel leaves the label out, keeping it as the accessible name", () => {
    render(
      <StampedCheckbox
        id="sent"
        label="Formal Offer Sent"
        stamp={STAMP}
        onChange={vi.fn()}
        hideLabel
      />,
    );
    expect(screen.queryByText("Formal Offer Sent")).not.toBeInTheDocument();
    expect(screen.getByTestId("StampedCheckbox")).toHaveTextContent(
      /^11\/21\/268:05 AM$/,
    );
    expect(screen.getByRole("checkbox", { name: "Formal Offer Sent" })).toBe(
      screen.getByTestId("StampedCheckbox-checkbox"),
    );
  });

  test("ticking an unchecked box calls onChange(true)", async () => {
    const onChange = vi.fn();
    render(
      <StampedCheckbox
        id="sent"
        label="Formal Offer Sent"
        stamp={null}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByTestId("StampedCheckbox-checkbox"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  test("unticking a checked box calls onChange(false)", async () => {
    const onChange = vi.fn();
    render(
      <StampedCheckbox
        id="sent"
        label="Formal Offer Sent"
        stamp={STAMP}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByTestId("StampedCheckbox-checkbox"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  test("the box shows the stamp it is given, not the click", () => {
    // Checked state follows the stamp prop alone: a rerender with a stamp checks it, without unchecks it.
    const { rerender } = render(
      <StampedCheckbox
        id="sent"
        label="Formal Offer Sent"
        stamp={null}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("StampedCheckbox-checkbox")).not.toBeChecked();
    rerender(
      <StampedCheckbox
        id="sent"
        label="Formal Offer Sent"
        stamp="2026-12-01T17:00:00"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("StampedCheckbox-checkbox")).toBeChecked();
    expect(screen.getByTestId("StampedCheckbox-stamp-date")).toHaveTextContent(
      "12/01/26",
    );
    expect(screen.getByTestId("StampedCheckbox-stamp-time")).toHaveTextContent(
      "5:00 PM",
    );
  });

  test("disabled: the box cannot be ticked and onChange is not called", async () => {
    const onChange = vi.fn();
    render(
      <StampedCheckbox
        id="sent"
        label="Formal Offer Sent"
        stamp={STAMP}
        onChange={onChange}
        disabled
      />,
    );
    const box = screen.getByTestId("StampedCheckbox-checkbox");
    expect(box).toBeDisabled();
    expect(box).toBeChecked();
    await userEvent.click(box);
    expect(onChange).not.toHaveBeenCalled();
  });

  test("the test ids take the given prefix", () => {
    render(
      <StampedCheckbox
        id="sent-7"
        label="Formal Offer Sent"
        stamp={STAMP}
        onChange={vi.fn()}
        testIdPrefix="row-7-sent"
      />,
    );
    expect(screen.getByTestId("row-7-sent")).toBeInTheDocument();
    expect(screen.getByTestId("row-7-sent-checkbox")).toBeChecked();
    expect(screen.getByTestId("row-7-sent-stamp-date")).toHaveTextContent(
      "11/21/26",
    );
    expect(screen.getByTestId("row-7-sent-stamp-time")).toHaveTextContent(
      "8:05 AM",
    );
    expect(screen.queryByTestId("StampedCheckbox")).not.toBeInTheDocument();
  });
});
