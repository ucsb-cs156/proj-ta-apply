import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import RecruitmentCoursesPage from "main/pages/Admin/RecruitmentCoursesPage";
import RecruitmentCoursesEditPage from "main/pages/Admin/RecruitmentCoursesEditPage";
import recruitmentCoursesFixtures from "fixtures/recruitmentCoursesFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);
const notRemoved = recruitmentCoursesFixtures.fourCourses.filter(
  (c) => !c.removed,
);
const HEARTBEAT = "/api/recruitmentcourses/heartbeat";
const HEARTBEAT_URL = /\/api\/recruitmentcourses\/heartbeat/;
const ADMIN_SENTENCE =
  "We recommend that only one admin edits this page at a time.";
const phill = {
  label: "phtcon@ucsb.edu (Phill Conrad)",
  samePerson: false,
  admin: true,
};

function renderAt(path) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/admin/recruitments/:recruitmentId/courses"
            element={<RecruitmentCoursesPage />}
          />
          <Route
            path="/admin/recruitments/:recruitmentId/courses/edit"
            element={<RecruitmentCoursesEditPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const heartbeats = () =>
  axiosMock.history.post.filter((r) => r.url.startsWith(HEARTBEAT));

describe("Courses view-only and edit pages (issue #278)", () => {
  beforeEach(() => {
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.adminUser);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
    // Issue #300: every column but the defaults starts hidden; these tests want the Remove button.
    localStorage.clear();
    localStorage.setItem("recruitmentCourses.hiddenColumns.7", "[]");
    axiosMock.onPost("/api/recruitmentcourses/refresh").reply(200, notRemoved);
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, [
      {
        ...recruitmentsFixtures.threeRecruitments[1],
        id: 7,
        totalHiringTarget: 10,
        allocationBulkVersion: 2,
      },
    ]);
    axiosMock.onGet("/api/recruitmentcourses/all").reply(200, notRemoved);
    axiosMock
      .onGet("/api/instructor/recruitments/7/admin-course-rankings")
      .reply(200, []);
  });

  // ---- the view-only page ----

  test("the view-only page has an Edit button with its explanation, and says nothing to the server about who is here", async () => {
    renderAt("/admin/recruitments/7/courses");

    const edit = await screen.findByTestId(
      "RecruitmentCoursesPage-edit-button",
    );
    expect(edit).toHaveTextContent("Edit");
    expect(edit).toHaveAttribute("href", "/admin/recruitments/7/courses/edit");
    expect(
      screen.getByTestId("RecruitmentCoursesPage-edit-text"),
    ).toHaveTextContent(
      "Click Edit to: change the number of TAs/ULAs expected to be hired; populate the course list, add a lecture by enroll code, or remove one; adjust the visibility of the allocations; publish the assignments.",
    );
    await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-col-courseId");
    expect(heartbeats()).toHaveLength(0);
    expect(screen.queryByTestId("RecruitmentCoursesPage-view-link")).toBeNull();
  });

  test("the view-only page describes the courses as the ones the department plans to hire for", async () => {
    renderAt("/admin/recruitments/7/courses");

    const text = await screen.findByTestId(
      "RecruitmentCoursesPage-description",
    );
    expect(text).toHaveTextContent(
      /^Courses for which the department is planning to hire (TA|ULA)s for [WSMF]\d\d\.$/,
    );
    // Populate lives on the edit page, so the view page does not explain it.
    expect(
      screen.queryByText(/Re-running Populate picks up newly flagged/),
    ).toBeNull();
  });

  test("the edit page keeps the Populate explanation", async () => {
    renderAt("/admin/recruitments/7/courses/edit");

    expect(
      await screen.findByText(/Re-running Populate picks up newly flagged/),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-description"),
    ).toBeNull();
  });

  test("the view-only page waits for the recruitment before naming its type and quarter", async () => {
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, []);
    renderAt("/admin/recruitments/7/courses");

    expect(
      await screen.findByTestId("RecruitmentCoursesPage-description"),
    ).toHaveTextContent(
      /^Courses for which the department is planning to hire TAs\/ULAs\.$/,
    );
  });

  test("both pages share one remembered choice of columns, default columns first", async () => {
    localStorage.clear();
    const view = renderAt("/admin/recruitments/7/courses");
    await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-col-courseId");
    expect(
      screen.getByTestId("RecruitmentCoursesPage-header-instructor"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-header-room"),
    ).toBeNull();

    fireEvent.click(
      screen.getByTestId("RecruitmentCoursesPage-columns-toggle"),
    );
    fireEvent.click(screen.getByTestId("RecruitmentCoursesPage-columns-room"));
    await screen.findByTestId("RecruitmentCoursesPage-header-room");
    view.unmount();

    renderAt("/admin/recruitments/7/courses/edit");
    await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-col-courseId");
    expect(
      screen.getByTestId("RecruitmentCoursesPage-header-room"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-header-days"),
    ).toBeNull();
  });

  test("the view-only page has nothing to edit", async () => {
    renderAt("/admin/recruitments/7/courses");
    await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-col-courseId");

    // Nothing can be typed into: the figures that were boxes are on the Combined Allocation page
    // since issue #358 and are not here at all.
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-cell-row-0-allocation"),
    ).toBeNull();
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-header-enrollmentEstimate"),
    ).toBeNull();
    expect(
      screen.getByTestId("RecruitmentCoursesPage-cell-row-0-col-enrollment"),
    ).toHaveTextContent("200");
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    // Every control that changes something is absent.
    for (const id of [
      "populate",
      "add-form",
      "fill-estimates",
      "auto-assign",
      "cell-row-0-col-removed-button",
      "allocation-visibility",
      "publish",
      "fake-allocations",
    ]) {
      expect(screen.queryByTestId(`RecruitmentCoursesPage-${id}`)).toBeNull();
    }
    // The hiring target is text, but still shown.
    expect(
      await screen.findByTestId(
        "RecruitmentCoursesPage-hiring-target-totalHiringTarget",
      ),
    ).toHaveTextContent("expected to be hired: 10");
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-multiple-tabs"),
    ).toBeNull();
    // Reading controls remain.
    expect(
      screen.getByTestId("RecruitmentCoursesPage-show-removed"),
    ).toBeInTheDocument();
  });

  test("the Edit button leads to the edit page", async () => {
    renderAt("/admin/recruitments/7/courses");
    fireEvent.click(
      await screen.findByTestId("RecruitmentCoursesPage-edit-button"),
    );

    expect(
      await screen.findByTestId("RecruitmentCoursesPage-view-link"),
    ).toHaveAttribute("href", "/admin/recruitments/7/courses");
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-edit-button"),
    ).toBeNull();
  });

  // ---- the edit page ----

  test("the edit page has the controls, and a way back to the view-only page", async () => {
    renderAt("/admin/recruitments/7/courses/edit");

    const back = await screen.findByTestId("RecruitmentCoursesPage-view-link");
    expect(back).toHaveTextContent("Back to the view-only page");
    expect(back).toHaveAttribute("href", "/admin/recruitments/7/courses");
    for (const id of ["populate", "add-form", "allocation-visibility"]) {
      expect(
        await screen.findByTestId(`RecruitmentCoursesPage-${id}`),
      ).toBeInTheDocument();
    }
    // Issue #358: the estimate fill, Auto assign and the boxes are on the Combined Allocation page.
    for (const id of ["fill-estimates", "auto-assign"]) {
      expect(screen.queryByTestId(`RecruitmentCoursesPage-${id}`)).toBeNull();
    }
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(1); // the hiring target
    expect(
      screen.getByTestId("RecruitmentCoursesPage-combined-link"),
    ).toHaveAttribute("href", "/admin/allocations/W26");
    expect(
      screen.getByTestId(
        "RecruitmentCoursesPage-cell-row-0-col-removed-button",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-edit-button"),
    ).toBeNull();
  });

  test("the edit page heartbeats for its recruitment, under the key the Combined Allocation page shares", async () => {
    renderAt("/admin/recruitments/7/courses/edit");
    await waitFor(() => expect(heartbeats()).toHaveLength(1));
    expect(heartbeats()[0].url).toBe(`${HEARTBEAT}?recruitmentId=7`);
    expect(heartbeats()[0].headers["X-Client-Id"]).toBeTruthy();

    // Issue #358: the saves that named the tab (allocations, estimates, the estimate fill and
    // Auto assign) are made from the Combined Allocation page now; nothing here makes them.
    await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-col-courseId");
    expect(axiosMock.history.put).toHaveLength(0);
    expect(
      axiosMock.history.post.filter(
        (r) => !r.url.startsWith(HEARTBEAT) && !r.url.includes("/refresh"),
      ),
    ).toHaveLength(0);
  });

  test("no warning when the edit page is alone", async () => {
    axiosMock
      .onPost(HEARTBEAT_URL)
      .reply(200, { others: [], heartbeatSeconds: 20, newest: true });
    renderAt("/admin/recruitments/7/courses/edit");
    await waitFor(() => expect(heartbeats()).toHaveLength(1));

    expect(
      screen.queryByTestId("RecruitmentCoursesPage-multiple-tabs"),
    ).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("another admin is named, with this page's noun", async () => {
    axiosMock.onPost(HEARTBEAT_URL).reply(200, {
      others: [phill],
      heartbeatSeconds: 20,
      newest: false,
      arrivedAtMillis: 1000,
    });
    renderAt("/admin/recruitments/7/courses/edit");

    expect(
      await screen.findByTestId("RecruitmentCoursesPage-multiple-tabs"),
    ).toHaveTextContent(
      `phtcon@ucsb.edu (Phill Conrad) is also editing this page. ${ADMIN_SENTENCE}`,
    );
    // An older tab is not asked.
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("the later edit page says the others already have it open, with the admin sentence", async () => {
    axiosMock.onPost(HEARTBEAT_URL).reply(200, {
      others: [phill],
      heartbeatSeconds: 20,
      newest: true,
      arrivedAtMillis: 1000,
    });
    renderAt("/admin/recruitments/7/courses/edit");

    expect(
      await screen.findByTestId("RecruitmentCoursesPage-multiple-tabs"),
    ).toHaveTextContent(
      `phtcon@ucsb.edu (Phill Conrad) already has this page open for editing. ${ADMIN_SENTENCE}`,
    );
  });

  test("the newest edit page is asked what to do", async () => {
    axiosMock.onPost(HEARTBEAT_URL).reply(200, {
      others: [phill],
      heartbeatSeconds: 20,
      newest: true,
      arrivedAtMillis: 1000,
    });
    renderAt("/admin/recruitments/7/courses/edit");

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByTestId("RecruitmentCoursesPage-multiple-tabs-modal-message"),
    ).toHaveTextContent(
      `phtcon@ucsb.edu (Phill Conrad) already has this page open for editing. ${ADMIN_SENTENCE}`,
    );
  });

  test("Leave this page says goodbye for this recruitment and goes to the view-only page", async () => {
    const fetchMock = vi.fn().mockResolvedValue({});
    vi.stubGlobal("fetch", fetchMock);
    axiosMock.onPost(HEARTBEAT_URL).reply(200, {
      others: [phill],
      heartbeatSeconds: 20,
      newest: true,
      arrivedAtMillis: 1000,
    });
    renderAt("/admin/recruitments/7/courses/edit");
    await screen.findByRole("dialog");
    await waitFor(() => expect(heartbeats()).toHaveLength(1));

    fireEvent.click(
      screen.getByTestId("RecruitmentCoursesPage-multiple-tabs-modal-leave"),
    );

    const call = fetchMock.mock.calls.find(([url]) =>
      url.startsWith("/api/recruitmentcourses/leave"),
    );
    expect(call[0]).toBe("/api/recruitmentcourses/leave?recruitmentId=7");
    expect(call[1].keepalive).toBe(true);
    expect(call[1].headers["X-Client-Id"]).toBe(
      heartbeats()[0].headers["X-Client-Id"],
    );
    expect(
      await screen.findByTestId("RecruitmentCoursesPage-edit-button"),
    ).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
