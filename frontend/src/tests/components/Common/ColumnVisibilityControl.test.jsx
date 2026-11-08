import { render, screen, waitFor } from "@testing-library/react";
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

  test("Show All shows every hidden column", async () => {
    const onToggle = renderControl(["room", "status"]);
    await userEvent.click(screen.getByTestId("Cols-toggle"));

    const selectAll = screen.getByTestId("Cols-select-all");
    expect(selectAll).toHaveTextContent("Show All");
    expect(selectAll).not.toHaveClass("disabled");
    await userEvent.click(selectAll);
    expect(onToggle.mock.calls).toEqual([
      ["room", false],
      ["status", false],
    ]);
  });

  test("Show All is disabled when nothing is hidden", async () => {
    const onToggle = renderControl([]);
    await userEvent.click(screen.getByTestId("Cols-toggle"));

    const selectAll = screen.getByTestId("Cols-select-all");
    expect(selectAll).toHaveClass("disabled");
    expect(selectAll).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(selectAll);
    expect(onToggle).not.toHaveBeenCalled();
  });

  test("Show None hides every shown column, and leaves hidden ones alone", async () => {
    const onToggle = renderControl(["room", "somethingElse"]);
    await userEvent.click(screen.getByTestId("Cols-toggle"));

    const selectNone = screen.getByTestId("Cols-select-none");
    expect(selectNone).toHaveTextContent("Show None");
    expect(selectNone).not.toHaveClass("disabled");
    await userEvent.click(selectNone);
    expect(onToggle.mock.calls).toEqual([
      ["section", true],
      ["status", true],
    ]);
  });

  test("Show None is disabled when every column is already hidden", async () => {
    const onToggle = renderControl(["section", "room", "status"]);
    await userEvent.click(screen.getByTestId("Cols-toggle"));

    const selectNone = screen.getByTestId("Cols-select-none");
    expect(selectNone).toHaveClass("disabled");
    expect(selectNone).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(selectNone);
    expect(onToggle).not.toHaveBeenCalled();
  });

  test("Show All and Show None come before the checkboxes and are keyboard operable", async () => {
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

  describe("course actions (issue #343)", () => {
    const courseChoices = [
      { id: "email", label: "Email" },
      { id: "course-1", label: "CMPSC 8" },
      { id: "course-2", label: "CMPSC 16" },
      { id: "course-3", label: "CMPSC 24" },
    ];
    const renderCourses = (hidden, courseColumns) => {
      const onToggle = vi.fn();
      render(
        <ColumnVisibilityControl
          choices={courseChoices}
          hidden={hidden}
          onToggle={onToggle}
          testIdPrefix="Cols"
          courseColumns={courseColumns}
        />,
      );
      return onToggle;
    };
    const mixed = [
      { id: "course-1", complete: false },
      { id: "course-2", complete: true },
      { id: "course-3", complete: true },
    ];
    const open = () => userEvent.click(screen.getByTestId("Cols-toggle"));

    test("without course columns neither action is shown", async () => {
      renderControl();
      await open();
      expect(screen.queryByTestId("Cols-show-all-courses")).toBeNull();
      expect(screen.queryByTestId("Cols-show-incomplete-courses")).toBeNull();
      expect(screen.queryByText(/Incomplete Courses/)).toBeNull();
    });

    test("an empty list of course columns shows neither action", async () => {
      renderCourses([], []);
      await open();
      expect(screen.queryByTestId("Cols-show-all-courses")).toBeNull();
      expect(screen.queryByTestId("Cols-show-incomplete-courses")).toBeNull();
    });

    test("with course columns both actions appear, after Show None and before the checkboxes", async () => {
      renderCourses([], mixed);
      await open();
      const all = screen.getByTestId("Cols-show-all-courses");
      const incomplete = screen.getByTestId("Cols-show-incomplete-courses");
      expect(all).toHaveTextContent("Show All Courses");
      expect(incomplete).toHaveTextContent("Show Only Incomplete Courses");
      const none = screen.getByTestId("Cols-select-none");
      const first = screen.getByLabelText("Email");
      for (const [a, b] of [
        [none, all],
        [all, incomplete],
        [incomplete, first],
      ]) {
        expect(
          a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      }
    });

    test("Show All Courses shows every hidden course column and touches nothing else", async () => {
      const onToggle = renderCourses(["email", "course-1", "course-3"], mixed);
      await open();
      await userEvent.click(screen.getByTestId("Cols-show-all-courses"));
      expect(onToggle).toHaveBeenCalledTimes(2);
      expect(onToggle).toHaveBeenCalledWith("course-1", false);
      expect(onToggle).toHaveBeenCalledWith("course-3", false);
    });

    test("Show All Courses does nothing when every course column is already shown", async () => {
      const onToggle = renderCourses(["email"], mixed);
      await open();
      await userEvent.click(screen.getByTestId("Cols-show-all-courses"));
      expect(onToggle).not.toHaveBeenCalled();
    });

    test("Show Only Incomplete Courses hides the complete ones and shows the incomplete ones (mixed)", async () => {
      const onToggle = renderCourses(["email", "course-1"], mixed);
      await open();
      await userEvent.click(screen.getByTestId("Cols-show-incomplete-courses"));
      expect(onToggle).toHaveBeenCalledTimes(3);
      expect(onToggle).toHaveBeenCalledWith("course-2", true);
      expect(onToggle).toHaveBeenCalledWith("course-3", true);
      expect(onToggle).toHaveBeenCalledWith("course-1", false);
    });

    test("Show Only Incomplete Courses leaves courses already in the right state alone", async () => {
      const onToggle = renderCourses(["course-2", "course-3"], mixed);
      await open();
      await userEvent.click(screen.getByTestId("Cols-show-incomplete-courses"));
      expect(onToggle).not.toHaveBeenCalled();
    });

    test("when every course is complete, Show Only Incomplete Courses hides them all", async () => {
      const onToggle = renderCourses(
        [],
        mixed.map((c) => ({ ...c, complete: true })),
      );
      await open();
      await userEvent.click(screen.getByTestId("Cols-show-incomplete-courses"));
      expect(onToggle.mock.calls).toEqual([
        ["course-1", true],
        ["course-2", true],
        ["course-3", true],
      ]);
    });

    test("when no course is complete, Show Only Incomplete Courses shows them all", async () => {
      const onToggle = renderCourses(
        ["course-1", "course-2", "course-3"],
        mixed.map((c) => ({ ...c, complete: false })),
      );
      await open();
      await userEvent.click(screen.getByTestId("Cols-show-incomplete-courses"));
      expect(onToggle.mock.calls).toEqual([
        ["course-1", false],
        ["course-2", false],
        ["course-3", false],
      ]);
    });

    test("the tooltip text is exact, shown on hover and on focus, and described to screen readers", async () => {
      renderCourses([], mixed);
      await open();
      const text =
        "This will hide all course columns except the ones where the number of assigned TAs/ULAs is currently less than the hiring target.";
      const incomplete = screen.getByTestId("Cols-show-incomplete-courses");
      const description = screen.getByTestId(
        "Cols-show-incomplete-courses-description",
      );
      expect(description).toHaveTextContent(text);
      expect(description.textContent).toBe(text);
      expect(incomplete).toHaveAttribute("aria-describedby", description.id);
      expect(incomplete).toHaveAccessibleDescription(text);
      expect(screen.queryByRole("tooltip")).toBeNull();
      await userEvent.hover(incomplete);
      expect(await screen.findByRole("tooltip")).toHaveTextContent(text);
      await userEvent.unhover(incomplete);
      await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
      incomplete.focus();
      expect(await screen.findByRole("tooltip")).toHaveTextContent(text);
    });

    test("Show All Courses has no tooltip or description", async () => {
      renderCourses([], mixed);
      await open();
      const all = screen.getByTestId("Cols-show-all-courses");
      expect(all).not.toHaveAttribute("aria-describedby");
      await userEvent.hover(all);
      expect(screen.queryByRole("tooltip")).toBeNull();
    });

    test("both actions work from the keyboard", async () => {
      const onToggle = renderCourses(["course-1"], mixed);
      await open();
      screen.getByTestId("Cols-show-all-courses").focus();
      await userEvent.keyboard("{Enter}");
      expect(onToggle).toHaveBeenCalledWith("course-1", false);
      onToggle.mockClear();
      screen.getByTestId("Cols-show-incomplete-courses").focus();
      await userEvent.keyboard("{Enter}");
      expect(onToggle).toHaveBeenCalledWith("course-2", true);
    });
  });

  describe("monospace labels (issue #355)", () => {
    test("a monospace choice keeps its spaces in a monospace span; a plain one is plain text", async () => {
      const onToggle = vi.fn();
      render(
        <ColumnVisibilityControl
          choices={[
            { id: "email", label: "Email" },
            { id: "course-1", label: "  8   (0100)", monospace: true },
            { id: "course-2", label: "190DD (0100)", monospace: false },
          ]}
          hidden={[]}
          onToggle={onToggle}
          testIdPrefix="Cols"
        />,
      );
      await userEvent.click(screen.getByTestId("Cols-toggle"));

      const aligned = screen.getByTestId("Cols-course-1-label");
      expect(aligned.textContent).toBe("  8   (0100)");
      expect(aligned).toHaveClass("font-monospace");
      expect(aligned.style.whiteSpace).toBe("pre");
      expect(aligned.closest("label")).toHaveAttribute("for", "Cols-course-1");
      expect(screen.queryByTestId("Cols-email-label")).toBeNull();
      expect(screen.queryByTestId("Cols-course-2-label")).toBeNull();
      expect(screen.getByLabelText("Email")).toBe(
        screen.getByTestId("Cols-email"),
      );
      expect(screen.getByLabelText("190DD (0100)")).toBe(
        screen.getByTestId("Cols-course-2"),
      );
      // The box is still the label's: clicking the aligned text toggles the column.
      await userEvent.click(aligned);
      expect(onToggle).toHaveBeenCalledWith("course-1", true);
    });
  });
});
