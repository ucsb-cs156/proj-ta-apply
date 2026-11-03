import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import AdminAssignmentsPage from "main/pages/Admin/AdminAssignmentsPage";
import assignmentsFixtures from "fixtures/assignmentsFixtures";
import cancelledApplicationsFixtures from "fixtures/cancelledApplicationsFixtures";
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

const mockNavigate = vi.fn();
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mockNavigate,
}));

const axiosMock = new AxiosMockAdapter(axios);

function renderPage(recruitmentId = 7) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter
        initialEntries={[`/admin/recruitments/${recruitmentId}/assignments`]}
      >
        <Routes>
          <Route
            path="/admin/recruitments/:recruitmentId/assignments"
            element={<AdminAssignmentsPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const assignmentsGets = () =>
  axiosMock.history.get.filter((r) => r.url === "/api/admin/assignments");
const heartbeats = () =>
  axiosMock.history.post.filter((r) =>
    r.url.startsWith("/api/admin/assignments/heartbeat"),
  );
const HEARTBEAT = /\/api\/admin\/assignments\/heartbeat/;
const tentativePuts = () =>
  axiosMock.history.put.filter(
    (r) => r.url === "/api/admin/assignments/tentative",
  );

describe("AdminAssignmentsPage tests (issue #179)", () => {
  beforeEach(() => {
    mockToast.mockClear();
    mockNavigate.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.adminUser);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
    // Recruitment 7 is a TA recruitment for S26; recruitment 2 a ULA one for W26.
    axiosMock
      .onGet("/api/admin/recruitments/all")
      .reply(200, [
        { ...recruitmentsFixtures.threeRecruitments[0], id: 7 },
        recruitmentsFixtures.threeRecruitments[1],
      ]);
    axiosMock
      .onGet("/api/admin/assignments")
      .reply(200, assignmentsFixtures.taPage);
    axiosMock
      .onPut("/api/admin/assignments/tentative")
      .reply(200, assignmentsFixtures.taPageAfterMove);
    axiosMock
      .onGet("/api/admin/assignments/cancelled")
      .reply(200, cancelledApplicationsFixtures.two);
  });

  test("heads the page with the recruitment, explains it, and asks for the recruitment's assignments", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", {
        name: "Assignments: TA positions, S26",
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("AdminAssignmentsPage-intro")).toHaveTextContent(
      "Every real applicant with each lecture's ranking of them. Choose a lecture under Tentative Assignment to pencil an applicant in; the counts under each lecture update at once. Tentative assignments are not shown to applicants or faculty at this stage.",
    );
    await waitFor(() => expect(assignmentsGets()).toHaveLength(1));
    expect(assignmentsGets()[0].params).toEqual({ recruitmentId: "7" });
    expect(
      await screen.findByTestId(
        "AdminAssignmentsPage-table-cell-row-0-col-email",
      ),
    ).toHaveTextContent("ada@ucsb.edu");
    expect(screen.getByTestId("AdminAssignmentsPage-count")).toHaveTextContent(
      "4 applicants, 3 lectures, 3 TAs allocated, 3 assigned so far.",
    );
    expect(
      screen.getByTestId("AdminAssignmentsPage-table-course-20-left"),
    ).toHaveTextContent("Left -1");
    expect(
      screen.getByTestId("AdminAssignmentsPage-table-course-20-left"),
    ).toHaveClass("text-danger");
  });

  test("choosing a lecture saves at once and the heading counts follow the response", async () => {
    // The GET keeps answering with the old page: the new counts can only come from the PUT.
    renderPage();

    const select = await screen.findByTestId(
      "AdminAssignmentsPage-table-cell-row-0-tentative-select",
    );
    expect(select).toHaveValue("10");
    expect(
      screen.getByTestId("AdminAssignmentsPage-table-course-10-assigned"),
    ).toHaveTextContent("Assigned 1");
    expect(
      screen.getByTestId("AdminAssignmentsPage-table-course-30-assigned"),
    ).toHaveTextContent("Assigned 0");

    await userEvent.selectOptions(select, "30");

    await waitFor(() => expect(tentativePuts()).toHaveLength(1));
    // The version the page last saw goes with the move, and the move names this tab.
    expect(tentativePuts()[0].params).toEqual({
      applicationId: 1,
      recruitmentCourseId: 30,
      version: 3,
    });
    expect(tentativePuts()[0].headers["X-Client-Id"]).toBe(
      heartbeats()[0].headers["X-Client-Id"],
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("AdminAssignmentsPage-table-course-30-assigned"),
      ).toHaveTextContent("Assigned 1"),
    );
    expect(
      screen.getByTestId("AdminAssignmentsPage-table-course-30-left"),
    ).toHaveTextContent("Left -1");
    expect(
      screen.getByTestId("AdminAssignmentsPage-table-course-30-left"),
    ).toHaveClass("text-danger");
    expect(
      screen.getByTestId("AdminAssignmentsPage-table-course-10-assigned"),
    ).toHaveTextContent("Assigned 0");
    expect(
      screen.getByTestId("AdminAssignmentsPage-table-course-10-left"),
    ).toHaveTextContent("Left 2");
    expect(
      screen.getByTestId(
        "AdminAssignmentsPage-table-cell-row-0-tentative-select",
      ),
    ).toHaveValue("30");
    // The response was enough: the list was not re-read, and nothing was toasted.
    expect(assignmentsGets()).toHaveLength(1);
    expect(mockToast).not.toHaveBeenCalled();
  });

  test("choosing the blank entry clears the assignment without a course parameter", async () => {
    renderPage();
    const select = await screen.findByTestId(
      "AdminAssignmentsPage-table-cell-row-1-tentative-select",
    );
    expect(select).toHaveValue("20");

    await userEvent.selectOptions(select, "");

    await waitFor(() => expect(tentativePuts()).toHaveLength(1));
    expect(tentativePuts()[0].params).toEqual({ applicationId: 2, version: 3 });
    expect(tentativePuts()[0].params).not.toHaveProperty("recruitmentCourseId");
  });

  test("a failed save is reported in a toast and the page keeps its data", async () => {
    axiosMock.onPut("/api/admin/assignments/tentative").reply(400, {
      message: "RecruitmentCourse 30 is not part of recruitment 7",
    });
    renderPage();
    const select = await screen.findByTestId(
      "AdminAssignmentsPage-table-cell-row-0-tentative-select",
    );

    await userEvent.selectOptions(select, "30");

    await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
    expect(mockToast).toHaveBeenCalledWith(
      expect.stringContaining("status code 400"),
    );
    expect(
      screen.getByTestId("AdminAssignmentsPage-table-course-10-assigned"),
    ).toHaveTextContent("Assigned 1");
  });

  test("a ULA recruitment: its heading, singular counts and its identity columns", async () => {
    axiosMock
      .onGet("/api/admin/assignments")
      .reply(200, assignmentsFixtures.ulaPage);
    renderPage(2);
    expect(
      await screen.findByRole("heading", {
        name: "Assignments: ULA positions, W26",
      }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByTestId("AdminAssignmentsPage-count"),
      ).toHaveTextContent(
        "1 applicant, 1 lecture, 3 ULAs allocated, 0 assigned so far.",
      ),
    );
    expect(assignmentsGets()[0].params).toEqual({ recruitmentId: "2" });
    expect(
      screen.getByTestId(
        "AdminAssignmentsPage-table-header-previousServiceAsUla",
      ),
    ).toHaveTextContent("Previous ULA Quarters");
  });

  test("an unknown recruitment and no applicants: a bare heading and zero counts", async () => {
    axiosMock
      .onGet("/api/admin/assignments")
      .reply(200, assignmentsFixtures.empty);
    renderPage(99);
    expect(
      await screen.findByRole("heading", { name: "Assignments" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(assignmentsGets()).toHaveLength(1));
    expect(screen.getByTestId("AdminAssignmentsPage-count")).toHaveTextContent(
      "0 applicants, 0 lectures, 0 TAs allocated, 0 assigned so far.",
    );
    expect(
      screen.queryByTestId("AdminAssignmentsPage-table-cell-row-0-col-email"),
    ).toBeNull();
  });

  // ---- issue #199 ----

  test("shows the legend and the cancelled applications of the recruitment", async () => {
    renderPage();

    const cancelled = await screen.findByTestId(
      "AdminAssignmentsPage-cancelled-table-cell-row-0-col-name",
    );
    expect(cancelled).toHaveTextContent("Grace Hopper");
    expect(
      screen.getByTestId("AdminAssignmentsPage-cancelled-why"),
    ).toHaveTextContent("cannot be assigned");
    const gets = axiosMock.history.get.filter(
      (r) => r.url === "/api/admin/assignments/cancelled",
    );
    expect(gets).toHaveLength(1);
    expect(gets[0].params).toEqual({ recruitmentId: "7" });
    expect(
      screen.getByTestId("AdminAssignmentsPage-legend"),
    ).toBeInTheDocument();
    // Legend above the table, cancelled list below it.
    const table = screen.getByTestId("AdminAssignmentsPage-table");
    expect(
      screen
        .getByTestId("AdminAssignmentsPage-legend")
        .compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      table.compareDocumentPosition(
        screen.getByTestId("AdminAssignmentsPage-cancelled"),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("says so when nobody has cancelled", async () => {
    axiosMock.onGet("/api/admin/assignments/cancelled").reply(200, []);
    renderPage();
    expect(
      await screen.findByTestId("AdminAssignmentsPage-cancelled-empty"),
    ).toHaveTextContent("No applicant has cancelled their application.");
  });

  // ---- the version check (issue #280) ----

  test("a stale move is refused: the page is refreshed from the answer, the message is shown and the click is not replayed", async () => {
    axiosMock.onPut("/api/admin/assignments/tentative").reply(409, {
      message:
        "Assignments changed while you were working. The page has been refreshed; please check the placement and try again.",
      assignments: assignmentsFixtures.taPageAfterMove,
    });
    renderPage();
    const select = await screen.findByTestId(
      "AdminAssignmentsPage-table-cell-row-0-tentative-select",
    );

    await userEvent.selectOptions(select, "10");

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Assignments changed while you were working. The page has been refreshed; please check the placement and try again.",
      ),
    );
    expect(mockToast).toHaveBeenCalledTimes(1);
    // The view now shows what is true, without another read, and nothing was sent again.
    await waitFor(() =>
      expect(
        screen.getByTestId("AdminAssignmentsPage-table-course-30-assigned"),
      ).toHaveTextContent("Assigned 1"),
    );
    expect(tentativePuts()).toHaveLength(1);
    expect(assignmentsGets()).toHaveLength(1);

    // The next move carries the version of the refreshed page.
    axiosMock
      .onPut("/api/admin/assignments/tentative")
      .reply(200, assignmentsFixtures.taPageAfterMove);
    await userEvent.selectOptions(
      screen.getByTestId(
        "AdminAssignmentsPage-table-cell-row-0-tentative-select",
      ),
      "10",
    );
    await waitFor(() => expect(tentativePuts()).toHaveLength(2));
    expect(tentativePuts()[1].params.version).toBe(4);
  });

  test("a conflict that carries no page is just reported", async () => {
    axiosMock
      .onPut("/api/admin/assignments/tentative")
      .reply(409, { message: "Changed." });
    renderPage();
    await userEvent.selectOptions(
      await screen.findByTestId(
        "AdminAssignmentsPage-table-cell-row-0-tentative-select",
      ),
      "30",
    );
    await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
    expect(mockToast).toHaveBeenCalledWith(
      expect.stringContaining("status code 409"),
    );
    expect(
      screen.getByTestId("AdminAssignmentsPage-table-course-10-assigned"),
    ).toHaveTextContent("Assigned 1");
  });

  test("only a conflict refreshes the page from the answer", async () => {
    axiosMock.onPut("/api/admin/assignments/tentative").reply(400, {
      message: "Not a conflict",
      assignments: assignmentsFixtures.taPageAfterMove,
    });
    renderPage();
    await userEvent.selectOptions(
      await screen.findByTestId(
        "AdminAssignmentsPage-table-cell-row-0-tentative-select",
      ),
      "30",
    );
    await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
    expect(mockToast).toHaveBeenCalledWith(
      expect.stringContaining("status code 400"),
    );
    expect(
      screen.getByTestId("AdminAssignmentsPage-table-course-10-assigned"),
    ).toHaveTextContent("Assigned 1");
  });

  test("a conflict with no body at all is just reported", async () => {
    axiosMock.onPut("/api/admin/assignments/tentative").reply(409, null);
    renderPage();
    await userEvent.selectOptions(
      await screen.findByTestId(
        "AdminAssignmentsPage-table-cell-row-0-tentative-select",
      ),
      "30",
    );
    await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
    expect(mockToast).toHaveBeenCalledWith(
      expect.stringContaining("status code 409"),
    );
  });

  test("a refusal from a lost session is logged and not toasted", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    axiosMock.onPut("/api/admin/assignments/tentative").reply(403, {});
    renderPage();
    await userEvent.selectOptions(
      await screen.findByTestId(
        "AdminAssignmentsPage-table-cell-row-0-tentative-select",
      ),
      "30",
    );
    await waitFor(() => expect(tentativePuts()).toHaveLength(1));
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(
        "Backend request failed",
        expect.anything(),
      ),
    );
    expect(mockToast).not.toHaveBeenCalled();
    error.mockRestore();
  });

  // ---- the multi-tab warning, whole page (issues #280 and #284) ----

  // The shared closing sentence of an admin page (issue #298), whoever the others are.
  const ADMIN_SENTENCE =
    "We recommend that only one admin edits this page at a time.";
  const phill = {
    label: "phtcon@ucsb.edu (Phill Conrad)",
    samePerson: false,
    admin: true,
  };
  const me = { label: "me@example.org (Me)", samePerson: true, admin: true };
  const MODAL = "AdminAssignmentsPage-multiple-tabs-modal";

  test("the page sends a heartbeat for its recruitment, and only that recruitment's", async () => {
    renderPage(7);
    await waitFor(() => expect(heartbeats().length).toBe(1));
    expect(heartbeats()[0].url).toBe(
      "/api/admin/assignments/heartbeat?recruitmentId=7",
    );
    expect(heartbeats()[0].headers["X-Client-Id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  test("no warning when no one else has the page, or when the heartbeat is unanswered", async () => {
    renderPage();
    await waitFor(() => expect(heartbeats().length).toBe(1));
    expect(
      screen.queryByTestId("AdminAssignmentsPage-multiple-tabs"),
    ).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("another admin is named in the banner, and an older tab is not interrupted", async () => {
    axiosMock.onPost(HEARTBEAT).reply(200, {
      others: [phill],
      heartbeatSeconds: 20,
      newest: false,
      arrivedAtMillis: 1000,
    });
    renderPage();

    expect(
      await screen.findByTestId("AdminAssignmentsPage-multiple-tabs"),
    ).toHaveTextContent(
      `phtcon@ucsb.edu (Phill Conrad) is also editing this assignments page. ${ADMIN_SENTENCE}`,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    // It is advice: the page is still there to use.
    expect(
      screen.getByTestId(
        "AdminAssignmentsPage-table-cell-row-0-tentative-select",
      ),
    ).toBeInTheDocument();
  });

  test("the admin's own other tab is announced as 'You are also editing...'", async () => {
    axiosMock
      .onPost(HEARTBEAT)
      .reply(200, { others: [me], heartbeatSeconds: 20 });
    renderPage();
    expect(
      await screen.findByTestId("AdminAssignmentsPage-multiple-tabs"),
    ).toHaveTextContent(
      `You are also editing this assignments page in another tab or window. ${ADMIN_SENTENCE}`,
    );
  });

  test("the newer tab of the admin's own says 'You already have...' with the admin sentence", async () => {
    axiosMock.onPost(HEARTBEAT).reply(200, {
      others: [me],
      heartbeatSeconds: 20,
      newest: true,
      arrivedAtMillis: 1000,
    });
    renderPage();
    expect(
      await screen.findByTestId("AdminAssignmentsPage-multiple-tabs"),
    ).toHaveTextContent(
      `You already have this assignments page open for editing in another tab or window. ${ADMIN_SENTENCE}`,
    );
  });

  test("the newest tab is asked what to do, and Continue anyway closes the modal and keeps the banner", async () => {
    axiosMock.onPost(HEARTBEAT).reply(200, {
      others: [phill],
      heartbeatSeconds: 20,
      newest: true,
      arrivedAtMillis: 1000,
    });
    renderPage();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    // The newer tab says who is "already" there.
    const already = `phtcon@ucsb.edu (Phill Conrad) already has this assignments page open for editing. ${ADMIN_SENTENCE}`;
    expect(screen.getByTestId(`${MODAL}-message`)).toHaveTextContent(already);
    expect(
      screen.getByTestId("AdminAssignmentsPage-multiple-tabs"),
    ).toHaveTextContent(already);

    fireEvent.click(screen.getByTestId(`${MODAL}-continue`));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.getByTestId("AdminAssignmentsPage-multiple-tabs"),
    ).toBeInTheDocument();
  });

  test("Leave this page says goodbye for this recruitment, naming this tab, and goes home", async () => {
    const fetchMock = vi.fn().mockResolvedValue({});
    vi.stubGlobal("fetch", fetchMock);
    axiosMock.onPost(HEARTBEAT).reply(200, {
      others: [phill],
      heartbeatSeconds: 20,
      newest: true,
      arrivedAtMillis: 1000,
    });
    renderPage();
    await screen.findByRole("dialog");
    await waitFor(() => expect(heartbeats().length).toBe(1));

    fireEvent.click(screen.getByTestId(`${MODAL}-leave`));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/assignments/leave?recruitmentId=7");
    expect(init.keepalive).toBe(true);
    expect(init.headers["X-Client-Id"]).toBe(
      heartbeats()[0].headers["X-Client-Id"],
    );
    expect(mockNavigate).toHaveBeenCalledWith("/");
    vi.unstubAllGlobals();
  });

  test("leaving the page by moving elsewhere in the app says goodbye", async () => {
    const fetchMock = vi.fn().mockResolvedValue({});
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = renderPage();
    await waitFor(() => expect(heartbeats().length).toBe(1));

    unmount();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/admin/assignments/leave?recruitmentId=7",
    );
    vi.unstubAllGlobals();
  });
});
