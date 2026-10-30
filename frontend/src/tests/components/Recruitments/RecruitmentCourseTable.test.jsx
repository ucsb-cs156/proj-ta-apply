import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import RecruitmentCourseTable, {
  STALE_LABEL,
} from "main/components/Recruitments/RecruitmentCourseTable";
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

  /** Issue #122: a stale row says so beside its status; a fresh one does not. */
  test("a stale row carries a warning badge in the Status column", () => {
    renderTable([notRemoved[0], recruitmentCoursesFixtures.oneStale]);

    const badge = screen.getByTestId("RecruitmentCourseTable-cell-row-1-stale");
    expect(badge).toHaveTextContent("Stale / not in API");
    expect(STALE_LABEL).toBe("Stale / not in API");
    expect(badge).toHaveClass("badge", "bg-warning", "text-dark", "ms-2");
    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-1-col-status"),
    ).toContainElement(badge);
    // The status itself is still shown.
    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-1-col-status"),
    ).toHaveTextContent(/^closed/);
    expect(
      screen.queryByTestId("RecruitmentCourseTable-cell-row-0-stale"),
    ).toBeNull();
    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-0-col-status"),
    ).toHaveTextContent(/^open$/);
    // The Remove button is still offered, so the admin can drop it for good.
    expect(
      screen.getByTestId(
        "RecruitmentCourseTable-cell-row-1-col-removed-button",
      ),
    ).toHaveTextContent("Remove");
  });

  /** Issue #125: a row added by hand says so beside its number. */
  test("a manually added row carries a manual badge after the course number", () => {
    renderTable([notRemoved[0], recruitmentCoursesFixtures.oneManual]);

    const badge = screen.getByTestId(
      "RecruitmentCourseTable-cell-row-1-manual",
    );
    expect(badge).toHaveTextContent("manual");
    expect(badge).toHaveClass("badge", "bg-info", "text-dark", "ms-2");
    expect(badge).toHaveAttribute("title", "Added by an admin by enroll code");
    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-1-col-courseId"),
    ).toContainElement(badge);
    expect(
      screen.queryByTestId("RecruitmentCourseTable-cell-row-0-manual"),
    ).toBeNull();
  });

  test("a row without the stale flag at all is treated as fresh", () => {
    const { stale: _omitted, ...legacy } = notRemoved[0];
    renderTable([legacy]);
    expect(
      screen.queryByTestId("RecruitmentCourseTable-cell-row-0-stale"),
    ).toBeNull();
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
