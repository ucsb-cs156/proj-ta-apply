import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import RecruitmentCourseTable from "main/components/Recruitments/RecruitmentCourseTable";
import recruitmentCoursesFixtures from "fixtures/recruitmentCoursesFixtures";

const axiosMock = new AxiosMockAdapter(axios);

const notRemoved = recruitmentCoursesFixtures.fourCourses.filter(
  (c) => !c.removed,
);

function renderTable(courses = notRemoved, includeRemoved = false) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <RecruitmentCourseTable
          courses={courses}
          includeRemoved={includeRemoved}
          testIdPrefix="RecruitmentCourseTable"
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("RecruitmentCourseTable tests", () => {
  beforeEach(() => {
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock.onPut("/api/recruitmentcourses/removed").reply(200, {});
  });

  test("renders the offering details for each primary section", () => {
    renderTable();

    [
      "Course Number",
      "Section",
      "Title",
      "Instructor",
      "Days",
      "Time",
      "Room",
      "Enrolled",
      "Max",
      "Status",
      "Summer Session",
    ].forEach((header) => {
      expect(screen.getByText(header)).toBeInTheDocument();
    });

    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-1-col-instructor"),
    ).toHaveTextContent("CONRAD P");
    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-1-col-enrollment"),
    ).toHaveTextContent("120");
  });

  /** The two lectures are separate rows with their own instructors and enrollments. */
  test("shows both primary sections of a course as separate rows", () => {
    renderTable();

    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-1-col-courseId"),
    ).toHaveTextContent("CMPSC   156", { normalizeWhitespace: false });
    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-2-col-courseId"),
    ).toHaveTextContent("CMPSC   156", { normalizeWhitespace: false });
    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-1-col-section"),
    ).toHaveTextContent("0100");
    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-2-col-section"),
    ).toHaveTextContent("0200");
    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-2-col-instructor"),
    ).toHaveTextContent("SOMEONE ELSE");
  });

  test("course numbers keep their padding", () => {
    renderTable();

    const span = screen
      .getByTestId("RecruitmentCourseTable-cell-row-0-col-courseId")
      .querySelector("span");
    expect(span).toHaveStyle({ whiteSpace: "pre", fontFamily: "monospace" });
    expect(span.textContent).toBe("CMPSC     1A");
  });

  // ---- remove / unremove ----

  test("an ordinary row offers Remove", () => {
    renderTable();

    const button = screen.getByTestId(
      "RecruitmentCourseTable-cell-row-0-col-removed-button",
    );
    expect(button).toHaveTextContent("Remove");
    expect(button).toHaveClass("btn-danger");
  });

  /** The button's label and colour are the removed indicator; there is no separate column. */
  test("a removed row offers Unremove, in a different colour", () => {
    renderTable(recruitmentCoursesFixtures.fourCourses, true);

    const button = screen.getByTestId(
      "RecruitmentCourseTable-cell-row-3-col-removed-button",
    );
    expect(button).toHaveTextContent("Unremove");
    expect(button).toHaveClass("btn-success");
    expect(button).not.toHaveClass("btn-danger");
  });

  test("clicking Remove flags the row as removed", async () => {
    renderTable();

    await userEvent.click(
      screen.getByTestId(
        "RecruitmentCourseTable-cell-row-0-col-removed-button",
      ),
    );

    await waitFor(() => expect(axiosMock.history.put.length).toBe(1));
    expect(axiosMock.history.put[0].url).toBe(
      "/api/recruitmentcourses/removed",
    );
    expect(axiosMock.history.put[0].params).toEqual({ id: 1, removed: true });
  });

  test("clicking Unremove puts the row back", async () => {
    renderTable(recruitmentCoursesFixtures.fourCourses, true);

    await userEvent.click(
      screen.getByTestId(
        "RecruitmentCourseTable-cell-row-3-col-removed-button",
      ),
    );

    await waitFor(() => expect(axiosMock.history.put.length).toBe(1));
    expect(axiosMock.history.put[0].params).toEqual({ id: 4, removed: false });
  });

  test("renders an empty table without crashing", () => {
    renderTable([]);
    expect(screen.getByText("Course Number")).toBeInTheDocument();
    expect(
      screen.queryByTestId("RecruitmentCourseTable-cell-row-0-col-courseId"),
    ).toBeNull();
  });

  test("tolerates a non-array courses prop", () => {
    renderTable(null);
    expect(screen.getByText("Course Number")).toBeInTheDocument();
  });
});
