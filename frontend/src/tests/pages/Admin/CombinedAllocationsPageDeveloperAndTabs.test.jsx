import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import CombinedAllocationsPage from "main/pages/Admin/CombinedAllocationsPage";
import budgetFixtures from "fixtures/budgetFixtures";
import combinedAllocationsFixtures from "fixtures/combinedAllocationsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);

function renderPage(qyy = "F26") {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[`/admin/allocations/${qyy}`]}>
        <Routes>
          <Route
            path="/admin/allocations/:qyy"
            element={<CombinedAllocationsPage />}
          />
          <Route
            path="/admin/budget/:qyy"
            element={<div data-testid="budget-page">Budget page</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const BUDGET = "/api/admin/budget";
const COURSES = "/api/recruitmentcourses/all";
const HEARTBEAT = "/api/recruitmentcourses/heartbeat";
const HEARTBEAT_URL = /\/api\/recruitmentcourses\/heartbeat/;
const ADMIN_SENTENCE =
  "We recommend that only one admin edits this page at a time.";
const phill = {
  label: "phtcon@ucsb.edu (Phill Conrad)",
  samePerson: false,
  admin: true,
};
const chris = {
  label: "chris@ucsb.edu (Chris Gaucho)",
  samePerson: false,
  admin: true,
};
const alone = { others: [], heartbeatSeconds: 20, newest: true };

const heartbeats = (recruitmentId) =>
  axiosMock.history.post.filter(
    (r) =>
      r.url.startsWith(HEARTBEAT) &&
      (recruitmentId === undefined ||
        r.url === `${HEARTBEAT}?recruitmentId=${recruitmentId}`),
  );
/** Answers each recruitment's heartbeat with its own standing. */
const heartbeatAnswers = (byRecruitment) =>
  axiosMock.onPost(HEARTBEAT_URL).reply((config) => {
    const id = config.url.split("recruitmentId=")[1];
    return [200, byRecruitment[id] ?? alone];
  });
const posts = (url) => axiosMock.history.post.filter((r) => r.url === url);
const puts = (url) => axiosMock.history.put.filter((r) => r.url === url);
const developerMode = (on) =>
  axiosMock.onGet("/api/developerMode").reply(200, { available: true, on });

describe("CombinedAllocationsPage: multi-tab warning and developer fake data (issue #358)", () => {
  beforeEach(() => {
    localStorage.clear();
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.adminUser);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.developerModeAvailable);
    axiosMock
      .onGet(BUDGET, { params: { quarter: "20264" } })
      .reply(200, budgetFixtures.bothTypes);
    axiosMock
      .onGet(BUDGET, { params: { quarter: "20261" } })
      .reply(200, budgetFixtures.taOnlyOverBudget);
    axiosMock
      .onGet(BUDGET, { params: { quarter: "20262" } })
      .reply(200, budgetFixtures.ulaOnly);
    axiosMock
      .onGet(COURSES, { params: { recruitmentId: 3, includeRemoved: false } })
      .reply(200, [combinedAllocationsFixtures.ulaCourses[1]]);
    axiosMock
      .onGet(COURSES, { params: { recruitmentId: 5, includeRemoved: false } })
      .reply(200, combinedAllocationsFixtures.taCourses);
    axiosMock
      .onGet(COURSES, { params: { recruitmentId: 6, includeRemoved: false } })
      .reply(200, combinedAllocationsFixtures.ulaCourses);
    axiosMock
      .onGet(COURSES, { params: { recruitmentId: 1, includeRemoved: false } })
      .reply(200, [combinedAllocationsFixtures.taCourses[1]]);
    axiosMock
      .onGet("/api/admin/recruitments/all")
      .reply(200, combinedAllocationsFixtures.recruitments);
    axiosMock
      .onGet(/\/api\/instructor\/recruitments\/\d+\/admin-course-rankings/)
      .reply(200, []);
    axiosMock
      .onPut("/api/recruitmentcourses/enrollmentEstimates")
      .reply(200, []);
    axiosMock.onPost("/api/recruitmentcourses/autoAllocate").reply(200, []);
    axiosMock.onPut(BUDGET).reply(200, budgetFixtures.bothTypes);
    axiosMock.onPut("/api/recruitmentcourses/allocation").reply(200, {});
    axiosMock
      .onPut("/api/recruitmentcourses/enrollmentEstimate")
      .reply(200, {});
    axiosMock.onPost("/api/admin/developer/fakeAllocations").reply(200, []);
    axiosMock.onPost(HEARTBEAT_URL).reply(200, alone);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ---- item 14: the multi-tab warning ----

  test("heartbeats under each recruitment's Courses edit page key, as one tab", async () => {
    renderPage("F26");

    await waitFor(() => expect(heartbeats()).toHaveLength(2));
    expect(
      heartbeats()
        .map((r) => r.url)
        .sort(),
    ).toEqual([`${HEARTBEAT}?recruitmentId=5`, `${HEARTBEAT}?recruitmentId=6`]);
    const id = heartbeats()[0].headers["X-Client-Id"];
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(heartbeats()[1].headers["X-Client-Id"]).toBe(id);
    // Nothing is said about the quarter's budget.
    expect(posts(`${BUDGET}/heartbeat?quarter=20264`)).toHaveLength(0);
    expect(
      axiosMock.history.post.filter((r) => r.url.startsWith(BUDGET)),
    ).toHaveLength(0);
  });

  test("a quarter with one recruitment heartbeats for that one only", async () => {
    renderPage("W26");

    await waitFor(() => expect(heartbeats()).toHaveLength(1));
    expect(heartbeats()[0].url).toBe(`${HEARTBEAT}?recruitmentId=1`);
  });

  test("every allocation, estimate, fill and Auto assign save names the same tab; the conversion factor names none", async () => {
    renderPage("F26");
    await waitFor(() => expect(heartbeats()).toHaveLength(2));
    const id = heartbeats()[0].headers["X-Client-Id"];

    // An allocation of each type (CMPSC 156 is in both recruitments, row 2).
    fireEvent.change(
      await screen.findByTestId(
        "CombinedAllocationTable-cell-row-2-TA-allocation",
      ),
      { target: { value: "4" } },
    );
    fireEvent.change(
      screen.getByTestId("CombinedAllocationTable-cell-row-2-ULA-allocation"),
      { target: { value: "5" } },
    );
    await waitFor(() =>
      expect(puts("/api/recruitmentcourses/allocation")).toHaveLength(2),
    );
    puts("/api/recruitmentcourses/allocation").forEach((r) =>
      expect(r.headers["X-Client-Id"]).toBe(id),
    );

    // An estimate, saved on leaving the box, once per section (issue #381).
    const estimate = screen.getByTestId(
      "CombinedAllocationTable-cell-row-2-enrollmentEstimate",
    );
    fireEvent.change(estimate, { target: { value: "150" } });
    fireEvent.blur(estimate);
    await waitFor(() =>
      expect(puts("/api/recruitmentcourses/enrollmentEstimate")).toHaveLength(
        1,
      ),
    );
    puts("/api/recruitmentcourses/enrollmentEstimate").forEach((r) =>
      expect(r.headers["X-Client-Id"]).toBe(id),
    );

    // Set enrollment estimates from max: once per recruitment.
    fireEvent.click(
      screen.getByTestId("CombinedAllocationsPage-fill-estimates-max"),
    );
    await waitFor(() =>
      expect(puts("/api/recruitmentcourses/enrollmentEstimates")).toHaveLength(
        2,
      ),
    );
    puts("/api/recruitmentcourses/enrollmentEstimates").forEach((r) =>
      expect(r.headers["X-Client-Id"]).toBe(id),
    );

    // Auto assign.
    fireEvent.click(
      screen.getByTestId("CombinedAllocationsPage-auto-assign-TA"),
    );
    fireEvent.click(
      await screen.findByTestId("CombinedAllocationsPage-auto-assign-confirm"),
    );
    await waitFor(() =>
      expect(posts("/api/recruitmentcourses/autoAllocate")).toHaveLength(1),
    );
    expect(
      posts("/api/recruitmentcourses/autoAllocate")[0].headers["X-Client-Id"],
    ).toBe(id);

    // The conversion factor goes to the budget, which this page is not a tab of.
    fireEvent.change(
      screen.getByTestId("CombinedAllocationsPage-conversionTAtoULA"),
      { target: { value: "2" } },
    );
    await waitFor(() => expect(puts(BUDGET)).toHaveLength(1));
    expect(puts(BUDGET)[0].headers["X-Client-Id"]).toBeUndefined();
  });

  test("no warning while this is the only tab on both recruitments", async () => {
    renderPage("F26");
    await waitFor(() => expect(heartbeats()).toHaveLength(2));
    await screen.findByTestId(
      "CombinedAllocationTable-cell-row-2-TA-allocation",
    );

    expect(
      screen.queryByTestId("CombinedAllocationsPage-multiple-tabs"),
    ).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("another admin on one recruitment's edit page is named, with this page's noun, and the older tab is not asked", async () => {
    heartbeatAnswers({
      5: { others: [phill], heartbeatSeconds: 20, newest: false },
    });
    renderPage("F26");

    expect(
      await screen.findByTestId("CombinedAllocationsPage-multiple-tabs"),
    ).toHaveTextContent(
      `phtcon@ucsb.edu (Phill Conrad) is also editing this quarter's allocations. ${ADMIN_SENTENCE}`,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("the others of both recruitments are put together, each person once", async () => {
    heartbeatAnswers({
      5: { others: [phill], heartbeatSeconds: 20, newest: false },
      6: { others: [phill, chris], heartbeatSeconds: 20, newest: false },
    });
    renderPage("F26");

    const banner = await screen.findByTestId(
      "CombinedAllocationsPage-multiple-tabs",
    );
    await waitFor(() =>
      expect(banner).toHaveTextContent(
        `phtcon@ucsb.edu (Phill Conrad) and chris@ucsb.edu (Chris Gaucho) are also editing this quarter's allocations. ${ADMIN_SENTENCE}`,
      ),
    );
  });

  test("the tab that came after everyone on both recruitments is asked what to do", async () => {
    heartbeatAnswers({
      5: {
        others: [phill],
        heartbeatSeconds: 20,
        newest: true,
        arrivedAtMillis: 1000,
      },
      6: { ...alone, arrivedAtMillis: 1000 },
    });
    renderPage("F26");

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByTestId("CombinedAllocationsPage-multiple-tabs-modal-message"),
    ).toHaveTextContent(
      `phtcon@ucsb.edu (Phill Conrad) already has this quarter's allocations open for editing. ${ADMIN_SENTENCE}`,
    );
  });

  test("a tab that someone came after on one recruitment is not the newest, and is not asked", async () => {
    heartbeatAnswers({
      5: {
        others: [phill],
        heartbeatSeconds: 20,
        newest: true,
        arrivedAtMillis: 1000,
      },
      6: {
        others: [chris],
        heartbeatSeconds: 20,
        newest: false,
        arrivedAtMillis: 1000,
      },
    });
    renderPage("F26");

    const banner = await screen.findByTestId(
      "CombinedAllocationsPage-multiple-tabs",
    );
    await waitFor(() => expect(banner).toHaveTextContent("Chris Gaucho"));
    expect(banner).toHaveTextContent("are also editing");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("with one recruitment, the missing one has no say: the newest tab is asked, and leaving says goodbye for the one only", async () => {
    const fetchMock = vi.fn().mockResolvedValue({});
    vi.stubGlobal("fetch", fetchMock);
    heartbeatAnswers({
      1: {
        others: [phill],
        heartbeatSeconds: 20,
        newest: true,
        arrivedAtMillis: 1000,
      },
    });
    renderPage("W26");

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.click(
      screen.getByTestId("CombinedAllocationsPage-multiple-tabs-modal-leave"),
    );
    expect(await screen.findByTestId("budget-page")).toBeInTheDocument();
    const goodbyes = fetchMock.mock.calls.map(([url]) => url);
    expect(goodbyes.length).toBeGreaterThan(0);
    goodbyes.forEach((url) =>
      expect(url).toBe("/api/recruitmentcourses/leave?recruitmentId=1"),
    );
  });

  test("with only a ULA recruitment, the absent TA one has no say either", async () => {
    heartbeatAnswers({
      3: {
        others: [phill],
        heartbeatSeconds: 20,
        newest: true,
        arrivedAtMillis: 1000,
      },
    });
    renderPage("S26");

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(heartbeats().map((r) => r.url)).toEqual([
      `${HEARTBEAT}?recruitmentId=3`,
    ]);
  });

  test("Leave this page says goodbye for both recruitments and goes to the quarter's Budget page", async () => {
    const fetchMock = vi.fn().mockResolvedValue({});
    vi.stubGlobal("fetch", fetchMock);
    heartbeatAnswers({
      5: {
        others: [phill],
        heartbeatSeconds: 20,
        newest: true,
        arrivedAtMillis: 1000,
      },
      6: {
        others: [phill],
        heartbeatSeconds: 20,
        newest: true,
        arrivedAtMillis: 1000,
      },
    });
    renderPage("F26");
    await screen.findByRole("dialog");
    await waitFor(() => expect(heartbeats()).toHaveLength(2));
    const id = heartbeats()[0].headers["X-Client-Id"];

    fireEvent.click(
      screen.getByTestId("CombinedAllocationsPage-multiple-tabs-modal-leave"),
    );

    expect(await screen.findByTestId("budget-page")).toBeInTheDocument();
    const goodbyes = fetchMock.mock.calls
      .filter(([url]) => url.startsWith("/api/recruitmentcourses/leave"))
      .map(([url]) => url)
      .sort();
    // Once from the button, and once more each as the page unmounts.
    expect(new Set(goodbyes)).toEqual(
      new Set([
        "/api/recruitmentcourses/leave?recruitmentId=5",
        "/api/recruitmentcourses/leave?recruitmentId=6",
      ]),
    );
    fetchMock.mock.calls.forEach(([, options]) => {
      expect(options.keepalive).toBe(true);
      expect(options.headers["X-Client-Id"]).toBe(id);
    });
  });

  // ---- item 13: developer mode's fake data ----

  test("with developer mode on, the footer has the red allocations button and no fake rankings button (issue #385)", async () => {
    developerMode(true);
    // Both reviews Open and both recruitments with courses: the rankings button would have been
    // enabled here before issue #385 sent it to the Assignments pages.
    axiosMock.onGet("/api/admin/recruitments/all").reply(
      200,
      combinedAllocationsFixtures.recruitments.map((r) => ({
        ...r,
        reviewStatus: "Open",
      })),
    );
    renderPage("F26");

    const fake = await screen.findByTestId(
      "CombinedAllocationsPage-fake-allocations",
    );
    expect(fake).toHaveTextContent("Fake Hiring Targets and Allocations");
    expect(fake).toHaveClass("btn-danger");
    // Alone in the slot, it no longer keeps a gap for a neighbour.
    expect(fake).not.toHaveClass("me-2");
    expect(
      screen.getByTestId("Footer-developer-mode-controls"),
    ).toContainElement(fake);
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter(
          (r) => r.url === "/api/admin/recruitments/all",
        ).length,
      ).toBeGreaterThan(0),
    );
    expect(
      screen.queryByTestId("CombinedAllocationsPage-fake-rankings"),
    ).toBeNull();
    expect(screen.queryByText("Create Fake Rankings")).toBeNull();
  });

  test("with developer mode off there are no buttons", async () => {
    developerMode(false);
    renderPage("F26");

    await screen.findByTestId(
      "CombinedAllocationTable-cell-row-2-TA-allocation",
    );
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter((r) => r.url === "/api/developerMode"),
      ).toHaveLength(1),
    );
    expect(
      screen.queryByTestId("CombinedAllocationsPage-fake-allocations"),
    ).toBeNull();
  });

  test("one click of Fake Hiring Targets and Allocations acts on both recruitments, each box sized to its own courses", async () => {
    developerMode(true);
    renderPage("F26");

    const button = await screen.findByTestId(
      "CombinedAllocationsPage-fake-allocations",
    );
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);

    const prefix = "CombinedAllocationsPage-fake-allocations-modal";
    expect(await screen.findByTestId(`${prefix}-modal`)).toBeInTheDocument();
    expect(screen.getByLabelText("TA hiring target")).toBe(
      screen.getByTestId(`${prefix}-target-5`),
    );
    expect(screen.getByLabelText("ULA hiring target")).toBe(
      screen.getByTestId(`${prefix}-target-6`),
    );
    // Two TA courses and two ULA courses in the fixtures.
    expect(screen.getByTestId(`${prefix}-target-5`)).toHaveValue(2);
    expect(screen.getByTestId(`${prefix}-target-6`)).toHaveValue(2);

    await userEvent.clear(screen.getByTestId(`${prefix}-target-6`));
    await userEvent.type(screen.getByTestId(`${prefix}-target-6`), "3");
    await userEvent.click(screen.getByTestId(`${prefix}-fake`));

    await waitFor(() =>
      expect(posts("/api/admin/developer/fakeAllocations")).toHaveLength(2),
    );
    expect(
      posts("/api/admin/developer/fakeAllocations").map((r) => r.params),
    ).toEqual([
      {
        recruitmentId: 5,
        hiringTarget: 2,
        estimates: "MAX",
        setVisibility: true,
      },
      {
        recruitmentId: 6,
        hiringTarget: 3,
        estimates: "MAX",
        setVisibility: true,
      },
    ]);
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Faked hiring targets of 2 (TA) and 3 (ULA) and allocated them across the courses.",
      ),
    );
    await waitFor(() =>
      expect(screen.queryByTestId(`${prefix}-modal`)).not.toBeInTheDocument(),
    );
    // The lists, the recruitments and the budget summary are read again.
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter((r) => r.url === BUDGET).length,
      ).toBeGreaterThan(1),
    );
  });

  test("a recruitment without courses gets no box, and with none anywhere the button is disabled", async () => {
    developerMode(true);
    axiosMock
      .onGet(COURSES, { params: { recruitmentId: 6, includeRemoved: false } })
      .reply(200, []);
    renderPage("F26");

    const button = await screen.findByTestId(
      "CombinedAllocationsPage-fake-allocations",
    );
    await screen.findByTestId(
      "CombinedAllocationTable-cell-row-1-TA-allocation",
    );
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    const prefix = "CombinedAllocationsPage-fake-allocations-modal";
    expect(await screen.findByTestId(`${prefix}-target-5`)).toHaveValue(2);
    expect(screen.queryByTestId(`${prefix}-target-6`)).toBeNull();
    await userEvent.click(screen.getByTestId(`${prefix}-cancel`));
    await waitFor(() =>
      expect(screen.queryByTestId(`${prefix}-modal`)).not.toBeInTheDocument(),
    );
    expect(posts("/api/admin/developer/fakeAllocations")).toHaveLength(0);
  });

  test("with no courses in any recruitment the allocations button is disabled", async () => {
    developerMode(true);
    for (const recruitmentId of [5, 6]) {
      axiosMock
        .onGet(COURSES, { params: { recruitmentId, includeRemoved: false } })
        .reply(200, []);
    }
    renderPage("F26");

    const button = await screen.findByTestId(
      "CombinedAllocationsPage-fake-allocations",
    );
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter((r) => r.url === COURSES),
      ).toHaveLength(2),
    );
    await screen.findByText("Total Course Count: 0", { exact: false });
    expect(button).toBeDisabled();
  });

  test("the page never posts fake rankings: no request to the endpoint however the reviews stand (issue #385)", async () => {
    developerMode(true);
    axiosMock.onGet("/api/admin/recruitments/all").reply(
      200,
      combinedAllocationsFixtures.recruitments.map((r) => ({
        ...r,
        reviewStatus: "Open",
      })),
    );
    renderPage("W26");

    const allocations = await screen.findByTestId(
      "CombinedAllocationsPage-fake-allocations",
    );
    await waitFor(() => expect(allocations).toBeEnabled());
    expect(
      screen.queryByTestId("CombinedAllocationsPage-fake-rankings"),
    ).toBeNull();
    expect(
      screen.queryByTestId("CombinedAllocationsPage-fake-rankings-modal-modal"),
    ).toBeNull();
    expect(posts("/api/admin/developer/fakeRankings")).toHaveLength(0);
  });
});
