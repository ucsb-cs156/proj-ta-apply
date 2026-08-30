import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import CourseTable from "main/components/Courses/CourseTable";
import coursesFixtures from "fixtures/coursesFixtures";

const axiosMock = new AxiosMockAdapter(axios);

function renderTable(courses = coursesFixtures.threeCourses) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <CourseTable courses={courses} testIdPrefix="CourseTable" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CourseTable tests", () => {
  beforeEach(() => {
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock.onPut("/api/courses/flags").reply(200, {});
  });

  test("renders the expected headers and rows", () => {
    renderTable();

    ["Course Number", "Title", "TA", "ULA"].forEach((header) => {
      expect(screen.getByText(header)).toBeInTheDocument();
    });

    // normalizeWhitespace: false because the padding is exactly what we are asserting.
    expect(
      screen.getByTestId("CourseTable-cell-row-0-col-courseId"),
    ).toHaveTextContent("CMPSC   130A", { normalizeWhitespace: false });
    expect(
      screen.getByTestId("CourseTable-cell-row-1-col-title"),
    ).toHaveTextContent("Advanced Applications Programming");
  });

  test("checkboxes reflect the current flags", () => {
    renderTable();

    // row 0: needsTa false, needsUla true
    expect(
      screen.getByTestId("CourseTable-cell-row-0-col-needsTa-checkbox"),
    ).not.toBeChecked();
    expect(
      screen.getByTestId("CourseTable-cell-row-0-col-needsUla-checkbox"),
    ).toBeChecked();
    // row 2: both false
    expect(
      screen.getByTestId("CourseTable-cell-row-2-col-needsTa-checkbox"),
    ).not.toBeChecked();
    expect(
      screen.getByTestId("CourseTable-cell-row-2-col-needsUla-checkbox"),
    ).not.toBeChecked();
  });

  test("ticking the TA box PUTs both flags, flipping only TA", async () => {
    renderTable();

    await userEvent.click(
      screen.getByTestId("CourseTable-cell-row-0-col-needsTa-checkbox"),
    );

    await waitFor(() => expect(axiosMock.history.put.length).toBe(1));
    expect(axiosMock.history.put[0].params).toEqual({
      courseId: "CMPSC   130A",
      needsTa: true,
      needsUla: true,
    });
  });

  test("unticking the ULA box PUTs both flags, flipping only ULA", async () => {
    renderTable();

    await userEvent.click(
      screen.getByTestId("CourseTable-cell-row-1-col-needsUla-checkbox"),
    );

    await waitFor(() => expect(axiosMock.history.put.length).toBe(1));
    expect(axiosMock.history.put[0].params).toEqual({
      courseId: "CMPSC   156",
      needsTa: true,
      needsUla: false,
    });
  });

  test("renders an empty table when given no courses", () => {
    renderTable([]);
    expect(screen.getByText("Course Number")).toBeInTheDocument();
    expect(
      screen.queryByTestId("CourseTable-cell-row-0-col-courseId"),
    ).toBeNull();
  });

  test("tolerates a non-array courses prop", () => {
    // Passing undefined would just hit renderTable's default, so pass a non-array explicitly.
    renderTable(null);
    expect(screen.getByText("Course Number")).toBeInTheDocument();
    expect(
      screen.queryByTestId("CourseTable-cell-row-0-col-courseId"),
    ).toBeNull();
  });

  test("columns are ordered TA, ULA, Course Number, Title", () => {
    renderTable();

    const headers = Array.from(
      document.querySelectorAll('[data-testid="CourseTable"] thead th'),
    ).map((th) => th.textContent.trim());

    expect(headers).toEqual(["TA", "ULA", "Course Number", "Title"]);
  });

  test("the course number column shrinks to its content and Title takes the slack", () => {
    renderTable();

    const courseIdCell = screen.getByTestId(
      "CourseTable-cell-row-0-col-courseId",
    );
    expect(courseIdCell).toHaveStyle({ width: "1%", whiteSpace: "nowrap" });

    const titleCell = screen.getByTestId("CourseTable-cell-row-0-col-title");
    expect(titleCell).toHaveStyle({ width: "100%" });
  });

  test("the course number keeps its padding visible", () => {
    renderTable();

    const span = screen
      .getByTestId("CourseTable-cell-row-0-col-courseId")
      .querySelector("span");
    expect(span).toHaveStyle({ whiteSpace: "pre", fontFamily: "monospace" });
    expect(span.textContent).toBe("CMPSC   130A");
  });
});
