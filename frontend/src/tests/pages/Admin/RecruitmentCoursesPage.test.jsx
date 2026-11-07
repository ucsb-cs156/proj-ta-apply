import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import RecruitmentCoursesPage from "main/pages/Admin/RecruitmentCoursesPage";
import recruitmentCoursesFixtures from "fixtures/recruitmentCoursesFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    toast: (x) => mockToast(x),
  };
});

const axiosMock = new AxiosMockAdapter(axios);

const notRemoved = recruitmentCoursesFixtures.fourCourses.filter(
  (c) => !c.removed,
);
const visibleRankingSummaries =
  recruitmentCoursesFixtures.rankingSummaries.filter(
    (summary) => summary.recruitmentCourseId !== 4,
  );
const mockClipboardWriteText = vi.fn();

/** The edit page unless told otherwise (issue #278): most of what the page does is editing. */
function renderPage({ edit = true } = {}) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter
        initialEntries={[
          edit
            ? "/admin/recruitments/7/courses/edit"
            : "/admin/recruitments/7/courses",
        ]}
      >
        <Routes>
          <Route
            path="/admin/recruitments/:recruitmentId/courses"
            element={<RecruitmentCoursesPage />}
          />
          <Route
            path="/admin/recruitments/:recruitmentId/courses/edit"
            element={<RecruitmentCoursesPage edit />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const HIDDEN_KEY = "recruitmentCourses.hiddenColumns.7";

describe("RecruitmentCoursesPage tests", () => {
  beforeEach(() => {
    mockToast.mockClear();
    mockClipboardWriteText.mockReset();
    mockClipboardWriteText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: mockClipboardWriteText },
    });
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.adminUser);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
    // Issue #300: the shown columns are remembered in local storage. Most tests want every column,
    // so recruitment 7 starts with none hidden; the tests of the defaults clear it.
    localStorage.clear();
    localStorage.setItem(HIDDEN_KEY, "[]");
    axiosMock
      .onPost("/api/jobs/launch/populateRecruitmentCourses")
      .reply(200, { id: 1 });
    axiosMock.onPut("/api/admin/recruitments/totalHiringTarget").reply(200, {});
    axiosMock.onPost("/api/recruitmentcourses/refresh").reply(200, notRemoved);
    // Recruitment 7, refreshed once (issue #124).
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, [
      {
        ...recruitmentsFixtures.threeRecruitments[1],
        id: 7,
        lastPopulatedAt: "2026-02-01T03:00:00",
      },
    ]);
    // Default view hides removed rows; includeRemoved=true reveals them.
    axiosMock
      .onGet("/api/recruitmentcourses/all", {
        params: { recruitmentId: "7", includeRemoved: false },
      })
      .reply(200, notRemoved);
    axiosMock
      .onGet("/api/recruitmentcourses/all", {
        params: { recruitmentId: "7", includeRemoved: true },
      })
      .reply(200, recruitmentCoursesFixtures.fourCourses);
    axiosMock
      .onGet("/api/instructor/recruitments/7/admin-course-rankings", {
        params: { includeRemoved: false },
      })
      .reply(200, visibleRankingSummaries);
    axiosMock
      .onGet("/api/instructor/recruitments/7/admin-course-rankings", {
        params: { includeRemoved: true },
      })
      .reply(200, recruitmentCoursesFixtures.rankingSummaries);
  });

  /** Issue #124: how fresh the list is, and that it is refreshed nightly. */
  test("says when the list was last refreshed", async () => {
    renderPage();

    // The line is up before the recruitment arrives, so wait for the stamped text.
    await waitFor(() =>
      expect(
        screen.getByTestId("RecruitmentCoursesPage-last-refreshed"),
      ).toHaveTextContent(
        `Last refreshed from the UCSB schedule: 2/1/2026, 3:00:00 AM. Open, upcoming and recently closed recruitments are also refreshed automatically every night.`,
      ),
    );
  });

  test("another recruitment's stamp is not taken for this one's", async () => {
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, [
      {
        ...recruitmentsFixtures.threeRecruitments[0],
        id: 9,
        lastPopulatedAt: "2026-05-05T03:00:00",
      },
      {
        ...recruitmentsFixtures.threeRecruitments[1],
        id: 7,
        lastPopulatedAt: null,
      },
    ]);
    renderPage();

    await waitFor(() =>
      expect(
        axiosMock.history.get.some(
          (r) => r.url === "/api/admin/recruitments/all",
        ),
      ).toBe(true),
    );
    const line = await screen.findByTestId(
      "RecruitmentCoursesPage-last-refreshed",
    );
    expect(line).toHaveTextContent("Not yet refreshed from the UCSB schedule.");
    expect(line).not.toHaveTextContent("Last refreshed");
  });

  test("says so when the recruitment is unknown", async () => {
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, []);
    renderPage();

    expect(
      await screen.findByTestId("RecruitmentCoursesPage-last-refreshed"),
    ).toHaveTextContent("Not yet refreshed from the UCSB schedule.");
  });

  test("lists the recruitment's courses", async () => {
    renderPage();

    expect(await screen.findByText("Recruitment Courses")).toBeInTheDocument();
    expect(
      await screen.findByTestId(
        "RecruitmentCoursesPage-cell-row-0-col-courseId",
      ),
    ).toHaveTextContent("CMPSC     1A", { normalizeWhitespace: false });
  });

  test("shows sortable Rankings as the leftmost column only after reviews start", async () => {
    renderPage();

    await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-ranking-link");
    await screen.findByRole("link", { name: "2" });
    const table = screen.getByTestId("RecruitmentCoursesPage");
    expect(
      [...table.querySelectorAll("thead th")].map((header) =>
        header.getAttribute("data-testid"),
      ),
    ).toEqual([
      "RecruitmentCoursesPage-header-rankingCount",
      "RecruitmentCoursesPage-header-courseId",
      "RecruitmentCoursesPage-header-section",
      "RecruitmentCoursesPage-header-title",
      "RecruitmentCoursesPage-header-instructor",
      "RecruitmentCoursesPage-header-instructorEmail",
      "RecruitmentCoursesPage-header-days",
      "RecruitmentCoursesPage-header-time",
      "RecruitmentCoursesPage-header-room",
      "RecruitmentCoursesPage-header-enrollment",
      "RecruitmentCoursesPage-header-maxEnroll",
      "RecruitmentCoursesPage-header-status",
      "RecruitmentCoursesPage-header-removed",
    ]);

    await userEvent.click(
      screen.getByTestId(
        "RecruitmentCoursesPage-header-rankingCount-sort-header",
      ),
    );
    expect(
      [...table.querySelectorAll("tbody tr a")].map((link) =>
        link.getAttribute("href"),
      ),
    ).toEqual([
      "/recruitments/7/courses/2/ranking",
      "/recruitments/7/courses/1/ranking",
      "/recruitments/7/courses/3/ranking",
    ]);
    await userEvent.click(
      screen.getByTestId(
        "RecruitmentCoursesPage-header-rankingCount-sort-header",
      ),
    );
    expect(
      [...table.querySelectorAll("tbody tr a")].map((link) =>
        link.getAttribute("href"),
      ),
    ).toEqual([
      "/recruitments/7/courses/1/ranking",
      "/recruitments/7/courses/3/ranking",
      "/recruitments/7/courses/2/ranking",
    ]);
  });

  test.each(["Open", "Closed"])(
    "shows ranking links while reviews are %s",
    async (reviewStatus) => {
      axiosMock.onGet("/api/admin/recruitments/all").reply(200, [
        {
          ...recruitmentsFixtures.threeRecruitments[1],
          id: 7,
          reviewStatus,
        },
      ]);
      renderPage();
      expect(
        await screen.findByTestId(
          "RecruitmentCoursesPage-cell-row-0-ranking-link",
        ),
      ).toHaveTextContent("0");
    },
  );

  test("hides Rankings and the reminder action when review has not started", async () => {
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, [
      {
        ...recruitmentsFixtures.threeRecruitments[0],
        id: 7,
        reviewStatus: "NotStarted",
      },
    ]);
    renderPage();

    await screen.findByTestId("RecruitmentCoursesPage-last-refreshed");
    await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-copy-email");
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-header-rankingCount"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-copy-zero-ranking-emails"),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("pconrad@ucsb.edu")).toHaveLength(2);
  });

  test("copies a mapped email from its Email column and reports success", async () => {
    renderPage();
    await userEvent.click(
      await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-copy-email"),
    );

    expect(mockClipboardWriteText).toHaveBeenCalledWith("pconrad@ucsb.edu");
    expect(mockToast).toHaveBeenCalledWith("Email copied to clipboard.");
  });

  test("labels unmapped faculty instead of showing catalog names or a copy control", async () => {
    axiosMock
      .onGet("/api/instructor/recruitments/7/admin-course-rankings", {
        params: { includeRemoved: false },
      })
      .reply(
        200,
        visibleRankingSummaries.map((summary) =>
          summary.recruitmentCourseId === 3
            ? { ...summary, instructorEmail: null }
            : summary,
        ),
      );
    renderPage();

    expect(
      await screen.findByTestId("RecruitmentCoursesPage-cell-row-2-unmapped"),
    ).toHaveTextContent("Not mapped");
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-cell-row-2-copy-email"),
    ).not.toBeInTheDocument();
  });

  test("does not copy malformed instructor addresses", async () => {
    axiosMock
      .onGet("/api/instructor/recruitments/7/admin-course-rankings", {
        params: { includeRemoved: false },
      })
      .reply(
        200,
        visibleRankingSummaries.map((summary) =>
          summary.recruitmentCourseId === 1
            ? { ...summary, instructorEmail: "not-an-email" }
            : summary,
        ),
      );
    renderPage();

    await screen.findByTestId("RecruitmentCoursesPage-cell-row-1-copy-email");
    expect(
      await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-unmapped"),
    ).toHaveTextContent("Not mapped");
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-cell-row-0-copy-email"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("RecruitmentCoursesPage-copy-zero-ranking-emails"),
    ).toBeEnabled();
    await userEvent.click(
      screen.getByTestId("RecruitmentCoursesPage-copy-zero-ranking-emails"),
    );
    expect(mockClipboardWriteText).toHaveBeenCalledWith("pconrad@ucsb.edu");
  });

  test("copies deduplicated valid zero-ranking emails in visible course scope", async () => {
    renderPage();
    await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-copy-email");
    const button = await screen.findByTestId(
      "RecruitmentCoursesPage-copy-zero-ranking-emails",
    );
    await userEvent.click(button);
    expect(mockClipboardWriteText).toHaveBeenLastCalledWith("pconrad@ucsb.edu");
    expect(mockToast).toHaveBeenLastCalledWith(
      "Faculty emails copied to clipboard.",
    );

    await userEvent.click(
      screen.getByTestId("RecruitmentCoursesPage-show-removed"),
    );
    await screen.findByTestId("RecruitmentCoursesPage-cell-row-3-copy-email");
    await userEvent.click(
      screen.getByTestId("RecruitmentCoursesPage-copy-zero-ranking-emails"),
    );
    expect(mockClipboardWriteText).toHaveBeenLastCalledWith(
      "pconrad@ucsb.edu\nturing@ucsb.edu",
    );
    expect(
      axiosMock.history.get
        .filter(
          (request) =>
            request.url ===
            "/api/instructor/recruitments/7/admin-course-rankings",
        )
        .map((request) => request.params.includeRemoved),
    ).toEqual([false, true]);
  });

  test("one address per person, however the mapping was typed, and no 'none available' note while there are some", async () => {
    // Replaces the matching handler from beforeEach (same URL and params).
    axiosMock
      .onGet("/api/instructor/recruitments/7/admin-course-rankings", {
        params: { includeRemoved: false },
      })
      .reply(200, [
        {
          recruitmentCourseId: 1,
          rankingCount: 0,
          instructorEmail: "pconrad@ucsb.edu",
        },
        {
          recruitmentCourseId: 2,
          rankingCount: 0,
          instructorEmail: " PConrad@ucsb.edu ",
        },
        {
          recruitmentCourseId: 3,
          rankingCount: 0,
          instructorEmail: "turing@ucsb.edu",
        },
      ]);
    renderPage();
    const button = await screen.findByTestId(
      "RecruitmentCoursesPage-copy-zero-ranking-emails",
    );
    await waitFor(() => expect(button).toBeEnabled());
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-no-zero-ranking-emails"),
    ).not.toBeInTheDocument();

    await userEvent.click(button);

    // The two spellings are one person; the last spelling seen is copied, trimmed.
    expect(mockClipboardWriteText).toHaveBeenLastCalledWith(
      "PConrad@ucsb.edu\nturing@ucsb.edu",
    );
  });

  test("disables bulk copy when there are no mapped zero-ranking addresses", async () => {
    axiosMock
      .onGet("/api/instructor/recruitments/7/admin-course-rankings", {
        params: { includeRemoved: false },
      })
      .reply(
        200,
        visibleRankingSummaries.map((summary) => ({
          ...summary,
          rankingCount: 1,
          instructorEmail: null,
        })),
      );
    renderPage();
    await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-unmapped");
    const button = await screen.findByTestId(
      "RecruitmentCoursesPage-copy-zero-ranking-emails",
    );
    expect(button).toBeDisabled();
    expect(
      screen.getByTestId("RecruitmentCoursesPage-no-zero-ranking-emails"),
    ).toHaveTextContent(
      "None of the rows with zero rankings have an email address available",
    );
    expect(mockClipboardWriteText).not.toHaveBeenCalled();
  });

  test("reports clipboard failures explicitly", async () => {
    mockClipboardWriteText.mockRejectedValueOnce(
      new Error("permission denied"),
    );
    renderPage();
    await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-copy-email");
    await userEvent.click(
      await screen.findByTestId(
        "RecruitmentCoursesPage-copy-zero-ranking-emails",
      ),
    );
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Unable to copy to clipboard. Check your browser clipboard permissions.",
      ),
    );
  });

  test("reports unavailable metadata separately from no reminder recipients", async () => {
    axiosMock
      .onGet("/api/instructor/recruitments/7/admin-course-rankings", {
        params: { includeRemoved: false },
      })
      .reply(503, { message: "Ranking metadata temporarily unavailable." });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    try {
      renderPage();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Unable to load ranking counts and instructor emails: Ranking metadata temporarily unavailable.",
      );
      expect(
        await screen.findByTestId(
          "RecruitmentCoursesPage-copy-zero-ranking-emails",
        ),
      ).toBeDisabled();
      expect(
        screen.queryByTestId("RecruitmentCoursesPage-no-zero-ranking-emails"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("RecruitmentCoursesPage-cell-row-0-ranking-link"),
      ).not.toBeInTheDocument();
      expect(mockClipboardWriteText).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  const getsOf = (url) =>
    axiosMock.history.get.filter((r) => r.url === url).length;
  /** Waits for the refresh on open (issue #175) to finish, so its re-reads are not counted. */
  const afterRefresh = async () => {
    await waitFor(() =>
      expect(
        screen.queryByTestId("RecruitmentCoursesPage-refreshing"),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(getsOf("/api/recruitmentcourses/all")).toBeGreaterThanOrEqual(2),
    );
    await waitFor(() =>
      expect(getsOf("/api/admin/recruitments/all")).toBeGreaterThanOrEqual(2),
    );
  };

  // ---- hiring target and allocations (issue #174), read-only on the view page since #358 ----

  test("the view page shows the hiring target above the refresh line, with the visible allocations added up", async () => {
    renderPage({ edit: false });

    const box = await screen.findByTestId(
      "RecruitmentCoursesPage-hiring-target-totalHiringTarget",
    );
    // Recruitment 7 is a ULA recruitment expecting 6; the three visible rows allocate 2 + 3 + 1.
    expect(box).toHaveTextContent(
      "Total number of ULAs expected to be hired: 6",
    );
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
    await waitFor(() =>
      expect(
        screen.getByTestId("RecruitmentCoursesPage-hiring-target-allocated"),
      ).toHaveTextContent("Allocated so far: 6"),
    );
    expect(
      screen.getByTestId("RecruitmentCoursesPage-hiring-target-left"),
    ).toHaveTextContent("ULA allocations left to assign: 0");
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-hiring-target-over"),
    ).not.toBeInTheDocument();
    const panel = screen.getByTestId("RecruitmentCoursesPage-hiring-target");
    const refreshed = screen.getByTestId(
      "RecruitmentCoursesPage-last-refreshed",
    );
    expect(
      panel.compareDocumentPosition(refreshed) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("the panel waits for the recruitment", async () => {
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, []);
    renderPage({ edit: false });

    await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-col-courseId");
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-hiring-target"),
    ).not.toBeInTheDocument();
  });

  test("warns when the allocations exceed the target", async () => {
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, [
      {
        ...recruitmentsFixtures.threeRecruitments[1],
        id: 7,
        totalHiringTarget: 4,
      },
    ]);
    renderPage({ edit: false });

    expect(
      await screen.findByTestId("RecruitmentCoursesPage-hiring-target-over"),
    ).toHaveTextContent(
      "Please either increase the hiring target, or reduce the allocations for one or more courses.",
    );
    expect(
      screen.getByTestId("RecruitmentCoursesPage-hiring-target-left"),
    ).toHaveTextContent("ULA allocations left to assign: -2");
  });

  test("removed rows do not count toward the allocation, even when shown", async () => {
    renderPage({ edit: false });
    await screen.findByTestId("RecruitmentCoursesPage-hiring-target-allocated");

    await userEvent.click(
      screen.getByTestId("RecruitmentCoursesPage-show-removed"),
    );

    // The removed row (allocation 1) appears, but the sum stays 6.
    expect(
      await screen.findByTestId(
        "RecruitmentCoursesPage-cell-row-3-col-courseId",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("RecruitmentCoursesPage-hiring-target-allocated"),
    ).toHaveTextContent("Allocated so far: 6");
  });

  test("a row without an allocation counts as zero", async () => {
    axiosMock
      .onGet("/api/recruitmentcourses/all", {
        params: { recruitmentId: "7", includeRemoved: false },
      })
      .reply(
        200,
        notRemoved.map(({ allocation: _omitted, ...course }) => course),
      );
    renderPage({ edit: false });

    await waitFor(() =>
      expect(
        screen.getByTestId("RecruitmentCoursesPage-hiring-target-allocated"),
      ).toHaveTextContent("Allocated so far: 0"),
    );
  });

  test("the edit page has no hiring target, description, pointer or Publish Assignments panel (issue #358)", async () => {
    renderPage();
    await screen.findByTestId("RecruitmentCoursesPage-populate");
    await screen.findByTestId("RecruitmentCoursesPage-allocation-visibility");

    for (const id of [
      "hiring-target",
      "hiring-target-totalHiringTarget",
      "description",
      "combined-pointer",
      "combined-link",
      "publish",
      "publish-button",
      "publish-published",
    ]) {
      expect(screen.queryByTestId(`RecruitmentCoursesPage-${id}`)).toBeNull();
    }
    expect(screen.queryByText(/Re-running Populate picks up/)).toBeNull();
    expect(screen.queryByText(/expected to be hired/)).toBeNull();
    expect(screen.queryByText("Publish Assignments")).toBeNull();
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
  });

  // ---- refresh on open (issue #175) ----

  const refreshPosts = () =>
    axiosMock.history.post.filter(
      (r) => r.url === "/api/recruitmentcourses/refresh",
    );

  test("refreshes the courses from the UCSB API once as the page opens", async () => {
    renderPage();

    const status = await screen.findByTestId(
      "RecruitmentCoursesPage-refreshing",
    );
    expect(status).toHaveTextContent(
      "Refreshing enrollment from the UCSB API…",
    );
    expect(status).toHaveAttribute("role", "status");
    await waitFor(() => expect(refreshPosts()).toHaveLength(1));
    expect(refreshPosts()[0].params).toEqual({ recruitmentId: "7" });
    await waitFor(() =>
      expect(
        screen.queryByTestId("RecruitmentCoursesPage-refreshing"),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-refresh-failed"),
    ).not.toBeInTheDocument();
    // The list and the recruitment (its last-refreshed stamp) are read again afterwards.
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter(
          (r) => r.url === "/api/recruitmentcourses/all",
        ).length,
      ).toBeGreaterThanOrEqual(2),
    );
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter(
          (r) => r.url === "/api/admin/recruitments/all",
        ).length,
      ).toBeGreaterThanOrEqual(2),
    );
    // Still just the one refresh.
    expect(refreshPosts()).toHaveLength(1);
    expect(mockToast).not.toHaveBeenCalled();
  });

  test("says so, without a toast, when the UCSB API cannot be reached", async () => {
    axiosMock.onPost("/api/recruitmentcourses/refresh").reply(502, {
      type: "UpstreamApiException",
      message:
        "The UCSB API could not be reached; the stored enrollment figures were kept.",
    });
    renderPage();

    const alert = await screen.findByTestId(
      "RecruitmentCoursesPage-refresh-failed",
    );
    expect(alert).toHaveTextContent(
      "Enrollment could not be refreshed: The UCSB API could not be reached; the stored enrollment figures were kept. The stored figures are shown.",
    );
    expect(alert).toHaveAttribute("role", "alert");
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-refreshing"),
    ).not.toBeInTheDocument();
    // The stored rows are still shown.
    expect(
      await screen.findByTestId(
        "RecruitmentCoursesPage-cell-row-0-col-enrollment",
      ),
    ).toHaveTextContent("200");
    expect(mockToast).not.toHaveBeenCalled();
  });

  /** Removed rows are hidden until asked for. */
  test("removed courses are hidden by default", async () => {
    renderPage();

    await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-col-courseId");
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-cell-row-3-col-courseId"),
    ).toBeNull();
    expect(
      axiosMock.history.get.find((r) =>
        r.url.includes("/api/recruitmentcourses/all"),
      ).params.includeRemoved,
    ).toBe(false);
  });

  test("the toggle asks the backend for removed courses too", async () => {
    renderPage();
    await screen.findByTestId("RecruitmentCoursesPage-show-removed");

    await userEvent.click(
      screen.getByTestId("RecruitmentCoursesPage-show-removed"),
    );

    // The removed row appears, showing Unremove.
    const button = await screen.findByTestId(
      "RecruitmentCoursesPage-cell-row-3-col-removed-button",
    );
    expect(button).toHaveTextContent("Unremove");
  });

  // ---- add by enroll code (issue #125) ----

  test("adding by enroll code posts the code, toasts what was added and clears the box", async () => {
    axiosMock
      .onPost("/api/recruitmentcourses/post")
      .reply(200, recruitmentCoursesFixtures.oneManual);
    renderPage();

    const add = await screen.findByTestId("RecruitmentCoursesPage-add");
    await afterRefresh();
    await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-ranking-link");
    const courses = getsOf("/api/recruitmentcourses/all");
    const summaries = getsOf(
      "/api/instructor/recruitments/7/admin-course-rankings",
    );
    expect(add).toBeDisabled();
    const box = screen.getByTestId("RecruitmentCoursesPage-enrollCode");
    expect(box.style.width).toBe("7em");
    expect(box).toHaveAttribute("placeholder", "e.g. 07492");
    // Blank-looking input is still nothing to send.
    await userEvent.type(box, "   ");
    expect(add).toBeDisabled();
    await userEvent.clear(box);
    expect(screen.getByLabelText("Add by enroll code")).toBe(
      screen.getByTestId("RecruitmentCoursesPage-enrollCode"),
    );
    await userEvent.type(
      screen.getByTestId("RecruitmentCoursesPage-enrollCode"),
      " 07600 ",
    );
    expect(add).toBeEnabled();
    await userEvent.click(add);

    await waitFor(() =>
      expect(
        axiosMock.history.post.filter(
          (r) => r.url === "/api/recruitmentcourses/post",
        ),
      ).toHaveLength(1),
    );
    expect(
      axiosMock.history.post.find(
        (r) => r.url === "/api/recruitmentcourses/post",
      ).params,
    ).toEqual({ recruitmentId: "7", enrollCode: "07600" });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Added CMPSC   165A section 0100 (07600).",
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("RecruitmentCoursesPage-enrollCode"),
      ).toHaveValue(""),
    );
    // The list and the ranking summaries are re-fetched (beyond the refresh on open).
    await waitFor(() =>
      expect(getsOf("/api/recruitmentcourses/all")).toBeGreaterThan(courses),
    );
    await waitFor(() =>
      expect(
        getsOf("/api/instructor/recruitments/7/admin-course-rankings"),
      ).toBeGreaterThan(summaries),
    );
  });

  test("a refused enroll code shows the backend's reason and keeps the box", async () => {
    axiosMock.onPost("/api/recruitmentcourses/post").reply(400, {
      message: "Enroll code 07500 is section 0101, a discussion or lab",
    });
    renderPage();

    await userEvent.type(
      await screen.findByTestId("RecruitmentCoursesPage-enrollCode"),
      "07500",
    );
    await userEvent.click(screen.getByTestId("RecruitmentCoursesPage-add"));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Enroll code 07500 is section 0101, a discussion or lab",
      ),
    );
    expect(screen.getByTestId("RecruitmentCoursesPage-enrollCode")).toHaveValue(
      "07500",
    );
  });

  test("a section without a number is still announced", async () => {
    axiosMock
      .onPost("/api/recruitmentcourses/post")
      .reply(200, { ...recruitmentCoursesFixtures.oneManual, section: null });
    renderPage();

    await userEvent.type(
      await screen.findByTestId("RecruitmentCoursesPage-enrollCode"),
      "07600",
    );
    await userEvent.click(screen.getByTestId("RecruitmentCoursesPage-add"));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Added CMPSC   165A section  (07600).",
      ),
    );
  });

  test("Populate launches the job and points at the Jobs page", async () => {
    renderPage();
    await screen.findByTestId("RecruitmentCoursesPage-populate");
    await afterRefresh();
    await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-ranking-link");
    const courses = getsOf("/api/recruitmentcourses/all");
    const recruitments = getsOf("/api/admin/recruitments/all");
    const summaries = getsOf(
      "/api/instructor/recruitments/7/admin-course-rankings",
    );

    await userEvent.click(
      screen.getByTestId("RecruitmentCoursesPage-populate"),
    );

    const populatePosts = () =>
      axiosMock.history.post.filter(
        (r) => r.url === "/api/jobs/launch/populateRecruitmentCourses",
      );
    await waitFor(() => expect(populatePosts()).toHaveLength(1));
    expect(populatePosts()[0].params).toEqual({ recruitmentId: "7" });
    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockToast.mock.calls[0][0]).toMatch(/Jobs/);
    // The course list, the recruitment (its last-refreshed stamp) and the ranking summaries are
    // all read again.
    await waitFor(() =>
      expect(getsOf("/api/recruitmentcourses/all")).toBeGreaterThan(courses),
    );
    await waitFor(() =>
      expect(getsOf("/api/admin/recruitments/all")).toBeGreaterThan(
        recruitments,
      ),
    );
    await waitFor(() =>
      expect(
        getsOf("/api/instructor/recruitments/7/admin-course-rankings"),
      ).toBeGreaterThan(summaries),
    );
  });

  // ---- who may see the allocations (issues #178 and #224) ----

  test("the visibility panel sits under the hiring target and starts on admins only", async () => {
    renderPage();

    const panel = await screen.findByTestId(
      "RecruitmentCoursesPage-allocation-visibility",
    );
    expect(
      screen.getByTestId(
        "RecruitmentCoursesPage-allocation-visibility-message",
      ),
    ).toHaveTextContent("Allocation visibility: Admins only.");
    expect(
      screen.getByTestId("RecruitmentCoursesPage-allocation-visibility-change"),
    ).toHaveTextContent("Change");
    // Issue #358: the hiring target is no longer on the edit page; the panel is above the refresh line.
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-hiring-target"),
    ).toBeNull();
    const refreshed = screen.getByTestId(
      "RecruitmentCoursesPage-last-refreshed",
    );
    expect(
      panel.compareDocumentPosition(refreshed) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Nothing per course on a lecture's row, and no old buttons.
    expect(screen.queryByText("Released to faculty")).toBeNull();
    expect(screen.queryByText(/Release all/)).toBeNull();
  });

  test("changing the visibility saves it for this recruitment and re-reads the list", async () => {
    axiosMock.onPut("/api/admin/recruitments/allocationVisibility").reply(200, {
      ...recruitmentsFixtures.threeRecruitments[1],
      id: 7,
      allocationVisibility: "OWN_COURSES",
    });
    renderPage();

    const change = await screen.findByTestId(
      "RecruitmentCoursesPage-allocation-visibility-change",
    );
    const listReads = () =>
      axiosMock.history.get.filter(
        (r) => r.url === "/api/admin/recruitments/all",
      ).length;
    const before = listReads();
    await userEvent.click(change);
    await userEvent.click(
      await screen.findByTestId(
        "RecruitmentCoursesPage-allocation-visibility-modal-OWN_COURSES",
      ),
    );
    await userEvent.click(
      screen.getByTestId(
        "RecruitmentCoursesPage-allocation-visibility-modal-save",
      ),
    );

    await waitFor(() =>
      expect(
        axiosMock.history.put.filter(
          (r) => r.url === "/api/admin/recruitments/allocationVisibility",
        ),
      ).toHaveLength(1),
    );
    expect(
      axiosMock.history.put.find(
        (r) => r.url === "/api/admin/recruitments/allocationVisibility",
      ).params,
    ).toEqual({ id: 7, visibility: "OWN_COURSES" });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Allocation visibility is now: Faculty see their own courses.",
      ),
    );
    await waitFor(() => expect(listReads()).toBeGreaterThan(before));
  });

  test("a recruitment that already shows its allocations to faculty says so", async () => {
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, [
      {
        ...recruitmentsFixtures.threeRecruitments[1],
        id: 7,
        allocationVisibility: "ALL_COURSES",
      },
    ]);
    renderPage();

    expect(
      await screen.findByTestId(
        "RecruitmentCoursesPage-allocation-visibility-message",
      ),
    ).toHaveTextContent("Allocation visibility: Faculty see all courses.");
  });

  test("the visibility panel waits for the recruitment", async () => {
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, []);
    renderPage();

    await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-col-courseId");
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-allocation-visibility"),
    ).toBeNull();
  });

  // ---- Issue #185: hiding and showing columns ----

  test("leaves the columns stored as hidden out of the table", async () => {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(["room", "days"]));
    renderPage();

    await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-col-courseId");
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-header-room"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-header-days"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("RecruitmentCoursesPage-header-time"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("RecruitmentCoursesPage-columns-toggle"),
    ).toHaveTextContent("Columns (2 hidden)");
    // Nothing is asked of the server any more.
    expect(
      axiosMock.history.get.filter((r) => r.url === "/api/admin/hiddencolumns"),
    ).toHaveLength(0);
  });

  test("with nothing stored, only the default columns show (issue #300)", async () => {
    localStorage.clear();
    renderPage();

    await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-col-courseId");
    // Issue #358: the five budget columns are not on this page at all any more.
    const shown = ["courseId", "instructor", "enrollment", "maxEnroll"];
    for (const id of shown) {
      expect(
        screen.getByTestId(`RecruitmentCoursesPage-header-${id}`),
      ).toBeInTheDocument();
    }
    for (const id of [
      "section",
      "title",
      "instructorEmail",
      "days",
      "time",
      "room",
      "status",
      "removed",
      "rankingCount",
      "enrollmentEstimate",
      "allocation",
      "unroundedAllocation",
      "delta",
      "ratio",
    ]) {
      expect(
        screen.queryByTestId(`RecruitmentCoursesPage-header-${id}`),
      ).not.toBeInTheDocument();
    }
    // Opening the page stores nothing.
    expect(localStorage.getItem(HIDDEN_KEY)).toBeNull();
  });

  test("unticking a column in the Columns menu hides it and remembers that in local storage", async () => {
    renderPage();
    await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-col-courseId");

    await userEvent.click(
      screen.getByTestId("RecruitmentCoursesPage-columns-toggle"),
    );
    await userEvent.click(
      screen.getByTestId("RecruitmentCoursesPage-columns-room"),
    );

    await waitFor(() =>
      expect(
        screen.queryByTestId("RecruitmentCoursesPage-header-room"),
      ).not.toBeInTheDocument(),
    );
    expect(JSON.parse(localStorage.getItem(HIDDEN_KEY))).toEqual(["room"]);
    expect(
      axiosMock.history.put.filter((r) => r.url === "/api/admin/hiddencolumns"),
    ).toHaveLength(0);
  });

  test("a stored choice is restored on a later visit, and is kept per recruitment", async () => {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(["room"]));
    localStorage.setItem(
      "recruitmentCourses.hiddenColumns.8",
      JSON.stringify(["days"]),
    );
    renderPage();

    await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-col-courseId");
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-header-room"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("RecruitmentCoursesPage-header-days"),
    ).toBeInTheDocument();
  });

  test("Show All and Show None store the whole change", async () => {
    localStorage.clear();
    renderPage();
    await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-col-courseId");

    await userEvent.click(
      screen.getByTestId("RecruitmentCoursesPage-columns-toggle"),
    );
    await userEvent.click(
      screen.getByTestId("RecruitmentCoursesPage-columns-select-all"),
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("RecruitmentCoursesPage-header-room"),
      ).toBeInTheDocument(),
    );
    // Every column the menu offers is shown; Summer Session is not offered for this quarter, so it
    // stays as the defaults had it.
    expect(JSON.parse(localStorage.getItem(HIDDEN_KEY))).toEqual([
      "summerSession",
    ]);

    await userEvent.click(
      screen.getByTestId("RecruitmentCoursesPage-columns-select-none"),
    );
    await waitFor(() =>
      expect(
        screen.queryByTestId("RecruitmentCoursesPage-header-room"),
      ).not.toBeInTheDocument(),
    );
    // Every column the menu offers (the budget columns are not among them since issue #358), plus
    // the Summer Session column that was hidden already.
    expect(JSON.parse(localStorage.getItem(HIDDEN_KEY)).sort()).toEqual(
      [
        "summerSession",
        "rankingCount",
        "section",
        "title",
        "instructor",
        "instructorEmail",
        "days",
        "time",
        "room",
        "enrollment",
        "maxEnroll",
        "status",
        "removed",
      ].sort(),
    );
  });

  test("a stored value that is not a list of ids is ignored", async () => {
    localStorage.setItem(HIDDEN_KEY, "{not json");
    renderPage();
    await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-col-courseId");
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-header-room"),
    ).not.toBeInTheDocument();

    localStorage.setItem(HIDDEN_KEY, JSON.stringify([1, 2]));
    cleanup();
    renderPage();
    await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-col-courseId");
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-header-room"),
    ).not.toBeInTheDocument();
  });

  test("the Columns menu offers the Rankings column once reviews start, and never the course number", async () => {
    axiosMock
      .onGet("/api/admin/recruitments/all")
      .reply(200, [{ ...recruitmentsFixtures.threeRecruitments[1], id: 7 }]);
    renderPage();
    await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-ranking-link");

    await userEvent.click(
      screen.getByTestId("RecruitmentCoursesPage-columns-toggle"),
    );
    expect(
      screen.getByTestId("RecruitmentCoursesPage-columns-rankingCount"),
    ).toBeInTheDocument();
    // Issue #343: the course actions belong to the Assignments page alone.
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-columns-show-all-courses"),
    ).toBeNull();
    expect(
      screen.queryByTestId(
        "RecruitmentCoursesPage-columns-show-incomplete-courses",
      ),
    ).toBeNull();
    expect(
      screen.getByTestId("RecruitmentCoursesPage-columns-select-all"),
    ).toHaveTextContent("Show All");
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-columns-courseId"),
    ).not.toBeInTheDocument();
    // A winter recruitment has no Summer Session column to hide.
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-columns-summerSession"),
    ).not.toBeInTheDocument();
  });

  test("a summer recruitment has the Summer Session column and offers to hide it", async () => {
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, [
      {
        ...recruitmentsFixtures.threeRecruitments[2],
        id: 7,
        quarter: "20263",
      },
    ]);
    renderPage();
    await screen.findByTestId("RecruitmentCoursesPage-header-summerSession");

    await userEvent.click(
      screen.getByTestId("RecruitmentCoursesPage-columns-toggle"),
    );
    expect(
      screen.getByTestId("RecruitmentCoursesPage-columns-summerSession"),
    ).toBeInTheDocument();
  });

  /** Issue #225: Developer Mode's Fake Hiring Targets and Allocations, in the footer. */
  test("with developer mode on, the footer button opens the modal sized to the non-removed courses", async () => {
    axiosMock
      .onGet("/api/developerMode")
      .reply(200, { available: true, on: true });
    axiosMock
      .onPost("/api/admin/developer/fakeAllocations")
      .reply(200, notRemoved);
    // Even if a removed course is in the list, it does not count towards the default target.
    axiosMock
      .onGet("/api/recruitmentcourses/all", {
        params: { recruitmentId: "7", includeRemoved: false },
      })
      .reply(200, recruitmentCoursesFixtures.fourCourses);
    expect(notRemoved.length).toBeLessThan(
      recruitmentCoursesFixtures.fourCourses.length,
    );
    renderPage();

    const button = await screen.findByTestId(
      "RecruitmentCoursesPage-fake-allocations",
    );
    expect(button).toHaveTextContent("Fake Hiring Targets and Allocations");
    // Issue #252: every developer-mode control is red, like the badge it sits beside.
    expect(button).toHaveClass("btn-danger");
    expect(
      screen.queryByTestId(
        "RecruitmentCoursesPage-fake-allocations-modal-modal",
      ),
    ).not.toBeInTheDocument();

    await userEvent.click(button);
    expect(
      await screen.findByTestId(
        "RecruitmentCoursesPage-fake-allocations-modal-modal",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(
        "RecruitmentCoursesPage-fake-allocations-modal-target-7",
      ),
    ).toHaveValue(notRemoved.length);

    await userEvent.click(
      screen.getByTestId("RecruitmentCoursesPage-fake-allocations-modal-fake"),
    );
    await waitFor(() =>
      expect(
        axiosMock.history.post.filter(
          (r) => r.url === "/api/admin/developer/fakeAllocations",
        )[0].params,
      ).toEqual({
        recruitmentId: "7",
        hiringTarget: notRemoved.length,
        estimates: "MAX",
        setVisibility: true,
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByTestId(
          "RecruitmentCoursesPage-fake-allocations-modal-modal",
        ),
      ).not.toBeInTheDocument(),
    );
  });

  test("the fake allocations button is disabled while the courses load, and when there are none", async () => {
    axiosMock
      .onGet("/api/developerMode")
      .reply(200, { available: true, on: true });
    // The courses never arrive: the button is there, but there is nothing to fake yet.
    axiosMock
      .onGet("/api/recruitmentcourses/all", {
        params: { recruitmentId: "7", includeRemoved: false },
      })
      .reply(() => new Promise(() => {}));
    const { unmount } = renderPage();
    expect(
      await screen.findByTestId("RecruitmentCoursesPage-fake-allocations"),
    ).toBeDisabled();
    unmount();

    // A recruitment whose every course was removed has nothing to allocate to either.
    axiosMock
      .onGet("/api/recruitmentcourses/all", {
        params: { recruitmentId: "7", includeRemoved: false },
      })
      .reply(200, []);
    renderPage();
    const button = await screen.findByTestId(
      "RecruitmentCoursesPage-fake-allocations",
    );
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter(
          (r) => r.url === "/api/recruitmentcourses/all",
        ).length,
      ).toBeGreaterThan(1),
    );
    expect(button).toBeDisabled();
  });

  test("Cancel closes the fake allocations modal", async () => {
    axiosMock
      .onGet("/api/developerMode")
      .reply(200, { available: true, on: true });
    renderPage();

    await userEvent.click(
      await screen.findByTestId("RecruitmentCoursesPage-fake-allocations"),
    );
    await userEvent.click(
      await screen.findByTestId(
        "RecruitmentCoursesPage-fake-allocations-modal-cancel",
      ),
    );
    await waitFor(() =>
      expect(
        screen.queryByTestId(
          "RecruitmentCoursesPage-fake-allocations-modal-modal",
        ),
      ).not.toBeInTheDocument(),
    );
  });

  /** Issue #220: Developer Mode's Create Fake Rankings, in the footer beside the allocations. */
  const recruitmentWithReview = (reviewStatus) =>
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, [
      {
        ...recruitmentsFixtures.threeRecruitments[1],
        id: 7,
        reviewStatus,
      },
    ]);

  test("while the faculty review is Open, the footer button launches fake rankings", async () => {
    axiosMock
      .onGet("/api/developerMode")
      .reply(200, { available: true, on: true });
    recruitmentWithReview("Open");
    axiosMock
      .onPost("/api/admin/developer/fakeRankings")
      .reply(200, { id: 5, status: "running" });
    renderPage();

    const button = await screen.findByTestId(
      "RecruitmentCoursesPage-fake-rankings",
    );
    expect(button).toHaveTextContent("Create Fake Rankings");
    await waitFor(() => expect(button).toBeEnabled());
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-fake-rankings-modal-modal"),
    ).not.toBeInTheDocument();

    await userEvent.click(button);
    expect(
      await screen.findByTestId(
        "RecruitmentCoursesPage-fake-rankings-modal-modal",
      ),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByTestId("RecruitmentCoursesPage-fake-rankings-modal-create"),
    );

    await waitFor(() =>
      expect(
        axiosMock.history.post.filter(
          (r) => r.url === "/api/admin/developer/fakeRankings",
        )[0].params,
      ).toEqual({
        recruitmentId: "7",
        scope: "ALL",
        includeNotInterested: false,
      }),
    );
    expect(
      await screen.findByTestId(
        "RecruitmentCoursesPage-fake-rankings-modal-launched-modal",
      ),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByTestId(
        "RecruitmentCoursesPage-fake-rankings-modal-launched-close",
      ),
    );
    await waitFor(() =>
      expect(
        screen.queryByTestId(
          "RecruitmentCoursesPage-fake-rankings-modal-launched-modal",
        ),
      ).not.toBeInTheDocument(),
    );
  });

  test("Cancel closes the fake rankings modal", async () => {
    axiosMock
      .onGet("/api/developerMode")
      .reply(200, { available: true, on: true });
    renderPage();

    const button = await screen.findByTestId(
      "RecruitmentCoursesPage-fake-rankings",
    );
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    await userEvent.click(
      await screen.findByTestId(
        "RecruitmentCoursesPage-fake-rankings-modal-cancel",
      ),
    );
    await waitFor(() =>
      expect(
        screen.queryByTestId(
          "RecruitmentCoursesPage-fake-rankings-modal-modal",
        ),
      ).not.toBeInTheDocument(),
    );
  });

  test.each(["NotStarted", "Closed"])(
    "the fake rankings button is disabled while the faculty review is %s",
    async (reviewStatus) => {
      axiosMock
        .onGet("/api/developerMode")
        .reply(200, { available: true, on: true });
      recruitmentWithReview(reviewStatus);
      renderPage();

      const button = await screen.findByTestId(
        "RecruitmentCoursesPage-fake-rankings",
      );
      await waitFor(() =>
        expect(
          axiosMock.history.get.filter(
            (r) => r.url === "/api/admin/recruitments/all",
          ).length,
        ).toBeGreaterThan(0),
      );
      await screen.findByTestId("RecruitmentCoursesPage-fake-allocations");
      expect(button).toBeDisabled();
    },
  );

  test("there is no fake rankings button while developer mode is off", async () => {
    axiosMock
      .onGet("/api/developerMode")
      .reply(200, { available: true, on: false });
    renderPage();

    await screen.findByTestId("RecruitmentCoursesPage-populate");
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-fake-rankings"),
    ).not.toBeInTheDocument();
  });

  test("there is no fake allocations button while developer mode is off", async () => {
    axiosMock
      .onGet("/api/developerMode")
      .reply(200, { available: true, on: false });
    renderPage();

    await screen.findByTestId("RecruitmentCoursesPage-populate");
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter((r) => r.url === "/api/developerMode")
          .length,
      ).toBeGreaterThan(0),
    );
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-fake-allocations"),
    ).not.toBeInTheDocument();
  });

  /** Issue #358: the rankings download moved to the recruitment's card on the home page. */
  test("has no Download Rankings CSV: it is on the recruitment card", async () => {
    renderPage();
    await screen.findByTestId("RecruitmentCoursesPage-show-removed");

    expect(
      screen.queryByTestId("RecruitmentCoursesPage-rankings-csv"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Download Rankings CSV")).not.toBeInTheDocument();
  });

  // ---- Issue #358, part 3: the budget columns and their controls are on the Combined Allocation page ----

  test.each([true, false])(
    "the budget columns and their controls are not on the page (edit: %s), which points to the combined page",
    async (edit) => {
      localStorage.clear();
      renderPage({ edit });
      await screen.findByTestId(
        "RecruitmentCoursesPage-cell-row-0-col-courseId",
      );
      if (edit) {
        await screen.findByTestId(
          "RecruitmentCoursesPage-allocation-visibility",
        );
      } else {
        await screen.findByTestId("RecruitmentCoursesPage-hiring-target");
      }

      for (const id of [
        "enrollmentEstimate",
        "allocation",
        "unroundedAllocation",
        "delta",
        "ratio",
      ]) {
        expect(
          screen.queryByTestId(`RecruitmentCoursesPage-header-${id}`),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByTestId(`RecruitmentCoursesPage-footer-${id}`),
        ).not.toBeInTheDocument();
      }
      expect(
        screen.queryByTestId("RecruitmentCoursesPage-cell-row-0-allocation"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId(
          "RecruitmentCoursesPage-cell-row-0-enrollmentEstimate",
        ),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("RecruitmentCoursesPage-unrounded-heading"),
      ).not.toBeInTheDocument();
      for (const id of [
        "fill-estimates",
        "fill-estimates-max",
        "fill-estimates-actual",
        "auto-assign",
        "auto-assign-modal",
      ]) {
        expect(
          screen.queryByTestId(`RecruitmentCoursesPage-${id}`),
        ).not.toBeInTheDocument();
      }
      expect(screen.queryByText(/Set enrollment estimates from/)).toBeNull();
      expect(screen.queryByText(/Auto assign/)).toBeNull();
      // The totals row keeps what still applies.
      expect(
        screen.getByTestId("RecruitmentCoursesPage-footer-courseId"),
      ).toHaveTextContent("Total Course Count: 3");
      expect(
        screen.getByTestId("RecruitmentCoursesPage-footer-enrollment"),
      ).toHaveTextContent("380");

      // The Columns menu does not offer them either.
      await userEvent.click(
        screen.getByTestId("RecruitmentCoursesPage-columns-toggle"),
      );
      for (const id of [
        "enrollmentEstimate",
        "allocation",
        "unroundedAllocation",
        "delta",
        "ratio",
      ]) {
        expect(
          screen.queryByTestId(`RecruitmentCoursesPage-columns-${id}`),
        ).not.toBeInTheDocument();
      }
      expect(
        screen.getByTestId("RecruitmentCoursesPage-columns-removed"),
      ).toBeInTheDocument();

      // Where they went: the view page's pointer names the recruitment's quarter. The edit page
      // has no pointer (issue #358 follow-up).
      if (edit) {
        expect(
          screen.queryByTestId("RecruitmentCoursesPage-combined-pointer"),
        ).toBeNull();
        return;
      }
      const pointer = screen.getByTestId(
        "RecruitmentCoursesPage-combined-pointer",
      );
      expect(pointer).toHaveTextContent(
        "Enrollment estimates and allocations are not on this page: they are edited for TAs and ULAs together on the Combined Allocation page for W26.",
      );
      const link = screen.getByTestId("RecruitmentCoursesPage-combined-link");
      expect(link).toHaveTextContent("Combined Allocation page for W26");
      expect(link).toHaveAttribute("href", "/admin/allocations/W26");
      expect(pointer).toContainElement(link);
      // Right under the description, above the hiring target.
      expect(
        pointer.compareDocumentPosition(
          screen.getByTestId("RecruitmentCoursesPage-hiring-target"),
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    },
  );

  test("the pointer waits for the recruitment, whose quarter it needs", async () => {
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, []);
    renderPage({ edit: false });
    await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-col-courseId");

    expect(
      screen.queryByTestId("RecruitmentCoursesPage-combined-pointer"),
    ).not.toBeInTheDocument();
  });

  test("the pointer follows the recruitment's quarter", async () => {
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, [
      {
        ...recruitmentsFixtures.threeRecruitments[0],
        id: 7,
        quarter: "20263",
      },
    ]);
    renderPage({ edit: false });

    expect(
      await screen.findByTestId("RecruitmentCoursesPage-combined-link"),
    ).toHaveAttribute("href", "/admin/allocations/M26");
  });

  test("the hide link over a column hides it like the Columns menu (issue #314)", async () => {
    renderPage();
    await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-col-courseId");
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-header-courseId-hide"),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Hide Room column" }),
    );

    await waitFor(() =>
      expect(
        screen.queryByTestId("RecruitmentCoursesPage-header-room"),
      ).not.toBeInTheDocument(),
    );
    expect(JSON.parse(localStorage.getItem(HIDDEN_KEY))).toEqual(["room"]);
  });
});
