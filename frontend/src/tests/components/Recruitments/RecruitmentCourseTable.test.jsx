import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import RecruitmentCourseTable, {
  CANCELLED,
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
    axiosMock.onPut("/api/recruitmentcourses/allocation").reply(200, {});
  });

  const allocationPuts = () =>
    axiosMock.history.put.filter(
      (r) => r.url === "/api/recruitmentcourses/allocation",
    );

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
      "Allocation",
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

  /** Issue #123: a cancelled lecture gets a red badge in place of the plain status. */
  test("a cancelled row shows a red Cancelled badge in the Status column", () => {
    renderTable([recruitmentCoursesFixtures.oneCancelled, notRemoved[1]]);

    const badge = screen.getByTestId(
      "RecruitmentCourseTable-cell-row-0-cancelled",
    );
    expect(badge).toHaveTextContent("Cancelled");
    expect(badge).toHaveClass("badge", "bg-danger");
    expect(CANCELLED).toBe("cancelled");
    const cell = screen.getByTestId(
      "RecruitmentCourseTable-cell-row-0-col-status",
    );
    expect(cell).toContainElement(badge);
    expect(cell.textContent).toBe("Cancelled");
    // An open row keeps its plain status.
    expect(
      screen.queryByTestId("RecruitmentCourseTable-cell-row-1-cancelled"),
    ).toBeNull();
    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-1-col-status")
        .textContent,
    ).toBe("open");
  });

  test("a row both cancelled and stale shows both badges", () => {
    renderTable([{ ...recruitmentCoursesFixtures.oneCancelled, stale: true }]);
    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-0-cancelled"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-0-stale"),
    ).toBeInTheDocument();
  });

  test("a row without the stale flag at all is treated as fresh", () => {
    const { stale: _omitted, ...legacy } = notRemoved[0];
    renderTable([legacy]);
    expect(
      screen.queryByTestId("RecruitmentCourseTable-cell-row-0-stale"),
    ).toBeNull();
  });

  // ---- allocation (issue #174) ----

  test("each row has an Allocation box showing its stored number, after Max", () => {
    renderTable();

    const box = screen.getByTestId(
      "RecruitmentCourseTable-cell-row-1-allocation",
    );
    expect(box).toHaveValue(3);
    expect(box).toHaveAttribute("type", "number");
    expect(box).toHaveAttribute("min", "0");
    expect(box).toHaveAttribute("step", "1");
    expect(box.style.width).toBe("5em");
    expect(box).toHaveClass("form-control-sm");
    expect(box).toBeEnabled();
    expect(box).toHaveAttribute(
      "aria-label",
      "Allocation for CMPSC   156 section 0100",
    );
    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-1-col-allocation"),
    ).toContainElement(box);
    const headers = [
      ...screen
        .getByTestId("RecruitmentCourseTable")
        .querySelectorAll("thead th"),
    ].map((th) => th.getAttribute("data-testid"));
    expect(headers.indexOf("RecruitmentCourseTable-header-allocation")).toBe(
      headers.indexOf("RecruitmentCourseTable-header-maxEnroll") + 1,
    );
  });

  test("a row without an allocation yet, or without a section, still shows a box", () => {
    const { allocation: _omitted, ...legacy } = notRemoved[0];
    renderTable([{ ...legacy, section: null }]);

    const box = screen.getByTestId(
      "RecruitmentCourseTable-cell-row-0-allocation",
    );
    expect(box).toHaveValue(0);
    expect(box).toHaveAttribute(
      "aria-label",
      "Allocation for CMPSC     1A section ",
    );
  });

  test("typing a valid allocation saves it at once", async () => {
    renderTable();
    const box = screen.getByTestId(
      "RecruitmentCourseTable-cell-row-0-allocation",
    );

    await userEvent.clear(box);
    await userEvent.type(box, "4");

    await waitFor(() => expect(allocationPuts()).toHaveLength(1));
    expect(allocationPuts()[0].params).toEqual({ id: 1, allocation: 4 });
    expect(allocationPuts()[0].method).toBe("put");
    expect(box).toHaveValue(4);
    expect(box).not.toHaveClass("is-invalid");
  });

  test("each row's box is independent", async () => {
    renderTable();

    await userEvent.clear(
      screen.getByTestId("RecruitmentCourseTable-cell-row-2-allocation"),
    );
    await userEvent.type(
      screen.getByTestId("RecruitmentCourseTable-cell-row-2-allocation"),
      "5",
    );

    await waitFor(() => expect(allocationPuts()).toHaveLength(1));
    expect(allocationPuts()[0].params).toEqual({ id: 3, allocation: 5 });
    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-0-allocation"),
    ).toHaveValue(2);
    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-1-allocation"),
    ).toHaveValue(3);
  });

  test("an invalid allocation is flagged, never sent, and reverts on blur", async () => {
    renderTable();
    const box = screen.getByTestId(
      "RecruitmentCourseTable-cell-row-0-allocation",
    );

    await userEvent.clear(box);
    expect(box).toHaveValue(null);
    expect(box).toHaveClass("is-invalid");
    await userEvent.type(box, "-");
    expect(allocationPuts()).toHaveLength(0);

    await userEvent.tab();

    expect(box).toHaveValue(2);
    expect(box).not.toHaveClass("is-invalid");
    expect(allocationPuts()).toHaveLength(0);
  });

  test("moving to another row's box reverts the one left behind", async () => {
    renderTable();
    const first = screen.getByTestId(
      "RecruitmentCourseTable-cell-row-0-allocation",
    );
    const second = screen.getByTestId(
      "RecruitmentCourseTable-cell-row-1-allocation",
    );

    await userEvent.clear(first);
    expect(first).toHaveValue(null);
    // Focusing the second box blurs the first, which reverts.
    await userEvent.clear(second);
    expect(first).toHaveValue(2);
    expect(first).not.toHaveClass("is-invalid");
    expect(second).toHaveValue(null);
    expect(second).toHaveClass("is-invalid");

    await userEvent.tab();

    expect(second).toHaveValue(3);
    expect(allocationPuts()).toHaveLength(0);
  });

  test("a removed row's box is disabled", () => {
    renderTable(recruitmentCoursesFixtures.fourCourses, true);

    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-3-allocation"),
    ).toBeDisabled();
    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-3-allocation"),
    ).toHaveValue(1);
    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-0-allocation"),
    ).toBeEnabled();
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
