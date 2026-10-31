import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { vi } from "vitest";
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

function renderTable(
  courses = notRemoved,
  includeRemoved = false,
  queryClient = new QueryClient(),
  type = undefined,
) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RecruitmentCourseTable
          courses={courses}
          includeRemoved={includeRemoved}
          testIdPrefix="RecruitmentCourseTable"
          type={type}
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
    axiosMock
      .onPut("/api/recruitmentcourses/enrollmentEstimate")
      .reply(200, {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const estimatePuts = () =>
    axiosMock.history.put.filter(
      (r) => r.url === "/api/recruitmentcourses/enrollmentEstimate",
    );
  const estimateBox = (row) =>
    screen.getByTestId(
      `RecruitmentCourseTable-cell-row-${row}-enrollmentEstimate`,
    );

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
      "Enrollment Estimate",
      "Allocation",
      "Delta",
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
    // Max, then (issue #175) Enrollment Estimate, then Allocation.
    expect(headers.indexOf("RecruitmentCourseTable-header-allocation")).toBe(
      headers.indexOf("RecruitmentCourseTable-header-maxEnroll") + 2,
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

  // ---- enrollment estimate (issue #175) ----

  test("each row has an Enrollment Estimate box between Max and Allocation", () => {
    renderTable();

    const box = estimateBox(1);
    expect(box).toHaveValue(140);
    expect(box).toHaveAttribute("type", "number");
    expect(box).toHaveAttribute("min", "0");
    expect(box).toHaveAttribute("step", "1");
    expect(box.style.width).toBe("6em");
    expect(box).toHaveClass("form-control-sm");
    expect(box).toBeEnabled();
    expect(box).toHaveAttribute(
      "aria-label",
      "Enrollment estimate for CMPSC   156 section 0100",
    );
    expect(
      screen.getByTestId(
        "RecruitmentCourseTable-cell-row-1-col-enrollmentEstimate",
      ),
    ).toContainElement(box);
    // No estimate yet shows as an empty box, not a zero.
    expect(estimateBox(2)).toHaveValue(null);
    const headers = [
      ...screen
        .getByTestId("RecruitmentCourseTable")
        .querySelectorAll("thead th"),
    ].map((th) => th.getAttribute("data-testid"));
    const estimate = headers.indexOf(
      "RecruitmentCourseTable-header-enrollmentEstimate",
    );
    expect(estimate).toBe(
      headers.indexOf("RecruitmentCourseTable-header-maxEnroll") + 1,
    );
    expect(headers.indexOf("RecruitmentCourseTable-header-allocation")).toBe(
      estimate + 1,
    );
  });

  test("a row without the field at all, or without a section, still shows a box", () => {
    const { enrollmentEstimate: _omitted, ...legacy } = notRemoved[0];
    renderTable([{ ...legacy, section: null }]);

    const box = estimateBox(0);
    expect(box).toHaveValue(null);
    expect(box).toHaveAttribute(
      "aria-label",
      "Enrollment estimate for CMPSC     1A section ",
    );
  });

  test("a removed row's estimate box is disabled", () => {
    renderTable(recruitmentCoursesFixtures.fourCourses, true);
    expect(estimateBox(3)).toBeDisabled();
    expect(estimateBox(3)).toHaveValue(95);
  });

  test("an estimate is saved one second after the last keystroke, with the request's shape", async () => {
    vi.useFakeTimers();
    renderTable();
    const box = estimateBox(0);

    fireEvent.change(box, { target: { value: "15" } });
    expect(box).toHaveValue(15);
    expect(box).not.toHaveClass("is-invalid");
    await act(() => vi.advanceTimersByTimeAsync(500));
    // Typing again restarts the second.
    fireEvent.change(box, { target: { value: "150" } });
    await act(() => vi.advanceTimersByTimeAsync(999));
    expect(estimatePuts()).toHaveLength(0);

    await act(() => vi.advanceTimersByTimeAsync(1));

    expect(estimatePuts()).toHaveLength(1);
    expect(estimatePuts()[0].method).toBe("put");
    expect(estimatePuts()[0].params).toEqual({
      id: 1,
      enrollmentEstimate: 150,
    });
    // Nothing more is sent later.
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(estimatePuts()).toHaveLength(1);
  });

  test("clearing the box clears the estimate: the parameter is left out", async () => {
    vi.useFakeTimers();
    renderTable();

    fireEvent.change(estimateBox(0), { target: { value: "" } });
    expect(estimateBox(0)).toHaveValue(null);
    expect(estimateBox(0)).not.toHaveClass("is-invalid");
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(estimatePuts()).toHaveLength(1);
    expect(estimatePuts()[0].params).toEqual({ id: 1 });
  });

  test("leaving the box before the second sends the pending value at once, and only once", async () => {
    vi.useFakeTimers();
    renderTable();
    const box = estimateBox(0);

    fireEvent.change(box, { target: { value: "210" } });
    await act(() => vi.advanceTimersByTimeAsync(300));
    fireEvent.blur(box);

    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(estimatePuts()).toHaveLength(1);
    expect(estimatePuts()[0].params).toEqual({
      id: 1,
      enrollmentEstimate: 210,
    });
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(estimatePuts()).toHaveLength(1);
  });

  test("leaving the box after the save sends nothing more", async () => {
    vi.useFakeTimers();
    renderTable();
    const box = estimateBox(0);

    fireEvent.change(box, { target: { value: "210" } });
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(estimatePuts()).toHaveLength(1);
    fireEvent.blur(box);
    await act(() => vi.advanceTimersByTimeAsync(2000));

    expect(estimatePuts()).toHaveLength(1);
  });

  test("an invalid estimate is flagged, never sent, and reverts on blur", async () => {
    vi.useFakeTimers();
    renderTable();
    const box = estimateBox(1);

    // A number box drops letters itself, so the invalid entries it can hold are a fraction or
    // a negative number.
    fireEvent.change(box, { target: { value: "-1" } });
    expect(box).toHaveClass("is-invalid");
    fireEvent.change(box, { target: { value: "1.5" } });
    expect(box).toHaveClass("is-invalid");
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(estimatePuts()).toHaveLength(0);

    fireEvent.blur(box);

    expect(box).toHaveValue(140);
    expect(box).not.toHaveClass("is-invalid");
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(estimatePuts()).toHaveLength(0);
  });

  test("a valid entry then an invalid one sends nothing", async () => {
    vi.useFakeTimers();
    renderTable();
    const box = estimateBox(1);

    fireEvent.change(box, { target: { value: "14" } });
    fireEvent.change(box, { target: { value: "14.5" } });
    await act(() => vi.advanceTimersByTimeAsync(2000));
    fireEvent.blur(box);
    await act(() => vi.advanceTimersByTimeAsync(2000));

    expect(estimatePuts()).toHaveLength(0);
  });

  test("each row's estimate is pending on its own", async () => {
    vi.useFakeTimers();
    renderTable();

    fireEvent.change(estimateBox(0), { target: { value: "10" } });
    await act(() => vi.advanceTimersByTimeAsync(600));
    fireEvent.change(estimateBox(2), { target: { value: "20" } });
    await act(() => vi.advanceTimersByTimeAsync(400));

    expect(estimatePuts().map((r) => r.params)).toEqual([
      { id: 1, enrollmentEstimate: 10 },
    ]);
    await act(() => vi.advanceTimersByTimeAsync(600));
    expect(estimatePuts().map((r) => r.params)).toEqual([
      { id: 1, enrollmentEstimate: 10 },
      { id: 3, enrollmentEstimate: 20 },
    ]);
  });

  test("leaving the page within the second still sends the pending estimates", async () => {
    vi.useFakeTimers();
    const { unmount } = renderTable();

    fireEvent.change(estimateBox(0), { target: { value: "10" } });
    fireEvent.change(estimateBox(1), { target: { value: "" } });
    await act(() => vi.advanceTimersByTimeAsync(200));
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(estimatePuts().map((r) => r.params)).toEqual([
      { id: 1, enrollmentEstimate: 10 },
      { id: 2 },
    ]);
    // The timers were cleared, so nothing is sent twice.
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(estimatePuts()).toHaveLength(2);
  });

  test("unmounting with nothing pending sends nothing", async () => {
    vi.useFakeTimers();
    const { unmount } = renderTable();
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(estimatePuts()).toHaveLength(0);
  });

  test("a saved estimate or allocation goes straight into every cached course list", async () => {
    const saved = { ...notRemoved[0], enrollmentEstimate: 333, allocation: 9 };
    axiosMock
      .onPut("/api/recruitmentcourses/enrollmentEstimate")
      .reply(200, saved);
    axiosMock.onPut("/api/recruitmentcourses/allocation").reply(200, saved);
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      ["/api/recruitmentcourses/all", false],
      notRemoved,
    );
    queryClient.setQueryData(
      ["/api/recruitmentcourses/all", true],
      recruitmentCoursesFixtures.fourCourses,
    );
    queryClient.setQueryData(["/api/admin/recruitments/all"], [{ id: 1 }]);
    vi.useFakeTimers();
    renderTable(notRemoved, false, queryClient);

    fireEvent.change(estimateBox(0), { target: { value: "333" } });
    await act(() => vi.advanceTimersByTimeAsync(1000));
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(
      queryClient.getQueryData(["/api/recruitmentcourses/all", false])[0],
    ).toEqual(saved);
    expect(
      queryClient.getQueryData(["/api/recruitmentcourses/all", true])[0],
    ).toEqual(saved);
    expect(
      queryClient.getQueryData(["/api/recruitmentcourses/all", true])[3],
    ).toEqual(recruitmentCoursesFixtures.fourCourses[3]);
    expect(queryClient.getQueryData(["/api/admin/recruitments/all"])).toEqual([
      { id: 1 },
    ]);

    queryClient.setQueryData(
      ["/api/recruitmentcourses/all", false],
      notRemoved,
    );
    fireEvent.change(
      screen.getByTestId("RecruitmentCourseTable-cell-row-0-allocation"),
      { target: { value: "9" } },
    );
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(
      queryClient.getQueryData(["/api/recruitmentcourses/all", false])[0],
    ).toEqual(saved);
  });

  // ---- totals row and the allocation guide columns (issue #176) ----

  test("ends with a totals row over the rows that count", () => {
    renderTable(recruitmentCoursesFixtures.fourCourses, true);

    expect(
      screen.getByTestId("RecruitmentCourseTable-footer-courseId"),
    ).toHaveTextContent("Total Course Count: 3");
    // 200 + 120 + 60; the removed row's 90 is left out.
    expect(
      screen.getByTestId("RecruitmentCourseTable-footer-enrollment"),
    ).toHaveTextContent("380");
    expect(
      screen.getByTestId("RecruitmentCourseTable-footer-maxEnroll"),
    ).toHaveTextContent("480");
    // 220 + 140 + nothing.
    expect(
      screen.getByTestId("RecruitmentCourseTable-footer-enrollmentEstimate"),
    ).toHaveTextContent("360");
    expect(
      screen.getByTestId("RecruitmentCourseTable-footer-allocation"),
    ).toBeEmptyDOMElement();
    expect(
      screen.getByTestId("RecruitmentCourseTable-footer-ratio"),
    ).toBeEmptyDOMElement();
  });

  test("the totals of an empty table are zero", () => {
    renderTable([]);
    expect(
      screen.getByTestId("RecruitmentCourseTable-footer-courseId"),
    ).toHaveTextContent("Total Course Count: 0");
    expect(
      screen.getByTestId("RecruitmentCourseTable-footer-enrollment"),
    ).toHaveTextContent(/^0$/);
    expect(
      screen.getByTestId("RecruitmentCourseTable-footer-enrollmentEstimate"),
    ).toHaveTextContent(/^0$/);
  });

  test("a row with no enrollment figures counts as zero in the totals", () => {
    renderTable([{ ...notRemoved[0], enrollment: null, maxEnroll: null }]);
    expect(
      screen.getByTestId("RecruitmentCourseTable-footer-enrollment"),
    ).toHaveTextContent(/^0$/);
    expect(
      screen.getByTestId("RecruitmentCourseTable-footer-maxEnroll"),
    ).toHaveTextContent(/^0$/);
  });

  test("Unrounded Allocation shows one decimal place, or a dash, under a stacked heading with a tooltip", async () => {
    renderTable([
      ...notRemoved,
      { ...notRemoved[0], id: 9, unroundedAllocation: null },
    ]);

    const heading = screen.getByTestId(
      "RecruitmentCourseTable-unrounded-heading",
    );
    expect(heading).toHaveTextContent("Unrounded Allocation");
    expect(heading.querySelector("br")).not.toBeNull();
    expect(heading).toHaveStyle({ textDecoration: "underline dotted" });
    expect(
      screen.getByTestId("RecruitmentCourseTable-header-unroundedAllocation"),
    ).toContainElement(heading);
    await userEvent.hover(heading);
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent(
      'unroundedAllocation is how many TAs the course would receive if TAs could be divided into "fractional bits", and were divided based only on estimatedEnrollment. In reality, one must round up or round down, but this number provides a guide for approaching a fair allocation.',
    );
    expect(tooltip).toHaveAttribute(
      "id",
      "RecruitmentCourseTable-unrounded-tooltip",
    );

    expect(
      screen.getByTestId(
        "RecruitmentCourseTable-cell-row-0-col-unroundedAllocation",
      ),
    ).toHaveTextContent(/^3\.7$/);
    expect(
      screen.getByTestId(
        "RecruitmentCourseTable-cell-row-1-col-unroundedAllocation",
      ),
    ).toHaveTextContent(/^2\.3$/);
    expect(
      screen.getByTestId(
        "RecruitmentCourseTable-cell-row-2-col-unroundedAllocation",
      ),
    ).toHaveTextContent(/^0\.0$/);
    expect(
      screen.getByTestId(
        "RecruitmentCourseTable-cell-row-3-col-unroundedAllocation",
      ),
    ).toHaveTextContent("\u2014");
  });

  test("the tooltip and the ratio heading say ULAs for a ULA recruitment", async () => {
    renderTable(notRemoved, false, new QueryClient(), "ULA");
    expect(
      screen.getByTestId("RecruitmentCourseTable-header-ratio"),
    ).toHaveTextContent("ULA:student ratio");
    await userEvent.hover(
      screen.getByTestId("RecruitmentCourseTable-unrounded-heading"),
    );
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      /how many ULAs the course would receive if ULAs could/,
    );
  });

  test("Delta is share minus allocation, coloured and signed", () => {
    renderTable();

    // 3.67 - 2 = +1.7; 2.33 - 3 = -0.7; 0.0 - 1 = -1.0.
    const first = screen.getByTestId("RecruitmentCourseTable-cell-row-0-delta");
    expect(first).toHaveTextContent(/^\+1\.7$/);
    expect(first).toHaveClass("text-success");
    const second = screen.getByTestId(
      "RecruitmentCourseTable-cell-row-1-delta",
    );
    expect(second).toHaveTextContent(/^-0\.7$/);
    expect(second).toHaveClass("text-danger");
    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-0-col-delta"),
    ).toContainElement(first);
  });

  test("a Delta that rounds to zero is a plain 0.0", () => {
    renderTable([
      { ...notRemoved[0], unroundedAllocation: 2.04, allocation: 2 },
    ]);
    const delta = screen.getByTestId("RecruitmentCourseTable-cell-row-0-delta");
    expect(delta).toHaveTextContent(/^0\.0$/);
    expect(delta.className).toBe("");
  });

  test("the ratio is 1:n, rounded, or a dash", () => {
    renderTable(notRemoved);
    expect(
      screen.getByTestId("RecruitmentCourseTable-header-ratio"),
    ).toHaveTextContent("TA:student ratio");
    expect(
      screen
        .getByTestId("RecruitmentCourseTable-header-ratio")
        .querySelector("br"),
    ).not.toBeNull();
    // 220 / 2, 140 / 3 = 46.67, and no estimate.
    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-0-col-ratio"),
    ).toHaveTextContent(/^1:110$/);
    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-1-col-ratio"),
    ).toHaveTextContent(/^1:47$/);
    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-2-col-ratio"),
    ).toHaveTextContent("\u2014");
  });

  test("the guide columns sit after Allocation and before Status, and sort by their values", async () => {
    renderTable();
    const headers = [
      ...screen
        .getByTestId("RecruitmentCourseTable")
        .querySelectorAll("thead th"),
    ].map((th) => th.getAttribute("data-testid"));
    const allocation = headers.indexOf(
      "RecruitmentCourseTable-header-allocation",
    );
    expect(headers.slice(allocation + 1, allocation + 5)).toEqual([
      "RecruitmentCourseTable-header-unroundedAllocation",
      "RecruitmentCourseTable-header-delta",
      "RecruitmentCourseTable-header-ratio",
      "RecruitmentCourseTable-header-status",
    ]);

    // Row test ids keep their original index, so read the body in document order. A numeric
    // column sorts descending first: +1.7, -0.7, -1.0; a second click sorts ascending.
    const deltasInOrder = () =>
      [
        ...screen
          .getByTestId("RecruitmentCourseTable")
          .querySelectorAll("tbody tr span[data-testid$='-delta']"),
      ].map((span) => span.textContent);
    await userEvent.click(
      screen.getByTestId("RecruitmentCourseTable-header-delta-sort-header"),
    );
    expect(deltasInOrder()).toEqual(["+1.7", "-0.7", "-1.0"]);
    await userEvent.click(
      screen.getByTestId("RecruitmentCourseTable-header-delta-sort-header"),
    );
    expect(deltasInOrder()).toEqual(["-1.0", "-0.7", "+1.7"]);
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
