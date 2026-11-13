import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import RecruitmentCourseTable, {
  CANCELLED,
  isValidEmail,
  STALE_LABEL,
} from "main/components/Recruitments/RecruitmentCourseTable";
import recruitmentCoursesFixtures from "fixtures/recruitmentCoursesFixtures";
import { COURSE_NUMBER_WIDTH } from "main/utils/columnWidths";

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
  });

  const estimateCell = (row) =>
    screen.getByTestId(
      `RecruitmentCourseTable-cell-row-${row}-enrollmentEstimate`,
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

  // ---- allocation and enrollment estimate (issues #174, #175): figures, not boxes, since #358 ----

  test("each row shows its Allocation as text, after Max and the Enrollment Estimate", () => {
    renderTable();

    const figure = screen.getByTestId(
      "RecruitmentCourseTable-cell-row-1-allocation",
    );
    expect(figure.tagName).toBe("SPAN");
    expect(figure).toHaveTextContent(/^3$/);
    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-1-col-allocation"),
    ).toContainElement(figure);
    const headers = [
      ...screen
        .getByTestId("RecruitmentCourseTable")
        .querySelectorAll("thead th"),
    ].map((th) => th.getAttribute("data-testid"));
    // Max, then (issue #175) Enrollment Estimate, then Allocation.
    const estimate = headers.indexOf(
      "RecruitmentCourseTable-header-enrollmentEstimate",
    );
    expect(estimate).toBe(
      headers.indexOf("RecruitmentCourseTable-header-maxEnroll") + 1,
    );
    expect(headers.indexOf("RecruitmentCourseTable-header-allocation")).toBe(
      estimate + 1,
    );
    // Nothing on the table can be typed into: the editing is on the Combined Allocation page.
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  test("a row without an allocation yet shows 0", () => {
    const { allocation: _omitted, ...legacy } = notRemoved[0];
    renderTable([{ ...legacy, section: null }]);

    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-0-allocation"),
    ).toHaveTextContent(/^0$/);
  });

  test("each row shows its Enrollment Estimate as text, or nothing when there is none", () => {
    renderTable();

    const figure = estimateCell(1);
    expect(figure.tagName).toBe("SPAN");
    expect(figure).toHaveTextContent(/^140$/);
    expect(
      screen.getByTestId(
        "RecruitmentCourseTable-cell-row-1-col-enrollmentEstimate",
      ),
    ).toContainElement(figure);
    // No estimate yet shows as nothing, not a zero.
    expect(estimateCell(2).textContent).toBe("");
  });

  test("a row without the estimate field at all shows nothing for it", () => {
    const { enrollmentEstimate: _omitted, ...legacy } = notRemoved[0];
    renderTable([legacy]);

    expect(estimateCell(0).textContent).toBe("");
  });

  test("a removed row keeps its figures", () => {
    renderTable(recruitmentCoursesFixtures.fourCourses, true);

    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-3-allocation"),
    ).toHaveTextContent(/^1$/);
    expect(estimateCell(3)).toHaveTextContent(/^95$/);
  });

  test("nothing is saved from the table but a Remove", async () => {
    renderTable();
    await userEvent.click(
      screen.getByTestId(
        "RecruitmentCourseTable-cell-row-0-col-removed-button",
      ),
    );
    await waitFor(() => expect(axiosMock.history.put).toHaveLength(1));
    expect(axiosMock.history.put[0].url).toBe(
      "/api/recruitmentcourses/removed",
    );
  });

  // ---- totals row and the allocation guide columns (issue #176) ----

  test("ends with a totals row over the rows that count", () => {
    renderTable(recruitmentCoursesFixtures.fourCourses, true);

    expect(
      screen.getByTestId("RecruitmentCourseTable-footer-courseId"),
    ).toHaveTextContent("Total Course Count: 3");
    // 200 + 120 + 60; the removed row's 90 is left out. Exact, so a sign cannot hide in a match.
    expect(
      screen.getByTestId("RecruitmentCourseTable-footer-enrollment"),
    ).toHaveTextContent(/^380$/);
    expect(
      screen.getByTestId("RecruitmentCourseTable-footer-maxEnroll"),
    ).toHaveTextContent(/^480$/);
    // 220 + 140 + nothing.
    expect(
      screen.getByTestId("RecruitmentCourseTable-footer-enrollmentEstimate"),
    ).toHaveTextContent(/^360$/);
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

  test("tolerates a non-array courses prop, showing it as no courses", () => {
    renderTable(null);
    expect(screen.getByText("Course Number")).toBeInTheDocument();
    expect(
      screen.queryByTestId("RecruitmentCourseTable-cell-row-0-col-courseId"),
    ).toBeNull();
    expect(
      screen.getByTestId("RecruitmentCourseTable-footer-courseId"),
    ).toHaveTextContent("Total Course Count: 0");
    expect(
      screen.getByTestId("RecruitmentCourseTable-footer-enrollment"),
    ).toHaveTextContent(/^0$/);
  });

  test("the test ids default to RecruitmentCourseTable", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <RecruitmentCourseTable courses={notRemoved} includeRemoved={false} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByTestId("RecruitmentCourseTable")).toBeInTheDocument();
    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-0-allocation"),
    ).toHaveTextContent(/^2$/);
  });

  test("a Remove re-reads the course list for the current toggle, and the ranking summaries", async () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    renderTable(recruitmentCoursesFixtures.fourCourses, true, queryClient);

    await userEvent.click(
      screen.getByTestId(
        "RecruitmentCourseTable-cell-row-0-col-removed-button",
      ),
    );

    await waitFor(() => expect(axiosMock.history.put).toHaveLength(1));
    await waitFor(() =>
      expect(invalidate.mock.calls.map((c) => c[0].queryKey)).toEqual([
        ["/api/recruitmentcourses/all"],
        [true],
        ["/api/instructor/recruitments/admin-course-rankings"],
      ]),
    );
  });

  test("the Rankings, Email and Remove headings, and the Title column takes the spare width", () => {
    renderWith({
      rankingSummaries: recruitmentCoursesFixtures.rankingSummaries,
      showRankings: true,
    });

    expect(
      screen.getByTestId("RecruitmentCourseTable-header-rankingCount"),
    ).toHaveTextContent(/^Faculty Rankings$/);
    expect(
      screen.getByTestId("RecruitmentCourseTable-header-instructorEmail"),
    ).toHaveTextContent(/^Email$/);
    // The Remove column has no heading: the button's own label says what it does.
    expect(
      screen.getByTestId("RecruitmentCourseTable-header-removed").textContent,
    ).toBe("");
    expect(
      screen.getByTestId("RecruitmentCourseTable-header-title").style.width,
    ).toBe("100%");
    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-0-col-title").style
        .width,
    ).toBe("100%");
    expect(
      screen.getByTestId("RecruitmentCourseTable-header-instructor").style
        .width,
    ).not.toBe("100%");
  });

  test("isValidEmail accepts one trimmed address and nothing else", () => {
    expect(isValidEmail("phtcon@ucsb.edu")).toBe(true);
    expect(isValidEmail("  phtcon@ucsb.edu  ")).toBe(true);
    expect(isValidEmail("PHTCON@UCSB.EDU")).toBe(true);
    expect(isValidEmail(undefined)).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("CONRAD P")).toBe(false);
    expect(isValidEmail("phtcon@ucsb")).toBe(false);
    // One address, not an address with words around it.
    expect(isValidEmail("phtcon@ucsb.edu and more")).toBe(false);
    expect(isValidEmail("Phill phtcon@ucsb.edu")).toBe(false);
  });

  // ---- Issue #185: UX tweaks ----

  const renderWith = (props) =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <RecruitmentCourseTable
            courses={notRemoved}
            includeRemoved={false}
            testIdPrefix="RecruitmentCourseTable"
            {...props}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

  test("sorts the course number exactly as stored, so 5A comes before 130A", async () => {
    const courses = [
      { ...notRemoved[0], id: 101, courseId: "CMPSC   130A", section: "0100" },
      { ...notRemoved[0], id: 102, courseId: "CMPSC     5A", section: "0100" },
      { ...notRemoved[0], id: 103, courseId: "CMPSC    16", section: "0100" },
      { ...notRemoved[0], id: 104, courseId: "CMPSC     8", section: "0100" },
    ];
    renderTable(courses);
    // Row test ids follow the original row, so read the course numbers in display order.
    const ids = () =>
      [
        ...screen
          .getByTestId("RecruitmentCourseTable")
          .querySelectorAll("tbody tr td:first-child span"),
      ].map((span) => span.textContent);

    await userEvent.click(
      screen.getByTestId("RecruitmentCourseTable-header-courseId-sort-header"),
    );
    expect(ids()).toEqual([
      "CMPSC     5A",
      "CMPSC     8",
      "CMPSC    16",
      "CMPSC   130A",
    ]);
    await userEvent.click(
      screen.getByTestId("RecruitmentCourseTable-header-courseId-sort-header"),
    );
    expect(ids()).toEqual([
      "CMPSC   130A",
      "CMPSC    16",
      "CMPSC     8",
      "CMPSC     5A",
    ]);
  });

  test("the copy control beside an email is an icon, and Not mapped links to the Instructors page", () => {
    renderWith({
      rankingSummaries: recruitmentCoursesFixtures.rankingSummaries.map(
        (summary) =>
          summary.recruitmentCourseId === 3
            ? { ...summary, instructorEmail: null }
            : summary,
      ),
      showRankings: true,
    });

    const copy = screen.getByTestId(
      "RecruitmentCourseTable-cell-row-0-copy-email",
    );
    expect(copy).toHaveAttribute("title", "Copy");
    expect(copy).toHaveTextContent("");
    expect(copy.querySelector("svg[data-testid='copy-icon']")).not.toBeNull();
    expect(copy.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(copy.querySelector("svg")).toHaveAttribute("width", "16");

    const unmapped = screen.getByTestId(
      "RecruitmentCourseTable-cell-row-2-unmapped",
    );
    expect(unmapped.tagName).toBe("A");
    expect(unmapped).toHaveTextContent("Not mapped");
    expect(unmapped).toHaveAttribute("href", "/admin/instructors");
    expect(unmapped).toHaveAttribute("target", "_blank");
    expect(unmapped).toHaveAttribute("rel", "noreferrer");
    expect(unmapped).toHaveAttribute(
      "title",
      "Map this instructor's catalog name to an email on the Instructors page",
    );
  });

  test("stacked headings are two lines at 80% size, and every heading is centred", () => {
    renderWith({ quarter: "20263" });

    [
      ["enrollmentEstimate", "Enrollment Estimate"],
      ["unroundedAllocation", "Unrounded Allocation"],
      ["ratio", "TA:student ratio"],
      ["summerSession", "Summer Session"],
    ].forEach(([id, text]) => {
      const heading = screen.getByTestId(`RecruitmentCourseTable-header-${id}`);
      expect(heading).toHaveTextContent(text);
      const small = [...heading.querySelectorAll("span")].find(
        (span) => span.style.fontSize !== "",
      );
      expect(small.style.fontSize).toBe("80%");
      expect(small.querySelector("br")).not.toBeNull();
      expect(heading.style.textAlign).toBe("center");
    });
    expect(
      screen.getByTestId("RecruitmentCourseTable-header-title").style.textAlign,
    ).toBe("center");
    expect(
      screen.getByTestId("RecruitmentCourseTable-header-enrollment").style
        .textAlign,
    ).toBe("center");
  });

  // Issue #386: the two leftmost headings, and the width of the Course Number column.
  test("Faculty Rankings and Course Number are stacked headings in the smaller font", () => {
    renderWith({
      rankingSummaries: recruitmentCoursesFixtures.rankingSummaries,
      showRankings: true,
    });

    [
      ["rankingCount", "Faculty Rankings", "Faculty", "Rankings"],
      ["courseId", "Course Number", "Course", "Number"],
    ].forEach(([id, text, top, bottom]) => {
      const heading = screen.getByTestId(`RecruitmentCourseTable-header-${id}`);
      expect(heading).toHaveTextContent(new RegExp(`^${text}$`));
      const small = [...heading.querySelectorAll("span")].find(
        (span) => span.style.fontSize !== "",
      );
      expect(small.style.fontSize).toBe("80%");
      // The break is between the two words, with the space before it.
      expect(small.innerHTML).toBe(`${top} <br>${bottom}`);
    });
    // The heading is not the sort caret's container: the whole heading is still the sort handle.
    expect(
      screen
        .getByTestId("RecruitmentCourseTable-header-courseId-sort-header")
        .querySelector("br"),
    ).not.toBeNull();
  });

  test("the Course Number cell is the shared course-number width, and the totals footer is stacked too", () => {
    renderWith({});

    // The widest thing in the column sets its width, so the cell is as wide as the widest
    // possible course number (COURSE_NUMBER_WIDTH, 11ch since issue #383), not as wide as the
    // data happens to be, and the one-line footer no longer forces the column wider than that.
    const cellText = screen
      .getByTestId("RecruitmentCourseTable-cell-row-0-col-courseId")
      .querySelector("span");
    expect(cellText).toHaveTextContent("CMPSC     1A", {
      normalizeWhitespace: false,
    });
    expect(cellText.style.display).toBe("inline-block");
    expect(cellText.style.minWidth).toBe(COURSE_NUMBER_WIDTH);
    expect(COURSE_NUMBER_WIDTH).toBe("11ch");
    expect(cellText.style.whiteSpace).toBe("pre");
    expect(cellText.style.fontFamily).toBe("monospace");

    const footer = screen.getByTestId("RecruitmentCourseTable-footer-courseId");
    expect(footer).toHaveTextContent(/^Total Course Count: 3$/);
    const small = footer.querySelector("span");
    expect(small.style.fontSize).toBe("80%");
    expect(small.innerHTML).toBe("Total Course Count: <br>3");
  });

  test("numeric columns are right-aligned, the ratio left-aligned", () => {
    renderWith({
      rankingSummaries: recruitmentCoursesFixtures.rankingSummaries,
      showRankings: true,
    });

    [
      "rankingCount",
      "enrollment",
      "maxEnroll",
      "enrollmentEstimate",
      "allocation",
      "unroundedAllocation",
      "delta",
    ].forEach((id) => {
      expect(
        screen.getByTestId(`RecruitmentCourseTable-cell-row-0-col-${id}`).style
          .textAlign,
      ).toBe("right");
    });
    expect(
      screen.getByTestId("RecruitmentCourseTable-footer-enrollment").style
        .textAlign,
    ).toBe("right");
    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-0-col-ratio").style
        .textAlign,
    ).toBe("");
    expect(
      screen.getByTestId("RecruitmentCourseTable-cell-row-0-col-title").style
        .textAlign,
    ).toBe("");
  });

  test("the Summer Session column exists only for a summer quarter", () => {
    const { unmount } = renderWith({ quarter: "20264" });
    expect(
      screen.queryByTestId("RecruitmentCourseTable-header-summerSession"),
    ).not.toBeInTheDocument();
    unmount();

    renderWith({});
    expect(
      screen.queryByTestId("RecruitmentCourseTable-header-summerSession"),
    ).not.toBeInTheDocument();
  });

  test("a summer quarter shows the Summer Session column after Status", () => {
    renderWith({ quarter: "20263" });

    const headers = [
      ...screen
        .getByTestId("RecruitmentCourseTable")
        .querySelectorAll("thead th"),
    ].map((th) => th.getAttribute("data-testid"));
    expect(headers.indexOf("RecruitmentCourseTable-header-summerSession")).toBe(
      headers.indexOf("RecruitmentCourseTable-header-status") + 1,
    );
    expect(headers.indexOf("RecruitmentCourseTable-header-removed")).toBe(
      headers.indexOf("RecruitmentCourseTable-header-summerSession") + 1,
    );
  });

  test("hidden columns leave the table, heading, cells and footer alike", () => {
    renderWith({ hiddenColumns: ["room", "enrollment"] });

    expect(
      screen.queryByTestId("RecruitmentCourseTable-header-room"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("RecruitmentCourseTable-cell-row-0-col-room"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("RecruitmentCourseTable-footer-enrollment"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("RecruitmentCourseTable-footer-maxEnroll"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("RecruitmentCourseTable-header-courseId"),
    ).toBeInTheDocument();
  });

  test("omitted columns are not in the table at all, unlike hidden ones (issue #300)", () => {
    renderWith({
      omitColumns: ["enrollmentEstimate", "allocation", "delta", "ratio"],
    });

    for (const id of ["enrollmentEstimate", "allocation", "delta", "ratio"]) {
      expect(
        screen.queryByTestId(`RecruitmentCourseTable-header-${id}`),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId(`RecruitmentCourseTable-footer-${id}`),
      ).not.toBeInTheDocument();
    }
    expect(
      screen.queryByTestId("RecruitmentCourseTable-cell-row-0-allocation"),
    ).not.toBeInTheDocument();
    for (const id of [
      "courseId",
      "instructor",
      "unroundedAllocation",
      "status",
      "removed",
    ]) {
      expect(
        screen.getByTestId(`RecruitmentCourseTable-header-${id}`),
      ).toBeInTheDocument();
    }
  });

  // Issue #437: the page re-reads the courses in the background, and the links and buttons keep
  // the keyboard focus across it; a row is its course (#435), so the focus stays on that course.
  describe("the focus across a re-read (issue #437)", () => {
    const [first, ...others] = notRemoved;
    const onCopyEmail = vi.fn();
    const client = new QueryClient();
    const table = (courses) => (
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <RecruitmentCourseTable
            courses={courses}
            includeRemoved={false}
            rankingSummaries={recruitmentCoursesFixtures.rankingSummaries}
            showRankings
            onCopyEmail={onCopyEmail}
            testIdPrefix="RecruitmentCourseTable"
          />
        </MemoryRouter>
      </QueryClientProvider>
    );
    const control = (row, suffix) =>
      screen.getByTestId(`RecruitmentCourseTable-cell-row-${row}-${suffix}`);

    test.each([
      ["the Remove button", "col-removed-button"],
      ["the copy-email button", "copy-email"],
      ["the rankings link", "ranking-link"],
    ])(
      "%s keeps the focus when a course is added before its row, and stays its course's",
      (_name, suffix) => {
        const { rerender } = render(table(others));
        const focused = control(0, suffix);
        focused.focus();

        rerender(table([first, ...others]));

        // The test ids keep the position: the course is the second row now.
        expect(control(1, suffix)).toBe(focused);
        expect(focused).toHaveFocus();
      },
    );

    test("Enter on the focused Remove button after the re-read removes its own course", async () => {
      const { rerender } = render(table(others));
      control(0, "col-removed-button").focus();

      rerender(table([first, ...others]));
      await userEvent.keyboard("{Enter}");

      await waitFor(() => expect(axiosMock.history.put).toHaveLength(1));
      expect(axiosMock.history.put[0].params).toEqual({
        id: others[0].id,
        removed: true,
      });
    });

    test("the copy-email button copies its own course's email after the re-read", async () => {
      const { rerender } = render(table(others));
      control(0, "copy-email").focus();

      rerender(table([first, ...others]));
      await userEvent.keyboard("{Enter}");

      expect(onCopyEmail).toHaveBeenCalledWith(
        recruitmentCoursesFixtures.rankingSummaries.find(
          (s) => s.recruitmentCourseId === others[0].id,
        ).instructorEmail,
      );
    });
  });
});
