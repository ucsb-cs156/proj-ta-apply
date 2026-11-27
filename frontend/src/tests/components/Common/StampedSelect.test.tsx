import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import StampedSelect from "main/components/Common/StampedSelect";

const OPTIONS = [
  { value: "DONE", label: "Done" },
  { value: "NOT_NEEDED", label: "Not needed" },
];
const LABEL = "New Hire form done (or not needed)";
const STAMP = "2026-11-21T08:05:00";

const renderSelect = (
  props: Partial<React.ComponentProps<typeof StampedSelect>> = {},
) =>
  render(
    <StampedSelect
      id="new-hire"
      label={LABEL}
      options={OPTIONS}
      value={null}
      stamp={null}
      onChange={vi.fn()}
      {...props}
    />,
  );

describe("StampedSelect tests", () => {
  test("offers a blank choice and then the options, in order", () => {
    renderSelect();
    const select = screen.getByTestId("StampedSelect-select");
    expect(select.tagName).toBe("SELECT");
    expect(select).toHaveAttribute("id", "new-hire");
    expect(select).toBeEnabled();
    const options = within(select).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "",
      "Done",
      "Not needed",
    ]);
    expect(options.map((o) => (o as HTMLOptionElement).value)).toEqual([
      "",
      "DONE",
      "NOT_NEEDED",
    ]);
    expect(screen.getByTestId("StampedSelect")).toContainElement(select);
  });

  test("a null value is the blank choice, with nothing under it", () => {
    renderSelect();
    expect(screen.getByTestId("StampedSelect-select")).toHaveValue("");
    expect(screen.queryByTestId("StampedSelect-stamp")).not.toBeInTheDocument();
  });

  test.each([
    ["DONE", "Done"],
    ["NOT_NEEDED", "Not needed"],
  ])("value %s shows %s with the stamp under it", (value, text) => {
    renderSelect({ value, stamp: STAMP });
    const select = screen.getByTestId("StampedSelect-select");
    expect(select).toHaveValue(value);
    expect(select).toHaveDisplayValue(text);
    const stamp = screen.getByTestId("StampedSelect-stamp");
    expect(screen.getByTestId("StampedSelect")).toContainElement(stamp);
    expect(screen.getByTestId("StampedSelect-stamp-date")).toHaveTextContent(
      "11/21/26",
    );
    expect(screen.getByTestId("StampedSelect-stamp-time")).toHaveTextContent(
      "8:05 AM",
    );
    expect(select.compareDocumentPosition(stamp)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  test("the label is shown above the select, tied to it, and is its accessible name", () => {
    renderSelect();
    const label = screen.getByText(LABEL);
    expect(label.tagName).toBe("LABEL");
    expect(label).toHaveAttribute("for", "new-hire");
    const select = screen.getByTestId("StampedSelect-select");
    expect(screen.getByLabelText(LABEL)).toBe(select);
    expect(screen.getByRole("combobox", { name: LABEL })).toBe(select);
    expect(label.compareDocumentPosition(select)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  test("hideLabel leaves the label out, keeping it as the accessible name", () => {
    renderSelect({ hideLabel: true, value: "DONE", stamp: STAMP });
    expect(screen.queryByText(LABEL)).not.toBeInTheDocument();
    expect(screen.getByTestId("StampedSelect")).toHaveTextContent(
      /^DoneNot needed11\/21\/268:05 AM$/,
    );
    expect(screen.getByRole("combobox", { name: LABEL })).toBe(
      screen.getByTestId("StampedSelect-select"),
    );
  });

  test("choosing an option calls onChange with its value", async () => {
    const onChange = vi.fn();
    renderSelect({ onChange });
    await userEvent.selectOptions(
      screen.getByTestId("StampedSelect-select"),
      "NOT_NEEDED",
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("NOT_NEEDED");
  });

  test("choosing the blank option calls onChange(null)", async () => {
    const onChange = vi.fn();
    renderSelect({ onChange, value: "DONE", stamp: STAMP });
    await userEvent.selectOptions(
      screen.getByTestId("StampedSelect-select"),
      "",
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  test("the select shows the value and stamp it is given, not the choice", () => {
    const { rerender } = renderSelect();
    expect(screen.getByTestId("StampedSelect-select")).toHaveValue("");
    rerender(
      <StampedSelect
        id="new-hire"
        label={LABEL}
        options={OPTIONS}
        value="DONE"
        stamp="2026-12-01T17:00:00"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("StampedSelect-select")).toHaveValue("DONE");
    expect(screen.getByTestId("StampedSelect-stamp-date")).toHaveTextContent(
      "12/01/26",
    );
    expect(screen.getByTestId("StampedSelect-stamp-time")).toHaveTextContent(
      "5:00 PM",
    );
  });

  test("disabled: the select cannot be changed and onChange is not called", async () => {
    const onChange = vi.fn();
    renderSelect({ onChange, value: "DONE", stamp: STAMP, disabled: true });
    const select = screen.getByTestId("StampedSelect-select");
    expect(select).toBeDisabled();
    expect(select).toHaveValue("DONE");
    await userEvent.selectOptions(select, "NOT_NEEDED").catch(() => undefined);
    expect(onChange).not.toHaveBeenCalled();
    expect(select).toHaveValue("DONE");
  });

  test("the test ids take the given prefix", () => {
    renderSelect({
      value: "DONE",
      stamp: STAMP,
      testIdPrefix: "row-7-new-hire",
    });
    expect(screen.getByTestId("row-7-new-hire")).toBeInTheDocument();
    expect(screen.getByTestId("row-7-new-hire-select")).toHaveValue("DONE");
    expect(screen.getByTestId("row-7-new-hire-stamp-date")).toHaveTextContent(
      "11/21/26",
    );
    expect(screen.getByTestId("row-7-new-hire-stamp-time")).toHaveTextContent(
      "8:05 AM",
    );
    expect(screen.queryByTestId("StampedSelect")).not.toBeInTheDocument();
  });
});
