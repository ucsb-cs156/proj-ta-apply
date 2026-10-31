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

  test("Show all columns shows every hidden column, and is disabled when none is hidden", async () => {
    const onToggle = renderControl(["room", "status"]);
    await userEvent.click(screen.getByTestId("Cols-toggle"));

    const showAll = screen.getByTestId("Cols-show-all");
    expect(showAll).toHaveTextContent("Show all columns");
    expect(showAll).not.toHaveClass("disabled");
    await userEvent.click(showAll);
    expect(onToggle.mock.calls).toEqual([
      ["room", false],
      ["status", false],
    ]);
  });

  test("Show all columns is disabled when nothing is hidden", async () => {
    const onToggle = renderControl([]);
    await userEvent.click(screen.getByTestId("Cols-toggle"));

    const showAll = screen.getByTestId("Cols-show-all");
    expect(showAll).toHaveClass("disabled");
    expect(showAll).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(showAll);
    expect(onToggle).not.toHaveBeenCalled();
  });
});
