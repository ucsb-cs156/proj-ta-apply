import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import SavedOnChangeInput from "main/components/Budget/SavedOnChangeInput";
import { isValidDollars } from "main/utils/currency";

describe("SavedOnChangeInput tests", () => {
  const renderInput = (props = {}) => {
    const onSave = vi.fn();
    render(
      <SavedOnChangeInput
        id="Box"
        label="Amount:"
        stored="12.00"
        isValid={isValidDollars}
        onSave={onSave}
        {...props}
      />,
    );
    return onSave;
  };

  test("shows the label, prefix, stored value and default width", () => {
    renderInput({ prefix: "$" });

    const box = screen.getByLabelText("Amount:");
    expect(box).toBe(screen.getByTestId("Box"));
    expect(box).toHaveValue("12.00");
    expect(box).toHaveAttribute("type", "text");
    expect(box).toHaveAttribute("inputmode", "decimal");
    expect(box).not.toBeDisabled();
    expect(screen.getByText("$")).toHaveClass("input-group-text");
    expect(screen.getByText("$").parentElement).toHaveClass("input-group-sm");
    expect(screen.getByText("$").parentElement.style.width).toBe("10em");
    expect(screen.getByText("Amount:")).toHaveClass("mb-0");
    expect(screen.getByText("Amount:").parentElement).toHaveClass("mb-2");
    expect(screen.queryByTestId("Box-hint")).not.toBeInTheDocument();
  });

  test("without a label there is no label element and no space under the group, and a label elsewhere names the box (issue #388)", () => {
    const onSave = vi.fn();
    render(
      <table>
        <tbody>
          <tr>
            <td>
              <label htmlFor="Box">In the cell:</label>
            </td>
            <td>
              <SavedOnChangeInput
                id="Box"
                stored="12.00"
                isValid={isValidDollars}
                onSave={onSave}
              />
            </td>
          </tr>
        </tbody>
      </table>,
    );

    const box = screen.getByLabelText("In the cell:");
    expect(box).toBe(screen.getByTestId("Box"));
    expect(document.querySelectorAll("label")).toHaveLength(1);
    expect(box.parentElement.parentElement).toHaveClass("mb-0");
    expect(box.parentElement.parentElement).not.toHaveClass("mb-2");
    expect(box.parentElement.parentElement).not.toHaveClass("d-flex");
  });

  test("has no prefix unless asked, and takes a width", () => {
    renderInput({ width: "6em" });

    expect(document.querySelector(".input-group-text")).toBeNull();
    expect(screen.getByTestId("Box").parentElement.style.width).toBe("6em");
  });

  test("a valid value is saved as soon as it is typed", async () => {
    const onSave = renderInput();
    const box = screen.getByTestId("Box");

    await userEvent.clear(box);
    await userEvent.type(box, "45.5");

    // "4", "45" and "45.5" were valid; "45." was not.
    expect(onSave.mock.calls.map((c) => c[0])).toEqual(["4", "45", "45.5"]);
    expect(box).toHaveValue("45.5");
    expect(box).not.toHaveClass("is-invalid");
  });

  test("an invalid value is flagged, never saved, and reverts on blur", async () => {
    const onSave = renderInput();
    const box = screen.getByTestId("Box");

    await userEvent.clear(box);
    expect(box).toHaveValue("");
    expect(box).toHaveClass("is-invalid");
    await userEvent.type(box, "-");
    expect(box).toHaveValue("-");
    expect(box).toHaveClass("is-invalid");
    expect(onSave).not.toHaveBeenCalled();

    await userEvent.tab();

    expect(box).toHaveValue("12.00");
    expect(box).not.toHaveClass("is-invalid");
    expect(onSave).not.toHaveBeenCalled();
  });

  test("a saved value also shows the stored value again on blur", async () => {
    renderInput();
    const box = screen.getByTestId("Box");

    await userEvent.clear(box);
    await userEvent.type(box, "9");
    await userEvent.tab();

    expect(box).toHaveValue("12.00");
  });

  test("disabled shows an empty box and the hint", () => {
    const onSave = renderInput({
      disabled: true,
      hint: "No TA recruitment for F26.",
    });

    const box = screen.getByTestId("Box");
    expect(box).toBeDisabled();
    expect(box).toHaveValue("");
    expect(screen.getByTestId("Box-hint")).toHaveTextContent(
      "No TA recruitment for F26.",
    );
    expect(screen.getByTestId("Box-hint")).toHaveClass("text-muted");
    expect(onSave).not.toHaveBeenCalled();
  });

  test("a hint can be shown while enabled too", () => {
    renderInput({ hint: "Per quarter." });
    expect(screen.getByTestId("Box-hint")).toHaveTextContent("Per quarter.");
    expect(screen.getByTestId("Box")).toHaveValue("12.00");
  });

  test("an invalid message is shown by the box, and the box is flagged when what is typed is invalid", async () => {
    renderInput({ invalidMessage: "Must be dollars and cents." });
    const box = screen.getByTestId("Box");
    expect(screen.getByTestId("Box-invalid")).toHaveTextContent(
      "Must be dollars and cents.",
    );
    expect(screen.getByTestId("Box-invalid")).toHaveClass("invalid-feedback");

    await userEvent.clear(box);
    await userEvent.type(box, "x");

    expect(box).toHaveClass("is-invalid");
  });

  test("has no invalid message unless given one, and no tooltip", () => {
    renderInput();

    expect(screen.queryByTestId("Box-invalid")).toBeNull();
    expect(document.querySelector("[title]")).toBeNull();
  });

  test("a title is a tooltip over the label and the box", () => {
    renderInput({ title: "What this is." });

    expect(screen.getByTestId("Box").closest("[title]")).toHaveAttribute(
      "title",
      "What this is.",
    );
    expect(screen.getByText("Amount:").closest("[title]")).toBe(
      screen.getByTestId("Box").closest("[title]"),
    );
  });

  test("every keystroke, valid or not, says the box is being edited, before it is saved; leaving it says the editing is over (issue #426)", async () => {
    const calls = [];
    renderInput({
      onSave: (value) => calls.push(`save ${value}`),
      onEdit: () => calls.push("edit"),
      onEditEnd: () => calls.push("end"),
    });
    const box = screen.getByTestId("Box");

    await userEvent.clear(box);
    await userEvent.type(box, "5");
    expect(calls).toEqual(["edit", "edit", "save 5"]);
    await userEvent.tab();

    expect(calls).toEqual(["edit", "edit", "save 5", "end"]);
  });

  test("what is typed stays in the box when the stored value changes, until the box is left (issue #426)", async () => {
    const props = {
      id: "Box",
      label: "Amount:",
      isValid: isValidDollars,
      onSave: vi.fn(),
    };
    const { rerender } = render(<SavedOnChangeInput {...props} stored="12" />);
    const box = screen.getByTestId("Box");
    await userEvent.clear(box);
    await userEvent.type(box, "5");

    rerender(<SavedOnChangeInput {...props} stored="45" />);
    expect(box).toHaveValue("5");

    await userEvent.tab();
    expect(box).toHaveValue("45");
  });

  test("a box that has focus but nothing typed shows a changed stored value (issue #426)", async () => {
    const props = {
      id: "Box",
      label: "Amount:",
      isValid: isValidDollars,
      onSave: vi.fn(),
    };
    const { rerender } = render(<SavedOnChangeInput {...props} stored="12" />);
    await userEvent.click(screen.getByTestId("Box"));

    rerender(<SavedOnChangeInput {...props} stored="45" />);

    expect(screen.getByTestId("Box")).toHaveFocus();
    expect(screen.getByTestId("Box")).toHaveValue("45");
  });

  test("works without the editing callbacks", async () => {
    const onSave = renderInput();
    const box = screen.getByTestId("Box");

    await userEvent.clear(box);
    await userEvent.type(box, "5");
    await userEvent.tab();

    expect(onSave).toHaveBeenCalledWith("5");
  });
});
