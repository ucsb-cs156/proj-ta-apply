import { render, screen, waitFor } from "@testing-library/react";
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

function renderPage() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/admin/recruitments/7/courses"]}>
        <Routes>
          <Route
            path="/admin/recruitments/:recruitmentId/courses"
            element={<RecruitmentCoursesPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

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
    axiosMock
      .onPost("/api/jobs/launch/populateRecruitmentCourses")
      .reply(200, { id: 1 });
    axiosMock.onPut("/api/recruitmentcourses/allocation").reply(200, {});
    axiosMock.onPut("/api/admin/recruitments/totalHiringTarget").reply(200, {});
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
        `Last refreshed from the UCSB schedule: ${new Date("2026-02-01T03:00:00").toLocaleString()}. Open, upcoming and recently closed recruitments are also refreshed automatically every night.`,
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
      "RecruitmentCoursesPage-header-allocation",
      "RecruitmentCoursesPage-header-status",
      "RecruitmentCoursesPage-header-summerSession",
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
    ).toHaveTextContent("No mapped faculty email addresses are available.");
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

  // ---- hiring target and allocations (issue #174) ----

  test("shows the hiring target above the refresh line, with the visible allocations added up", async () => {
    renderPage();

    const box = await screen.findByTestId(
      "RecruitmentCoursesPage-hiring-target-totalHiringTarget",
    );
    // Recruitment 7 is a ULA recruitment expecting 6; the three visible rows allocate 2 + 3 + 1.
    expect(box).toHaveValue(6);
    expect(
      screen.getByLabelText("Total number of ULAs expected to be hired:"),
    ).toBe(box);
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
    renderPage();

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
    renderPage();

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
    renderPage();
    await screen.findByTestId("RecruitmentCoursesPage-hiring-target-allocated");

    await userEvent.click(
      screen.getByTestId("RecruitmentCoursesPage-show-removed"),
    );

    // The removed row (allocation 1) appears, disabled, but the sum stays 6.
    expect(
      await screen.findByTestId("RecruitmentCoursesPage-cell-row-3-allocation"),
    ).toBeDisabled();
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
    renderPage();

    await waitFor(() =>
      expect(
        screen.getByTestId("RecruitmentCoursesPage-hiring-target-allocated"),
      ).toHaveTextContent("Allocated so far: 0"),
    );
  });

  test("typing a hiring target saves it and re-reads the recruitment", async () => {
    renderPage();
    const box = await screen.findByTestId(
      "RecruitmentCoursesPage-hiring-target-totalHiringTarget",
    );

    await userEvent.clear(box);
    await userEvent.type(box, "9");

    await waitFor(() =>
      expect(
        axiosMock.history.put.filter(
          (r) => r.url === "/api/admin/recruitments/totalHiringTarget",
        ),
      ).toHaveLength(1),
    );
    expect(
      axiosMock.history.put.find(
        (r) => r.url === "/api/admin/recruitments/totalHiringTarget",
      ).params,
    ).toEqual({ id: 7, totalHiringTarget: 9 });
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter(
          (r) => r.url === "/api/admin/recruitments/all",
        ).length,
      ).toBeGreaterThanOrEqual(2),
    );
  });

  test("typing an allocation saves it and re-reads the courses", async () => {
    renderPage();
    const box = await screen.findByTestId(
      "RecruitmentCoursesPage-cell-row-0-allocation",
    );

    await userEvent.clear(box);
    await userEvent.type(box, "7");

    await waitFor(() =>
      expect(
        axiosMock.history.put.filter(
          (r) => r.url === "/api/recruitmentcourses/allocation",
        ),
      ).toHaveLength(1),
    );
    expect(
      axiosMock.history.put.find(
        (r) => r.url === "/api/recruitmentcourses/allocation",
      ).params,
    ).toEqual({ id: 1, allocation: 7 });
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter(
          (r) => r.url === "/api/recruitmentcourses/all",
        ).length,
      ).toBeGreaterThanOrEqual(2),
    );
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
    // The list is re-fetched.
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter(
          (r) => r.url === "/api/recruitmentcourses/all",
        ).length,
      ).toBeGreaterThanOrEqual(2),
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

    await userEvent.click(
      screen.getByTestId("RecruitmentCoursesPage-populate"),
    );

    await waitFor(() => expect(axiosMock.history.post.length).toBe(1));
    expect(axiosMock.history.post[0].params).toEqual({ recruitmentId: "7" });
    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockToast.mock.calls[0][0]).toMatch(/Jobs/);
  });
});
