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
});
