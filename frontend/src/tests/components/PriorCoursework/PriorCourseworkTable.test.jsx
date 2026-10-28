import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import PriorCourseworkTable from "main/components/PriorCoursework/PriorCourseworkTable";
import priorCourseworkFixtures from "fixtures/priorCourseworkFixtures";

function renderTable({
  courses = priorCourseworkFixtures.threeCourses,
  readOnly = false,
} = {}) {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  render(
    <PriorCourseworkTable
      courses={courses}
      onEdit={onEdit}
      onDelete={onDelete}
      readOnly={readOnly}
      testIdPrefix="T"
    />,
  );
  return { onEdit, onDelete };
}

/** The column's cells top to bottom, in display order (row test ids keep their original index). */
const COLUMN_POSITION = {
  school: 1,
  courseNumber: 2,
  courseTitle: 3,
  term: 4,
  grade: 5,
};
const columnText = (column) =>
  [
    ...screen
      .getByTestId("T")
      .querySelectorAll(`tbody tr td:nth-child(${COLUMN_POSITION[column]})`),
  ].map((td) => td.textContent);

describe("PriorCourseworkTable tests", () => {
  test("shows every field, with School reading UCSB or the other school", () => {
    renderTable();

    expect(
      [...screen.getByTestId("T").querySelectorAll("thead th")].map((th) =>
        th.textContent.trim(),
      ),
    ).toEqual(["School", "Course Number", "Course Title", "Term", "Grade", ""]);
    expect(columnText("school")).toEqual([
      "UCSB",
      "UCSB",
      "Another University",
    ]);
    expect(columnText("courseNumber")).toEqual([
      "CMPSC 263",
      "CMPSC 290A",
      "CS 143",
    ]);
    expect(columnText("courseTitle")).toEqual([
      "Runtime Systems",
      "Compilers Seminar",
      "Compilers",
    ]);
    expect(columnText("term")).toEqual(["F25", "W26", "Spring 2024"]);
    expect(columnText("grade")).toEqual(["A", "IP", "A-"]);
  });

  /** Every data column sorts on a header click; the actions column does not. */
  test("sorts by any column when its header is clicked", async () => {
    renderTable();

    await userEvent.click(
      screen.getByTestId("T-header-courseNumber-sort-header"),
    );
    expect(columnText("courseNumber")).toEqual([
      "CMPSC 263",
      "CMPSC 290A",
      "CS 143",
    ]);
    await userEvent.click(
      screen.getByTestId("T-header-courseNumber-sort-header"),
    );
    expect(columnText("courseNumber")).toEqual([
      "CS 143",
      "CMPSC 290A",
      "CMPSC 263",
    ]);

    await userEvent.click(screen.getByTestId("T-header-school-sort-header"));
    expect(columnText("school")).toEqual([
      "Another University",
      "UCSB",
      "UCSB",
    ]);

    await userEvent.click(screen.getByTestId("T-header-grade-sort-header"));
    expect(columnText("grade")).toEqual(["A", "A-", "IP"]);

    // The actions column has nothing to sort by: clicking its header changes nothing.
    await userEvent.click(screen.getByTestId("T-header-actions-sort-header"));
    expect(columnText("grade")).toEqual(["A", "A-", "IP"]);
  });

  test("Edit and Delete report the row's position", async () => {
    const { onEdit, onDelete } = renderTable();

    await userEvent.click(screen.getByTestId("T-cell-row-1-col-edit-button"));
    expect(onEdit).toHaveBeenCalledWith(1);
    await userEvent.click(screen.getByTestId("T-cell-row-2-col-delete-button"));
    expect(onDelete).toHaveBeenCalledWith(2);
  });

  test("read-only has no Edit or Delete column", () => {
    renderTable({ readOnly: true });

    expect(
      [...screen.getByTestId("T").querySelectorAll("thead th")].map((th) =>
        th.textContent.trim(),
      ),
    ).toEqual(["School", "Course Number", "Course Title", "Term", "Grade"]);
    expect(screen.queryByTestId("T-cell-row-0-col-edit-button")).toBeNull();
  });

  test("uses PriorCourseworkTable as the default test id prefix", () => {
    render(
      <PriorCourseworkTable
        courses={priorCourseworkFixtures.threeCourses}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(
      screen.getByTestId("PriorCourseworkTable-cell-row-0-col-courseNumber"),
    ).toHaveTextContent("CMPSC 263");
    expect(
      screen.getByTestId("PriorCourseworkTable-cell-row-0-col-edit-button"),
    ).toBeInTheDocument();
  });

  test("tolerates a non-array courses prop", () => {
    renderTable({ courses: null });
    expect(screen.getByText("Course Number")).toBeInTheDocument();
  });
});
