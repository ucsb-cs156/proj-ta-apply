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
const RISK =
  "Please know that this is risky; we recommend closing all but one of these.";
const phill = { label: "phtcon@ucsb.edu (Phill Conrad)", samePerson: false };

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
    axiosMock.onGet("/api/admin/hiddencolumns").reply(200, []);
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
    ).toHaveTextContent("Edit estimated enrollments, and TA/ULA allocations");
    await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-col-courseId");
    expect(heartbeats()).toHaveLength(0);
    expect(screen.queryByTestId("RecruitmentCoursesPage-view-link")).toBeNull();
  });

  test("the view-only page has nothing to edit", async () => {
    renderAt("/admin/recruitments/7/courses");
    await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-col-courseId");

    // The figures are text.
    expect(
      screen.getByTestId("RecruitmentCoursesPage-cell-row-0-allocation"),
    ).toHaveTextContent("2");
    expect(
      screen.getByTestId(
        "RecruitmentCoursesPage-cell-row-0-enrollmentEstimate",
      ),
    ).toHaveTextContent("220");
    expect(
      screen.getByTestId("RecruitmentCoursesPage-cell-row-0-allocation")
        .tagName,
    ).toBe("SPAN");
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
    expect(
      screen.getByTestId("RecruitmentCoursesPage-rankings-csv"),
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
    for (const id of [
      "populate",
      "add-form",
      "fill-estimates",
      "auto-assign",
      "allocation-visibility",
    ]) {
      expect(
        await screen.findByTestId(`RecruitmentCoursesPage-${id}`),
      ).toBeInTheDocument();
    }
    expect(
      screen.getByTestId("RecruitmentCoursesPage-cell-row-0-allocation")
        .tagName,
    ).toBe("INPUT");
    expect(
      screen.getByTestId(
        "RecruitmentCoursesPage-cell-row-0-col-removed-button",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-edit-button"),
    ).toBeNull();
  });

  test("the edit page heartbeats for its recruitment, and its saves name the same tab", async () => {
    axiosMock.onPut("/api/recruitmentcourses/allocation").reply(200, {
      ...notRemoved[0],
      allocation: 5,
      allocationVersion: 1,
    });
    renderAt("/admin/recruitments/7/courses/edit");
    await waitFor(() => expect(heartbeats()).toHaveLength(1));
    expect(heartbeats()[0].url).toBe(`${HEARTBEAT}?recruitmentId=7`);
    const id = heartbeats()[0].headers["X-Client-Id"];
    expect(id).toBeTruthy();

    await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-col-courseId");
    fireEvent.change(
      screen.getByTestId("RecruitmentCoursesPage-cell-row-0-allocation"),
      { target: { value: "5" } },
    );
    await waitFor(() => expect(axiosMock.history.put).toHaveLength(1));
    expect(axiosMock.history.put[0].headers["X-Client-Id"]).toBe(id);

    axiosMock
      .onPost("/api/recruitmentcourses/autoAllocate")
      .reply(200, notRemoved);
    fireEvent.click(screen.getByTestId("RecruitmentCoursesPage-auto-assign"));
    fireEvent.click(
      await screen.findByTestId("RecruitmentCoursesPage-auto-assign-confirm"),
    );
    await waitFor(() =>
      expect(
        axiosMock.history.post.find((r) =>
          r.url.startsWith("/api/recruitmentcourses/autoAllocate"),
        ),
      ).toBeDefined(),
    );
    expect(
      axiosMock.history.post.find((r) =>
        r.url.startsWith("/api/recruitmentcourses/autoAllocate"),
      ).headers["X-Client-Id"],
    ).toBe(id);

    axiosMock
      .onPut("/api/recruitmentcourses/enrollmentEstimates")
      .reply(200, notRemoved);
    fireEvent.click(
      screen.getByTestId("RecruitmentCoursesPage-fill-estimates-max"),
    );
    await waitFor(() =>
      expect(
        axiosMock.history.put.find((r) =>
          r.url.startsWith("/api/recruitmentcourses/enrollmentEstimates"),
        ),
      ).toBeDefined(),
    );
    expect(
      axiosMock.history.put.find((r) =>
        r.url.startsWith("/api/recruitmentcourses/enrollmentEstimates"),
      ).headers["X-Client-Id"],
    ).toBe(id);
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
      `phtcon@ucsb.edu (Phill Conrad) is also editing this page. ${RISK}`,
    );
    // An older tab is not asked.
    expect(screen.queryByRole("dialog")).toBeNull();
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
      `phtcon@ucsb.edu (Phill Conrad) is also editing this page. ${RISK}`,
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
