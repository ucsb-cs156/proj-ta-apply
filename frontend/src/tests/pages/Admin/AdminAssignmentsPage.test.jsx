import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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
    axiosMock.onGet("/api/admin/hiddencolumns").reply(200, []);
    axiosMock.onPut("/api/admin/hiddencolumns").reply(200, []);
  });

  test("heads the page with the recruitment, explains it, and asks for the recruitment's assignments", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", {
        name: "Assignments: TA positions, S26",
      }),
    ).toBeInTheDocument();
    // Issue #355: the issue's two paragraphs, word for word.
    expect(
      screen.getByTestId("AdminAssignmentsPage-intro-purpose").textContent,
    ).toBe(
      "On this page, the admin can assign TAs/ULA applicants to specific courses.",
    );
    expect(
      screen.getByTestId("AdminAssignmentsPage-intro-tentative").textContent,
    ).toBe(
      "These assignments are not visible to faculty or applicants until released by the admin, so all assignments are tentative at this stage.",
    );
    expect(
      screen.getByTestId("AdminAssignmentsPage-intro-purpose").tagName,
    ).toBe("P");
    expect(
      screen.getByTestId("AdminAssignmentsPage-intro-tentative").tagName,
    ).toBe("P");
    expect(screen.getByTestId("AdminAssignmentsPage-intro")).toContainElement(
      screen.getByTestId("AdminAssignmentsPage-intro-tentative"),
    );
    expect(
      screen.getByTestId("AdminAssignmentsPage-intro"),
    ).not.toHaveTextContent("Every real applicant");
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

  // ---- Issue #314: hiding and showing columns ----

  const hiddenColumnGets = () =>
    axiosMock.history.get.filter((r) => r.url === "/api/admin/hiddencolumns");
  const hiddenColumnPuts = () =>
    axiosMock.history.put.filter((r) => r.url === "/api/admin/hiddencolumns");

  test("asks the backend which columns are hidden and leaves them out of the table", async () => {
    axiosMock
      .onGet("/api/admin/hiddencolumns")
      .reply(200, ["major", "course-20"]);
    renderPage();

    await screen.findByTestId(
      "AdminAssignmentsPage-table-cell-row-0-col-email",
    );
    await waitFor(() =>
      expect(
        screen.queryByTestId("AdminAssignmentsPage-table-header-major"),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByTestId("AdminAssignmentsPage-table-header-course-20"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("AdminAssignmentsPage-table-header-course-10"),
    ).toBeInTheDocument();
    expect(hiddenColumnGets()).toHaveLength(1);
    expect(hiddenColumnGets()[0].params).toEqual({
      tableKey: "recruitmentAssignments",
      recruitmentId: "7",
    });
    expect(
      screen.getByTestId("AdminAssignmentsPage-columns-toggle"),
    ).toHaveTextContent("Columns (2 hidden)");
  });

  test("the Columns menu lists the identity columns and lectures, but not Tentative Assignment", async () => {
    renderPage();
    await screen.findByTestId(
      "AdminAssignmentsPage-table-cell-row-0-col-email",
    );
    await userEvent.click(
      screen.getByTestId("AdminAssignmentsPage-columns-toggle"),
    );
    expect(
      screen.getByTestId("AdminAssignmentsPage-columns-email"),
    ).toBeChecked();
    expect(
      screen.getByTestId("AdminAssignmentsPage-columns-course-30"),
    ).toBeChecked();
    expect(
      screen.queryByTestId("AdminAssignmentsPage-columns-tentativeAssignment"),
    ).not.toBeInTheDocument();
    // Issue #355: the lectures are named as the table heads them, in monospace.
    const label = screen.getByTestId(
      "AdminAssignmentsPage-columns-course-10-label",
    );
    expect(label.textContent).toBe("  8");
    expect(label).toHaveClass("font-monospace");
    expect(
      screen.queryByTestId("AdminAssignmentsPage-columns-email-label"),
    ).toBeNull();
  });

  test("with two sections of a course, the Columns menu and the headings name them by section (issue #355)", async () => {
    axiosMock
      .onGet("/api/admin/assignments")
      .reply(200, assignmentsFixtures.taPageManyCourses);
    renderPage();
    await screen.findByTestId(
      "AdminAssignmentsPage-table-cell-row-0-col-email",
    );
    expect(
      screen.getByTestId("AdminAssignmentsPage-table-course-103-label")
        .textContent,
    ).toBe("  8   (0100)");
    expect(
      screen.getByTestId("AdminAssignmentsPage-table-course-109-label")
        .textContent,
    ).toBe("190DD (0200)");
    expect(
      screen.getByTestId("AdminAssignmentsPage-table-course-101-label")
        .textContent,
    ).toBe("  5A");
    await userEvent.click(
      screen.getByTestId("AdminAssignmentsPage-columns-toggle"),
    );
    expect(
      screen.getByTestId("AdminAssignmentsPage-columns-course-104-label")
        .textContent,
    ).toBe("  8   (0200)");
    expect(
      screen.getByTestId("AdminAssignmentsPage-columns-course-108-label")
        .textContent,
    ).toBe("190DD (0100)");
    // The hide link's name is the same label (spaces collapsed in an accessible name).
    expect(
      screen.getByRole("button", { name: "Hide 190DD (0100) column" }),
    ).toHaveAttribute(
      "data-testid",
      "AdminAssignmentsPage-table-header-course-108-hide",
    );
  });

  test("unticking a column hides it on the backend and re-reads the list", async () => {
    axiosMock.onPut("/api/admin/hiddencolumns").reply(200, ["major"]);
    renderPage();
    await screen.findByTestId(
      "AdminAssignmentsPage-table-cell-row-0-col-email",
    );
    const getsBefore = hiddenColumnGets().length;

    await userEvent.click(
      screen.getByTestId("AdminAssignmentsPage-columns-toggle"),
    );
    await userEvent.click(
      screen.getByTestId("AdminAssignmentsPage-columns-major"),
    );

    await waitFor(() => expect(hiddenColumnPuts()).toHaveLength(1));
    expect(hiddenColumnPuts()[0].params).toEqual({
      tableKey: "recruitmentAssignments",
      recruitmentId: "7",
      columnId: "major",
      hidden: true,
    });
    await waitFor(() =>
      expect(hiddenColumnGets().length).toBeGreaterThan(getsBefore),
    );
  });

  test("the hide link over a column hides it like unticking it in the menu (issue #314)", async () => {
    axiosMock.onPut("/api/admin/hiddencolumns").reply(200, ["course-20"]);
    renderPage();
    await screen.findByTestId(
      "AdminAssignmentsPage-table-cell-row-0-col-email",
    );
    // The Tentative Assignment column cannot be hidden, so it has no link.
    expect(
      screen.queryByTestId(
        "AdminAssignmentsPage-table-header-tentativeAssignment-hide",
      ),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Hide 16 column" }),
    );

    await waitFor(() => expect(hiddenColumnPuts()).toHaveLength(1));
    expect(hiddenColumnPuts()[0].params).toEqual({
      tableKey: "recruitmentAssignments",
      recruitmentId: "7",
      columnId: "course-20",
      hidden: true,
    });
  });

  // ---- Issue #343: Show All Courses and Show Only Incomplete Courses ----
  // The fixture's lectures: course-10 has 1 of 2 assigned (incomplete), course-20 has 2 of 1
  // (over its target), course-30 has 0 of 0 (exactly at its target).

  const openColumns = async () => {
    await screen.findByTestId(
      "AdminAssignmentsPage-table-cell-row-0-col-email",
    );
    await userEvent.click(
      screen.getByTestId("AdminAssignmentsPage-columns-toggle"),
    );
  };
  const putSummary = () =>
    hiddenColumnPuts()
      .map((r) => [r.params.columnId, r.params.hidden])
      .sort();

  test("the Columns menu offers Show All Courses and Show Only Incomplete Courses, with the tooltip", async () => {
    renderPage();
    await openColumns();
    expect(
      screen.getByTestId("AdminAssignmentsPage-columns-show-all-courses"),
    ).toHaveTextContent("Show All Courses");
    expect(
      screen.getByTestId(
        "AdminAssignmentsPage-columns-show-incomplete-courses",
      ),
    ).toHaveAccessibleDescription(
      "This will hide all course columns except the ones where the number of assigned TAs/ULAs is currently less than the hiring target.",
    );
  });

  test("Show Only Incomplete Courses hides the course at its target and the one over it, keeping the incomplete one and the other columns", async () => {
    axiosMock.onPut("/api/admin/hiddencolumns").reply(200, []);
    renderPage();
    await openColumns();
    await userEvent.click(
      screen.getByTestId(
        "AdminAssignmentsPage-columns-show-incomplete-courses",
      ),
    );
    await waitFor(() => expect(hiddenColumnPuts()).toHaveLength(2));
    expect(putSummary()).toEqual([
      ["course-20", true],
      ["course-30", true],
    ]);
    for (const p of hiddenColumnPuts()) {
      expect(p.params.tableKey).toBe("recruitmentAssignments");
      expect(p.params.recruitmentId).toBe("7");
    }
  });

  test("Show Only Incomplete Courses brings back a hidden incomplete course", async () => {
    axiosMock
      .onGet("/api/admin/hiddencolumns")
      .reply(200, ["course-10", "major"]);
    axiosMock.onPut("/api/admin/hiddencolumns").reply(200, []);
    renderPage();
    await openColumns();
    await userEvent.click(
      screen.getByTestId(
        "AdminAssignmentsPage-columns-show-incomplete-courses",
      ),
    );
    await waitFor(() => expect(hiddenColumnPuts()).toHaveLength(3));
    expect(putSummary()).toEqual([
      ["course-10", false],
      ["course-20", true],
      ["course-30", true],
    ]);
  });

  test("Show All Courses shows every hidden course column but not the other hidden ones", async () => {
    axiosMock
      .onGet("/api/admin/hiddencolumns")
      .reply(200, ["course-20", "course-30", "major"]);
    axiosMock.onPut("/api/admin/hiddencolumns").reply(200, []);
    renderPage();
    await openColumns();
    await userEvent.click(
      screen.getByTestId("AdminAssignmentsPage-columns-show-all-courses"),
    );
    await waitFor(() => expect(hiddenColumnPuts()).toHaveLength(2));
    expect(putSummary()).toEqual([
      ["course-20", false],
      ["course-30", false],
    ]);
  });

  test("after an assignment moves a course to its target, Show Only Incomplete Courses hides it", async () => {
    axiosMock.onPut("/api/admin/hiddencolumns").reply(200, []);
    renderPage();
    await openColumns();
    // taPageAfterMove: course-10 now has 0 of 2, course-20 has 2 of 1, course-30 has 1 of 0.
    // Drive the move through the page, then use the menu.
    await userEvent.selectOptions(
      screen.getByTestId(
        "AdminAssignmentsPage-table-cell-row-0-tentative-select",
      ),
      "10",
    );
    await waitFor(() => expect(tentativePuts()).toHaveLength(1));
    await userEvent.click(
      screen.getByTestId(
        "AdminAssignmentsPage-columns-show-incomplete-courses",
      ),
    );
    await waitFor(() => expect(hiddenColumnPuts().length).toBeGreaterThan(0));
    expect(putSummary()).toContainEqual(["course-20", true]);
  });
});

/** Issue #358: the Publish Assignments panel moved here from the bottom of the Courses edit page. */
describe("AdminAssignmentsPage: publishing the assignments (issue #358)", () => {
  const closed = {
    ...recruitmentsFixtures.threeRecruitments[0],
    id: 7,
    applicationStatus: "CLOSED",
    reviewStatus: "Closed",
  };

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
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, [closed]);
    axiosMock
      .onGet("/api/admin/assignments")
      .reply(200, assignmentsFixtures.taPage);
    axiosMock
      .onGet("/api/admin/assignments/cancelled")
      .reply(200, cancelledApplicationsFixtures.two);
    axiosMock.onGet("/api/admin/hiddencolumns").reply(200, []);
    axiosMock
      .onPut("/api/admin/recruitments/assignmentsPublished")
      .reply(200, { ...closed, assignmentsPublished: true });
  });

  test("the Publish Assignments button is at the top, under the heading and above the explanation, until published", async () => {
    renderPage();

    const button = await screen.findByTestId(
      "AdminAssignmentsPage-publish-button",
    );
    expect(button).toHaveTextContent("Publish Assignments");
    const heading = screen.getByRole("heading", { level: 1 });
    const intro = screen.getByTestId("AdminAssignmentsPage-intro");
    const panel = screen.getByTestId("AdminAssignmentsPage-publish");
    expect(
      heading.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      panel.compareDocumentPosition(intro) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.queryByTestId("AdminAssignmentsPage-publish-published"),
    ).toBeNull();
  });

  test("confirming publishes recruitment 7 and re-reads the recruitments", async () => {
    renderPage();
    await userEvent.click(
      await screen.findByTestId("AdminAssignmentsPage-publish-button"),
    );
    const modal = await screen.findByTestId(
      "AdminAssignmentsPage-publish-modal",
    );
    expect(modal).toHaveTextContent("Publish Assignments");
    const before = axiosMock.history.get.filter(
      (r) => r.url === "/api/admin/recruitments/all",
    ).length;

    await userEvent.click(
      screen.getByTestId("AdminAssignmentsPage-publish-confirm"),
    );

    await waitFor(() =>
      expect(
        axiosMock.history.put.filter(
          (r) => r.url === "/api/admin/recruitments/assignmentsPublished",
        ),
      ).toHaveLength(1),
    );
    expect(
      axiosMock.history.put.find(
        (r) => r.url === "/api/admin/recruitments/assignmentsPublished",
      ).params,
    ).toEqual({ id: 7, published: true });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("Assignments published."),
    );
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter(
          (r) => r.url === "/api/admin/recruitments/all",
        ).length,
      ).toBeGreaterThan(before),
    );
  });

  test("the modal says why it cannot publish while ranking is open (issue #237)", async () => {
    axiosMock
      .onGet("/api/admin/recruitments/all")
      .reply(200, [{ ...closed, reviewStatus: "Open" }]);
    renderPage();
    await userEvent.click(
      await screen.findByTestId("AdminAssignmentsPage-publish-button"),
    );

    expect(
      await screen.findByTestId("AdminAssignmentsPage-publish-refusal"),
    ).toHaveTextContent(
      "Close Faculty Ranking before releasing hiring decisions.",
    );
    expect(
      screen.getByTestId("AdminAssignmentsPage-publish-confirm"),
    ).toBeDisabled();
  });

  test("once published the page says so at the top, with a link to the published page, instead of the button", async () => {
    axiosMock
      .onGet("/api/admin/recruitments/all")
      .reply(200, [{ ...closed, assignmentsPublished: true }]);
    renderPage();

    const line = await screen.findByTestId(
      "AdminAssignmentsPage-publish-published",
    );
    expect(line).toHaveTextContent(
      "Assignments are published. Open the assignments page.",
    );
    expect(
      within(line).getByRole("link", { name: "Open the assignments page" }),
    ).toHaveAttribute("href", "/recruitments/7/assignments");
    const intro = screen.getByTestId("AdminAssignmentsPage-intro");
    expect(
      line.compareDocumentPosition(intro) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.queryByTestId("AdminAssignmentsPage-publish-button"),
    ).toBeNull();
  });

  test("nothing about publishing until the recruitment is known", async () => {
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, []);
    renderPage();
    await screen.findByTestId("AdminAssignmentsPage-intro");
    expect(screen.queryByTestId("AdminAssignmentsPage-publish")).toBeNull();
    expect(
      screen.queryByTestId("AdminAssignmentsPage-publish-published"),
    ).toBeNull();
  });
});

/** Issue #315: the progress thermometer under the heading, assignments made against the hiring target. */
describe("AdminAssignmentsPage: the progress thermometer (issue #315)", () => {
  const PROGRESS = "AdminAssignmentsPage-progress";
  // The fixture's lectures have 1 + 2 + 0 = 3 applicants assigned.
  const withTarget = (totalHiringTarget) => ({
    ...recruitmentsFixtures.threeRecruitments[0],
    id: 7,
    totalHiringTarget,
  });

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
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, [withTarget(6)]);
    axiosMock
      .onGet("/api/admin/assignments")
      .reply(200, assignmentsFixtures.taPage);
    axiosMock.onGet("/api/admin/assignments/cancelled").reply(200, []);
    axiosMock.onGet("/api/admin/hiddencolumns").reply(200, []);
  });

  test("shows the assignments made against the hiring target, between the heading and the publish panel", async () => {
    renderPage();
    await screen.findByRole("heading", {
      name: "Assignments: TA positions, S26",
    });
    await screen.findByTestId(
      "AdminAssignmentsPage-table-cell-row-0-col-email",
    );
    await waitFor(() =>
      expect(screen.getByTestId(`${PROGRESS}-text`)).toHaveTextContent(
        "Assignments made: 3 of 6 (50%)",
      ),
    );
    const bar = screen.getByRole("progressbar", {
      name: "Assignments made: 3 of 6 (50%)",
    });
    expect(bar).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByTestId(`${PROGRESS}-fill`)).toHaveStyle({
      width: "50%",
    });
    expect(screen.getByTestId(`${PROGRESS}-fill`)).toHaveTextContent("50%");
    expect(screen.getByTestId(PROGRESS)).toHaveStyle({
      width: "80%",
      maxWidth: "600px",
    });
    // Directly under the heading, above the Publish panel and the table.
    const heading = screen.getByRole("heading", { level: 1 });
    const thermometer = screen.getByTestId(PROGRESS);
    expect(
      heading.compareDocumentPosition(thermometer) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      thermometer.compareDocumentPosition(
        screen.getByTestId("AdminAssignmentsPage-publish"),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      thermometer.compareDocumentPosition(
        screen.getByTestId("AdminAssignmentsPage-table"),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // It agrees with the count line.
    expect(screen.getByTestId("AdminAssignmentsPage-count")).toHaveTextContent(
      "3 assigned so far",
    );
  });

  test("the fixture recruitment's target of 1 is over-assigned: a full red bar with the real numbers", async () => {
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, [withTarget(1)]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId(`${PROGRESS}-text`)).toHaveTextContent(
        "Assignments made: 3 of 1 (300%)",
      ),
    );
    expect(screen.getByTestId(`${PROGRESS}-fill`)).toHaveStyle({
      width: "100%",
    });
    expect(screen.getByTestId(`${PROGRESS}-fill`)).toHaveClass("bg-danger");
  });

  test("a target met exactly is green", async () => {
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, [withTarget(3)]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId(`${PROGRESS}-text`)).toHaveTextContent(
        "Assignments made: 3 of 3 (100%)",
      ),
    );
    expect(screen.getByTestId(`${PROGRESS}-fill`)).toHaveClass("bg-success");
  });

  test("a ULA recruitment with nothing assigned yet: 0 of its target", async () => {
    axiosMock
      .onGet("/api/admin/recruitments/all")
      .reply(200, [recruitmentsFixtures.threeRecruitments[1]]);
    axiosMock
      .onGet("/api/admin/assignments")
      .reply(200, assignmentsFixtures.ulaPage);
    renderPage(2);
    await waitFor(() =>
      expect(screen.getByTestId(`${PROGRESS}-text`)).toHaveTextContent(
        "Assignments made: 0 of 6 (0%)",
      ),
    );
    expect(screen.getByTestId(`${PROGRESS}-fill`)).toHaveStyle({
      width: "0%",
    });
    expect(screen.getByTestId(`${PROGRESS}-beside`)).toHaveTextContent("0%");
  });

  test("while the recruitment (and so its target) is not known, the bar is empty and says so", async () => {
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, []);
    renderPage();
    await screen.findByTestId(
      "AdminAssignmentsPage-table-cell-row-0-col-email",
    );
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter(
          (r) => r.url === "/api/admin/recruitments/all",
        ).length,
      ).toBeGreaterThan(0),
    );
    expect(screen.getByTestId(`${PROGRESS}-text`).textContent).toBe(
      "Assignments made: 3 so far, no hiring target set yet",
    );
    expect(screen.getByTestId(`${PROGRESS}-fill`)).toHaveStyle({
      width: "0%",
    });
    expect(screen.getByTestId(`${PROGRESS}-bar`)).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    expect(screen.getByTestId(`${PROGRESS}-text`)).not.toHaveTextContent("NaN");
  });

  test("the thermometer follows the counts a move comes back with", async () => {
    // The move's answer clears every lecture's count, so the bar goes from 3 of 6 to 0 of 6.
    axiosMock.onPut("/api/admin/assignments/tentative").reply(200, {
      ...assignmentsFixtures.taPageAfterMove,
      courses: assignmentsFixtures.taPageAfterMove.courses.map((course) => ({
        ...course,
        assigned: 0,
        left: course.allocation,
      })),
    });
    renderPage();
    const select = await screen.findByTestId(
      "AdminAssignmentsPage-table-cell-row-0-tentative-select",
    );
    await waitFor(() =>
      expect(screen.getByTestId(`${PROGRESS}-text`)).toHaveTextContent(
        "Assignments made: 3 of 6 (50%)",
      ),
    );

    await userEvent.selectOptions(select, "30");

    await waitFor(() =>
      expect(screen.getByTestId(`${PROGRESS}-text`)).toHaveTextContent(
        "Assignments made: 0 of 6 (0%)",
      ),
    );
    expect(screen.getByTestId("AdminAssignmentsPage-count")).toHaveTextContent(
      "0 assigned so far",
    );
  });
});

/** Issue #385: Developer Mode's Create Fake Rankings, in this page's footer since the Courses edit page lost it. */
describe("AdminAssignmentsPage: Create Fake Rankings (issue #385)", () => {
  const withReview = (reviewStatus) => ({
    ...recruitmentsFixtures.threeRecruitments[0],
    id: 7,
    reviewStatus,
  });
  const BUTTON = "AdminAssignmentsPage-fake-rankings";
  const WRAPPER = "AdminAssignmentsPage-fake-rankings-wrapper";
  const MODAL = "AdminAssignmentsPage-fake-rankings-modal";
  const OPEN_IT =
    "Faculty ranking must be Open for this recruitment; it is not started. Open it from the recruitment's card on the home page (Recruitment Steps, step 6: Open Faculty Ranking), which asks for a faculty ranking deadline.";
  const REOPEN_IT =
    "Faculty ranking must be Open for this recruitment; it is closed. Reopen it from the recruitment's card on the home page (Recruitment Steps, step 6: Open Faculty Ranking), which asks for a faculty ranking deadline.";
  const NO_COURSES =
    "The recruitment must have at least one course on offer to rank; it has none. Fill its course list with Populate on its Courses page.";
  const fakeRankingsPosts = () =>
    axiosMock.history.post.filter(
      (r) => r.url === "/api/admin/developer/fakeRankings",
    );
  const recruitmentsGets = () =>
    axiosMock.history.get.filter(
      (r) => r.url === "/api/admin/recruitments/all",
    );

  beforeEach(() => {
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
      .onGet("/api/developerMode")
      .reply(200, { available: true, on: true });
    axiosMock
      .onGet("/api/admin/recruitments/all")
      .reply(200, [withReview("Open")]);
    axiosMock
      .onGet("/api/admin/assignments")
      .reply(200, assignmentsFixtures.taPage);
    axiosMock.onGet("/api/admin/assignments/cancelled").reply(200, []);
    axiosMock.onGet("/api/admin/hiddencolumns").reply(200, []);
    axiosMock
      .onPost("/api/admin/developer/fakeRankings")
      .reply(200, { id: 5, status: "running" });
  });

  /** The page's data has arrived: the table has a row and the recruitment was read. */
  const loaded = async () => {
    await screen.findByTestId(
      "AdminAssignmentsPage-table-cell-row-0-col-email",
    );
    await waitFor(() => expect(recruitmentsGets().length).toBeGreaterThan(0));
  };

  test("while the review is Open and there are courses, the footer has a red enabled button that launches the job for this recruitment", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId(BUTTON)).toBeEnabled());

    const button = screen.getByTestId(BUTTON);
    expect(button).toHaveTextContent("Create Fake Rankings");
    // Issue #252: every usable developer-mode control is red, like the badge it sits beside.
    expect(button).toHaveClass("btn-danger", "btn-sm");
    expect(button).not.toHaveClass("btn-outline-secondary");
    expect(button).not.toHaveStyle({ pointerEvents: "none" });
    expect(
      screen.getByTestId("Footer-developer-mode-controls"),
    ).toContainElement(button);
    expect(screen.queryByTestId(WRAPPER)).toBeNull();
    expect(screen.queryByTestId(`${MODAL}-modal`)).toBeNull();

    await userEvent.click(button);
    expect(await screen.findByTestId(`${MODAL}-modal`)).toBeInTheDocument();
    // There are applicants, so nothing is said about them.
    expect(screen.queryByTestId(`${MODAL}-note`)).toBeNull();

    await userEvent.click(screen.getByTestId(`${MODAL}-create`));

    await waitFor(() => expect(fakeRankingsPosts()).toHaveLength(1));
    expect(fakeRankingsPosts()[0].params).toEqual({
      recruitmentId: "7",
      scope: "ALL",
      includeNotInterested: false,
    });
    expect(
      await screen.findByTestId(`${MODAL}-launched-modal`),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByTestId(`${MODAL}-launched-close`));
    await waitFor(() =>
      expect(screen.queryByTestId(`${MODAL}-launched-modal`)).toBeNull(),
    );
  });

  test("Cancel closes the modal without launching anything", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId(BUTTON)).toBeEnabled());
    await userEvent.click(screen.getByTestId(BUTTON));
    await userEvent.click(await screen.findByTestId(`${MODAL}-cancel`));
    await waitFor(() =>
      expect(screen.queryByTestId(`${MODAL}-modal`)).toBeNull(),
    );
    expect(fakeRankingsPosts()).toHaveLength(0);
  });

  test("with no applicants the modal says the job would rank nobody", async () => {
    axiosMock
      .onGet("/api/admin/assignments")
      .reply(200, { ...assignmentsFixtures.taPage, rows: [] });
    renderPage();
    await waitFor(() => expect(screen.getByTestId(BUTTON)).toBeEnabled());
    await userEvent.click(screen.getByTestId(BUTTON));
    expect(await screen.findByTestId(`${MODAL}-note`)).toHaveTextContent(
      "This recruitment has no applicants yet, so the job would rank nobody. Create fake applications on the recruitment's Applications page first.",
    );
  });

  /** A disabled button gets no mouse events, so the tooltip hangs off its wrapper. */
  const expectDisabledWithTooltip = async (text) => {
    const button = screen.getByTestId(BUTTON);
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Create Fake Rankings");
    // The look it had before: a neutral outline, small.
    expect(button).toHaveClass("btn-outline-secondary", "btn-sm");
    expect(button).not.toHaveClass("btn-danger");
    expect(button).toHaveStyle({ pointerEvents: "none" });
    const wrapper = screen.getByTestId(WRAPPER);
    expect(wrapper).toContainElement(button);
    expect(wrapper).toHaveClass("d-inline-block");
    expect(wrapper).toHaveAttribute("tabindex", "0");
    expect(
      screen.getByTestId("Footer-developer-mode-controls"),
    ).toContainElement(wrapper);

    fireEvent.mouseOver(wrapper);
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toBe(text);
    expect(tooltip).toHaveAttribute(
      "id",
      "AdminAssignmentsPage-fake-rankings-tooltip",
    );
  };

  test("while the review is not started the button is disabled, in its old neutral look, and the tooltip says to open faculty ranking", async () => {
    axiosMock
      .onGet("/api/admin/recruitments/all")
      .reply(200, [withReview("NotStarted")]);
    renderPage();
    await loaded();
    await expectDisabledWithTooltip(OPEN_IT);
  });

  test("while the review is closed the tooltip says to reopen it", async () => {
    axiosMock
      .onGet("/api/admin/recruitments/all")
      .reply(200, [withReview("Closed")]);
    renderPage();
    await loaded();
    await expectDisabledWithTooltip(REOPEN_IT);
  });

  test("with the review Open but no course on offer, the tooltip is about the courses alone", async () => {
    axiosMock.onGet("/api/admin/assignments").reply(200, {
      ...assignmentsFixtures.taPage,
      courses: assignmentsFixtures.taPage.courses.map((course) => ({
        ...course,
        historical: true,
      })),
    });
    renderPage();
    await loaded();
    await expectDisabledWithTooltip(NO_COURSES);
  });

  test("with neither condition met the tooltip gives both reasons, the review first", async () => {
    axiosMock
      .onGet("/api/admin/recruitments/all")
      .reply(200, [withReview("NotStarted")]);
    axiosMock
      .onGet("/api/admin/assignments")
      .reply(200, assignmentsFixtures.empty);
    renderPage();
    await screen.findByTestId("AdminAssignmentsPage-intro");
    await waitFor(() => expect(assignmentsGets()).toHaveLength(1));
    await waitFor(() => expect(recruitmentsGets().length).toBeGreaterThan(0));
    await expectDisabledWithTooltip(`${OPEN_IT} ${NO_COURSES}`);
  });

  test("an unknown recruitment: the review status is not known yet", async () => {
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, []);
    renderPage();
    await loaded();
    await expectDisabledWithTooltip(
      "Faculty ranking must be Open for this recruitment; it is not known yet. Open it from the recruitment's card on the home page (Recruitment Steps, step 6: Open Faculty Ranking), which asks for a faculty ranking deadline.",
    );
  });

  test("there is no button while developer mode is off", async () => {
    axiosMock
      .onGet("/api/developerMode")
      .reply(200, { available: true, on: false });
    renderPage();
    await loaded();
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter((r) => r.url === "/api/developerMode")
          .length,
      ).toBeGreaterThan(0),
    );
    expect(screen.queryByTestId(BUTTON)).toBeNull();
    expect(screen.queryByText("Create Fake Rankings")).toBeNull();
  });
});
