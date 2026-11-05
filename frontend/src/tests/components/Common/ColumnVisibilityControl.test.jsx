import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import ColumnVisibilityControl from "main/components/Common/ColumnVisibilityControl";

const choices = [
  { id: "section", label: "Section" },
  { id: "room", label: "Room" },
  { id: "status", label: "Status" },
];

describe("ColumnVisibilityControl tests", () => {
  const renderControl = (hidden = [], props = {}) => {
    const onToggle = vi.fn();
    render(
      <ColumnVisibilityControl
        choices={choices}
        hidden={hidden}
        onToggle={onToggle}
        testIdPrefix="Cols"
        {...props}
      />,
    );
    return onToggle;
  };

  test("the toggle says Columns, and how many are hidden", async () => {
    renderControl();
    const toggle = screen.getByTestId("Cols-toggle");
    expect(toggle).toHaveTextContent("Columns");
    expect(toggle).not.toHaveTextContent("hidden");
    expect(toggle).toHaveClass("btn-outline-secondary", "btn-sm");
    expect(toggle).toHaveAttribute("id", "Cols-toggle");
    expect(screen.getByTestId("Cols")).toBeInTheDocument();
  });

  test("counts only hidden ids that are among the choices", () => {
    renderControl(["room", "status", "somethingElse"]);
    expect(screen.getByTestId("Cols-toggle")).toHaveTextContent(
      "Columns (2 hidden)",
    );
  });

  test("has a default test id prefix", () => {
    render(
      <ColumnVisibilityControl
        choices={choices}
        hidden={[]}
        onToggle={() => {}}
      />,
    );
    expect(
      screen.getByTestId("ColumnVisibilityControl-toggle"),
    ).toBeInTheDocument();
  });

  test("opening the menu lists a ticked box per shown column and an unticked one per hidden column", async () => {
    renderControl(["room"]);
    await userEvent.click(screen.getByTestId("Cols-toggle"));

    expect(screen.getByLabelText("Section")).toBeChecked();
    expect(screen.getByLabelText("Room")).not.toBeChecked();
    expect(screen.getByLabelText("Status")).toBeChecked();
    expect(screen.getByTestId("Cols-room")).toBe(screen.getByLabelText("Room"));
  });

  test("unticking hides and ticking shows, and the menu stays open", async () => {
    const onToggle = renderControl(["room"]);
    await userEvent.click(screen.getByTestId("Cols-toggle"));

    await userEvent.click(screen.getByLabelText("Section"));
    expect(onToggle).toHaveBeenCalledWith("section", true);
    await userEvent.click(screen.getByLabelText("Room"));
    expect(onToggle).toHaveBeenCalledWith("room", false);
    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("Status")).toBeVisible();
  });

  test("Select All shows every hidden column", async () => {
    const onToggle = renderControl(["room", "status"]);
    await userEvent.click(screen.getByTestId("Cols-toggle"));

    const selectAll = screen.getByTestId("Cols-select-all");
    expect(selectAll).toHaveTextContent("Select All");
    expect(selectAll).not.toHaveClass("disabled");
    await userEvent.click(selectAll);
    expect(onToggle.mock.calls).toEqual([
      ["room", false],
      ["status", false],
    ]);
  });

  test("Select All is disabled when nothing is hidden", async () => {
    const onToggle = renderControl([]);
    await userEvent.click(screen.getByTestId("Cols-toggle"));

    const selectAll = screen.getByTestId("Cols-select-all");
    expect(selectAll).toHaveClass("disabled");
    expect(selectAll).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(selectAll);
    expect(onToggle).not.toHaveBeenCalled();
  });

  test("Select None hides every shown column, and leaves hidden ones alone", async () => {
    const onToggle = renderControl(["room", "somethingElse"]);
    await userEvent.click(screen.getByTestId("Cols-toggle"));

    const selectNone = screen.getByTestId("Cols-select-none");
    expect(selectNone).toHaveTextContent("Select None");
    expect(selectNone).not.toHaveClass("disabled");
    await userEvent.click(selectNone);
    expect(onToggle.mock.calls).toEqual([
      ["section", true],
      ["status", true],
    ]);
  });

  test("Select None is disabled when every column is already hidden", async () => {
    const onToggle = renderControl(["section", "room", "status"]);
    await userEvent.click(screen.getByTestId("Cols-toggle"));

    const selectNone = screen.getByTestId("Cols-select-none");
    expect(selectNone).toHaveClass("disabled");
    expect(selectNone).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(selectNone);
    expect(onToggle).not.toHaveBeenCalled();
  });

  test("Select All and Select None come before the checkboxes and are keyboard operable", async () => {
    const onToggle = renderControl(["room"]);
    await userEvent.click(screen.getByTestId("Cols-toggle"));

    const selectAll = screen.getByTestId("Cols-select-all");
    const first = screen.getByLabelText("Section");
    expect(
      selectAll.compareDocumentPosition(first) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    selectAll.focus();
    await userEvent.keyboard("{Enter}");
    expect(onToggle).toHaveBeenCalledWith("room", false);
  });
});
