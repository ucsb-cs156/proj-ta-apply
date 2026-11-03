import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import ApplicationPage from "main/pages/Applications/ApplicationPage";
import applicationsFixtures from "fixtures/applicationsFixtures";
import courseSectionsFixtures from "fixtures/courseSectionsFixtures";
import courseInstructorsFixtures from "fixtures/courseInstructorsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import appSettingsFixtures from "fixtures/appSettingsFixtures";
import noticesFixtures from "fixtures/noticesFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const mockNavigate = vi.fn();
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mockNavigate,
}));

const axiosMock = new AxiosMockAdapter(axios);

const [, openUla, closedTa] = recruitmentsFixtures.threeRecruitments;
const application = applicationsFixtures.oneUlaApplication;

function renderPage(id = 2) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[`/applications/${id}`]}>
        <Routes>
          <Route path="/applications/:id" element={<ApplicationPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ApplicationPage tests", () => {
  beforeEach(() => {
    mockToast.mockClear();
    mockNavigate.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 0, 10, 12, 0, 0));

    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.userOnly);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
    axiosMock.onGet("/api/applications").reply(200, application);
    axiosMock.onGet("/api/applications/mine").reply(200, [application]);
    axiosMock
      .onGet("/api/recruitments/applicable")
      .reply(200, [openUla, closedTa]);
    axiosMock
      .onGet("/api/recruitments/courses")
      .reply(200, ["CMPSC     8", "CMPSC   156"]);
    axiosMock
      .onGet("/api/recruitments/instructors")
      .reply(200, courseInstructorsFixtures.twoCourses);
    axiosMock
      .onGet("/api/recruitments/sections")
      .reply(200, courseSectionsFixtures.cmpsc156);
    axiosMock
      .onGet("/api/recruitments/options")
      .reply(200, appSettingsFixtures.ulaOptions);
    // Chris's application agreed to the ULA notice, version 3.
    axiosMock.onGet("/api/notices").reply(200, noticesFixtures.ulaV1);
    axiosMock.onGet("/api/notices/current").reply(200, [noticesFixtures.ulaV1]);
  });

  /** The version agreed to is what is shown, fetched by id, not whatever is current. */
  /** Issue #150: the agreed notice is shown with its fields filled from the recruitment. */
  test("fills the notice's quarter and date fields from the recruitment", async () => {
    axiosMock.onGet("/api/notices").reply(200, {
      ...noticesFixtures.ulaV1,
      content: "Apply for ${quarter} by ${primaryConsiderationDate}.",
    });
    renderPage();
    expect(
      await screen.findByTestId("ApplicationPage-notice-content"),
    ).toHaveTextContent("Apply for Winter 2026 by January 20, 2026.");
  });

  test("an editable application shows the notice version it agreed to, already ticked", async () => {
    renderPage();

    const box = await screen.findByTestId("ApplicationPage-notice-agree");
    expect(box).toBeChecked();
    expect(
      screen.getByTestId("ApplicationPage-notice-version"),
    ).toHaveTextContent("Version 3");
    expect(
      axiosMock.history.get.filter((r) => r.url === "/api/notices")[0].params,
    ).toEqual({ id: 3 });
    // No need to ask for the current one when the agreed one is known.
    expect(
      axiosMock.history.get.filter((r) => r.url === "/api/notices/current"),
    ).toHaveLength(0);
  });

  /** An application from before any notice existed is asked to agree to the current one. */
  test("an application with no agreed version is shown the current notice, unticked", async () => {
    axiosMock
      .onGet("/api/applications")
      .reply(200, { ...application, noticeVersionId: null });

    renderPage();

    const box = await screen.findByTestId("ApplicationPage-notice-agree");
    expect(box).not.toBeChecked();
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter((r) => r.url === "/api/notices/current")[0]
          .params,
      ).toEqual({ type: "ULA" }),
    );
    expect(
      axiosMock.history.get.filter((r) => r.url === "/api/notices"),
    ).toHaveLength(0);
  });

  test("a closed application's summary shows the agreed notice read-only", async () => {
    // Closed on 2026-02-01: more than six months before this (issue #107).
    vi.setSystemTime(new Date(2026, 9, 1, 12, 0, 0));
    vi.setSystemTime(new Date(2026, 5, 1, 12, 0, 0));
    axiosMock
      .onGet("/api/recruitments/applicable")
      .reply(200, [{ ...openUla, applicationStatus: "CLOSED" }, closedTa]);

    renderPage();

    await screen.findByTestId("ApplicationPage-view-only");
    const box = await screen.findByTestId(
      "ApplicationPage-summary-notice-agree",
    );
    expect(box).toBeChecked();
    expect(box).toBeDisabled();
  });

  test("the editable form is fed the options for the application's recruitment", async () => {
    renderPage();

    const select = await screen.findByTestId("ApplicationPage-major");
    await waitFor(() =>
      expect([...select.options].map((o) => o.textContent)).toContain(
        "Mathematics",
      ),
    );
    // Chris's stored rating for React is pre-selected.
    expect(screen.getByTestId("ApplicationPage-topic-React-1")).toBeChecked();
    // And the stored interest level, on the ULA form's Interests table.
    expect(
      screen.getByTestId("ApplicationPage-interest-Tutoring-5"),
    ).toBeChecked();
    expect(
      axiosMock.history.get.filter(
        (r) => r.url === "/api/recruitments/options",
      )[0].params,
    ).toEqual({ recruitmentId: 2 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---- editable ----

  test("names the recruitment and shows the status", async () => {
    renderPage();

    expect(
      await screen.findByText("Your Application: ULA positions, W26"),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId("ApplicationPage-status"),
    ).toHaveTextContent("Status: PENDING");
  });

  /** The stored first choice is looked up against the application's own recruitment. */
  test("the first choice's lecture and section times are shown while editing", async () => {
    renderPage();

    expect(
      await screen.findByTestId(
        "ApplicationPage-firstChoiceSections-row-0-type",
      ),
    ).toHaveTextContent("Lecture");
    const request = axiosMock.history.get.find(
      (r) => r.url === "/api/recruitments/sections",
    );
    expect(request.params).toEqual({
      recruitmentId: application.recruitmentId,
      courseId: "CMPSC   156",
    });
  });

  test("before the deadline the whole application is editable", async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("ApplicationPage-firstName")).toHaveValue(
        "Chris",
      ),
    );
    expect(screen.getByTestId("ApplicationPage-submit")).toHaveTextContent(
      "Update Application",
    );
    expect(screen.queryByTestId("ApplicationPage-late")).toBeNull();
    expect(screen.queryByTestId("ApplicationPage-view-only")).toBeNull();
  });

  /** Issue #121: the instructors follow the course numbers while editing. */
  test("the editable form names each course's instructors", async () => {
    renderPage();

    const select = await screen.findByTestId(
      "ApplicationPage-firstChoiceCourse",
    );
    await waitFor(() =>
      expect([...select.options].map((o) => o.textContent)).toContain(
        "CMPSC   156 (CONRAD P)",
      ),
    );
    expect(
      axiosMock.history.get.filter(
        (r) => r.url === "/api/recruitments/instructors",
      )[0].params,
    ).toEqual({ recruitmentId: 2 });
  });

  test("saving an edit sends a PUT with the id", async () => {
    axiosMock.onPut("/api/applications").reply(200, application);

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("ApplicationPage-firstName")).toHaveValue(
        "Chris",
      ),
    );
    await userEvent.clear(screen.getByTestId("ApplicationPage-firstName"));
    await userEvent.type(
      screen.getByTestId("ApplicationPage-firstName"),
      "Christina",
    );
    // This application was saved with the I-9 box unticked; it is required now (issue #213).
    await userEvent.click(screen.getByTestId("ApplicationPage-i9Appointment"));
    await userEvent.click(screen.getByTestId("ApplicationPage-submit"));

    await waitFor(() => expect(axiosMock.history.put.length).toBe(1));
    expect(axiosMock.history.put[0].url).toBe("/api/applications");
    expect(axiosMock.history.put[0].params).toEqual({ id: "2" });
    expect(JSON.parse(axiosMock.history.put[0].data).firstName).toBe(
      "Christina",
    );
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Your application has been updated.",
      ),
    );
    // Editing stays on the page; only saving comments goes home (issue #101).
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // ---- late: past the deadline but still open ----

  /** Issue #98: the form stays, and the comments box joins it. */
  test("after the deadline the form is still offered, with the comments box as well", async () => {
    vi.setSystemTime(new Date(2026, 1, 1, 12, 0, 0));
    renderPage();

    expect(
      await screen.findByTestId("ApplicationPage-late-note"),
    ).toHaveTextContent("You can still update your application above");
    expect(
      screen.getByTestId("ApplicationPage-comments-postApplicationComments"),
    ).toHaveValue("I have since finished CS 130A.");
    await waitFor(() =>
      expect(screen.getByTestId("ApplicationPage-firstName")).toHaveValue(
        "Chris",
      ),
    );
    expect(screen.getByTestId("ApplicationPage-submit")).toHaveTextContent(
      "Update Application",
    );
    // The comments box comes after the form, with its own button.
    expect(
      screen
        .getByTestId("ApplicationPage-submit")
        .compareDocumentPosition(
          screen.getByTestId("ApplicationPage-comments-submit"),
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByTestId("ApplicationPage-view-only")).toBeNull();
  });

  test("saving comments sends a PUT to the comments endpoint", async () => {
    vi.setSystemTime(new Date(2026, 1, 1, 12, 0, 0));
    axiosMock.onPut("/api/applications/comments").reply(200, application);

    renderPage();

    const box = await screen.findByTestId(
      "ApplicationPage-comments-postApplicationComments",
    );
    await userEvent.clear(box);
    await userEvent.type(box, "Also took CS 190J.");
    await userEvent.click(
      screen.getByTestId("ApplicationPage-comments-submit"),
    );

    await waitFor(() => expect(axiosMock.history.put.length).toBe(1));
    expect(axiosMock.history.put[0].url).toBe("/api/applications/comments");
    expect(axiosMock.history.put[0].params).toEqual({
      id: "2",
      postApplicationComments: "Also took CS 190J.",
    });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("Your comments have been saved."),
    );
    // Issue #101: once saved, back to the home page.
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  // ---- comments only: closed within the last six months (issue #107) ----

  test("for six months after closing only the comments form is offered", async () => {
    // The closed TA (id 1) closed on 2026-02-01; the clock is 2026-01-10.
    axiosMock
      .onGet("/api/applications")
      .reply(200, { ...application, recruitmentId: 1 });
    renderPage(1);

    expect(
      await screen.findByTestId("ApplicationPage-comments-only"),
    ).toHaveTextContent(
      "Applications are closed, so this application can no longer be edited. You can still add comments below for six months after the closing date.",
    );
    expect(
      screen.getByTestId("ApplicationPage-comments-postApplicationComments"),
    ).toHaveValue("I have since finished CS 130A.");
    // The rest is shown back, but not as a form.
    expect(screen.queryByTestId("ApplicationPage-firstName")).toBeNull();
    expect(screen.queryByTestId("ApplicationPage-late")).toBeNull();
    expect(screen.queryByTestId("ApplicationPage-view-only")).toBeNull();
    expect(
      screen.getByTestId("ApplicationPage-summary-Major"),
    ).toHaveTextContent("Computer Science");
  });

  test("saving comments on a recently closed application sends a PUT", async () => {
    axiosMock
      .onGet("/api/applications")
      .reply(200, { ...application, recruitmentId: 1 });
    axiosMock.onPut("/api/applications/comments").reply(200, application);
    renderPage(1);

    const box = await screen.findByTestId(
      "ApplicationPage-comments-postApplicationComments",
    );
    await userEvent.clear(box);
    await userEvent.type(box, "Graduated early.");
    await userEvent.click(
      screen.getByTestId("ApplicationPage-comments-submit"),
    );

    await waitFor(() => expect(axiosMock.history.put.length).toBe(1));
    expect(axiosMock.history.put[0].params).toEqual({
      id: "1",
      postApplicationComments: "Graduated early.",
    });
  });

  // ---- cancelled (issue #107) ----

  test("a cancelled application is read only whatever its recruitment is doing", async () => {
    axiosMock
      .onGet("/api/applications")
      .reply(200, applicationsFixtures.oneCancelledApplication);
    renderPage(4);

    expect(
      await screen.findByTestId("ApplicationPage-view-only"),
    ).toHaveTextContent(
      "You cancelled this application, so it can no longer be changed.",
    );
    expect(screen.getByTestId("ApplicationPage-status")).toHaveTextContent(
      "Status: CANCELLED",
    );
    expect(screen.queryByTestId("ApplicationPage-firstName")).toBeNull();
    expect(
      screen.queryByTestId("ApplicationPage-comments-postApplicationComments"),
    ).toBeNull();
    expect(
      screen.getByTestId("ApplicationPage-summary-Cancelled"),
    ).toHaveTextContent("Found other employment");
  });

  // ---- starting again after a cancellation (issue #318) ----

  const cancelled = applicationsFixtures.oneCancelledApplication;

  test("a cancelled application offers to start a new one while applications are open", async () => {
    axiosMock.onGet("/api/applications").reply(200, cancelled);
    axiosMock.onGet("/api/applications/mine").reply(200, [cancelled]);
    renderPage(4);

    const button = await screen.findByTestId("ApplicationPage-restart");
    expect(button).toHaveTextContent("Start a new application");
    expect(button).toHaveAttribute("href", "/apply/2");
    expect(
      screen.getByTestId("ApplicationPage-restart-note"),
    ).toHaveTextContent(
      "This one stays on file as cancelled. The new application starts empty, as if you had not applied.",
    );
    expect(screen.queryByTestId("ApplicationPage-new-application")).toBeNull();
  });

  test("the button waits for the applicant's list, so a new application is not missed", async () => {
    let answer;
    axiosMock.onGet("/api/applications").reply(200, cancelled);
    axiosMock
      .onGet("/api/applications/mine")
      .reply(() => new Promise((resolve) => (answer = resolve)));
    renderPage(4);

    await screen.findByTestId("ApplicationPage-view-only");
    expect(screen.queryByTestId("ApplicationPage-restart")).toBeNull();
    expect(screen.queryByTestId("ApplicationPage-new-application")).toBeNull();

    answer([200, [cancelled]]);
    expect(
      await screen.findByTestId("ApplicationPage-restart"),
    ).toBeInTheDocument();
  });

  test("once a new application has been started, the cancelled one points to it", async () => {
    axiosMock.onGet("/api/applications").reply(200, cancelled);
    axiosMock
      .onGet("/api/applications/mine")
      .reply(200, [application, cancelled]);
    renderPage(4);

    expect(
      await screen.findByTestId("ApplicationPage-new-application"),
    ).toHaveTextContent("You have since started a new application.");
    expect(
      screen.getByTestId("ApplicationPage-new-application-link"),
    ).toHaveAttribute("href", "/applications/2");
    expect(screen.queryByTestId("ApplicationPage-restart")).toBeNull();
  });

  test("another recruitment's application is not a replacement", async () => {
    axiosMock.onGet("/api/applications").reply(200, cancelled);
    axiosMock
      .onGet("/api/applications/mine")
      .reply(200, [{ ...application, recruitmentId: 99 }, cancelled]);
    renderPage(4);

    expect(
      await screen.findByTestId("ApplicationPage-restart"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("ApplicationPage-new-application")).toBeNull();
  });

  test("another cancelled application is not a replacement", async () => {
    axiosMock.onGet("/api/applications").reply(200, cancelled);
    axiosMock
      .onGet("/api/applications/mine")
      .reply(200, [{ ...cancelled, id: 5 }, cancelled]);
    renderPage(4);

    expect(
      await screen.findByTestId("ApplicationPage-restart"),
    ).toBeInTheDocument();
  });

  test("once applications have closed there is no button to start a new application", async () => {
    axiosMock.onGet("/api/applications").reply(200, cancelled);
    axiosMock.onGet("/api/applications/mine").reply(200, [cancelled]);
    axiosMock
      .onGet("/api/recruitments/applicable")
      .reply(200, [{ ...openUla, applicationStatus: "CLOSED" }, closedTa]);
    renderPage(4);

    await screen.findByTestId("ApplicationPage-view-only");
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter((r) => r.url === "/api/applications/mine"),
      ).toHaveLength(1),
    );
    expect(screen.queryByTestId("ApplicationPage-restart")).toBeNull();
    expect(screen.queryByTestId("ApplicationPage-new-application")).toBeNull();
  });

  test("a cancelled application whose recruitment is not on offer shows no button", async () => {
    axiosMock.onGet("/api/applications").reply(200, cancelled);
    axiosMock.onGet("/api/applications/mine").reply(200, [cancelled]);
    axiosMock.onGet("/api/recruitments/applicable").reply(200, []);
    renderPage(4);

    await screen.findByTestId("ApplicationPage-view-only");
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter((r) => r.url === "/api/applications/mine"),
      ).toHaveLength(1),
    );
    expect(screen.queryByTestId("ApplicationPage-restart")).toBeNull();
    expect(screen.queryByTestId("ApplicationPage-new-application")).toBeNull();
  });

  test("a closed application that was not cancelled does not claim a new one was started", async () => {
    vi.setSystemTime(new Date(2026, 9, 1, 12, 0, 0));
    const closed = {
      ...applicationsFixtures.oneTaApplication,
      recruitmentId: 1,
    };
    axiosMock.onGet("/api/applications").reply(200, closed);
    axiosMock.onGet("/api/applications/mine").reply(200, [closed]);

    renderPage(1);

    await screen.findByTestId("ApplicationPage-view-only");
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter((r) => r.url === "/api/applications/mine"),
      ).toHaveLength(1),
    );
    expect(screen.queryByTestId("ApplicationPage-new-application")).toBeNull();
    expect(screen.queryByTestId("ApplicationPage-restart")).toBeNull();
  });

  test("an application that was not cancelled never offers a new one", async () => {
    renderPage();

    await screen.findByTestId("ApplicationPage-status");
    expect(screen.queryByTestId("ApplicationPage-restart")).toBeNull();
    expect(screen.queryByTestId("ApplicationPage-new-application")).toBeNull();
  });

  // ---- view only ----

  test("a closed recruitment leaves nothing to change", async () => {
    // Closed on 2026-02-01: more than six months before this (issue #107).
    vi.setSystemTime(new Date(2026, 9, 1, 12, 0, 0));
    axiosMock.onGet("/api/applications").reply(200, {
      ...applicationsFixtures.oneTaApplication,
      recruitmentId: 1,
    });

    renderPage(1);

    expect(
      await screen.findByTestId("ApplicationPage-view-only"),
    ).toHaveTextContent("This recruitment is closed");
    expect(screen.queryByTestId("ApplicationPage-firstName")).toBeNull();
    expect(
      screen.queryByTestId("ApplicationPage-comments-postApplicationComments"),
    ).toBeNull();
    // The TA answers are shown back, since this was a TA application.
    expect(
      screen.getByTestId("ApplicationPage-summary-Residency Status"),
    ).toHaveTextContent("F1 Student Visa");
  });

  test("a closed application shows any comments that were saved", async () => {
    // Closed on 2026-02-01: more than six months before this (issue #107).
    vi.setSystemTime(new Date(2026, 9, 1, 12, 0, 0));
    axiosMock
      .onGet("/api/applications")
      .reply(200, { ...application, recruitmentId: 1 });

    renderPage(1);

    expect(
      await screen.findByTestId("ApplicationPage-saved-comments"),
    ).toHaveTextContent("I have since finished CS 130A.");
  });

  test("a closed application with no comments shows none", async () => {
    // Closed on 2026-02-01: more than six months before this (issue #107).
    vi.setSystemTime(new Date(2026, 9, 1, 12, 0, 0));
    axiosMock.onGet("/api/applications").reply(200, {
      ...application,
      recruitmentId: 1,
      postApplicationComments: null,
    });

    renderPage(1);

    await screen.findByTestId("ApplicationPage-view-only");
    expect(screen.queryByTestId("ApplicationPage-saved-comments")).toBeNull();
  });

  /** A 403 for someone else's application leaves nothing to show. */
  test("an application the user may not read shows nothing", async () => {
    axiosMock
      .onGet("/api/applications")
      .reply(403, { message: "That application belongs to someone else" });

    renderPage(5);

    expect(await screen.findByText("Your Application")).toBeInTheDocument();
    expect(screen.queryByTestId("ApplicationPage-status")).toBeNull();
    expect(screen.queryByTestId("ApplicationPage-firstName")).toBeNull();
  });

  /** Without its recruitment there is nothing to justify an edit control. */
  test("an unknown recruitment falls back to view only", async () => {
    axiosMock.onGet("/api/recruitments/applicable").reply(200, []);

    renderPage();

    expect(
      await screen.findByTestId("ApplicationPage-view-only"),
    ).toBeInTheDocument();
    expect(screen.getByText("Your Application")).toBeInTheDocument();
  });

  // ---- issue #302: the version check and the multi-tab warning ----

  const HEARTBEAT = /\/api\/applications\/heartbeat/;
  const admin = {
    label: "jane@ucsb.edu (Jane <b>Doe</b>)",
    samePerson: false,
    admin: true,
  };
  const me = { label: "ula@ucsb.edu (Chris)", samePerson: true };

  const heartbeats = () =>
    axiosMock.history.post.filter((r) =>
      r.url.startsWith("/api/applications/heartbeat"),
    );

  async function editAndSave() {
    await waitFor(() =>
      expect(screen.getByTestId("ApplicationPage-firstName")).toHaveValue(
        "Chris",
      ),
    );
    await userEvent.clear(screen.getByTestId("ApplicationPage-firstName"));
    await userEvent.type(
      screen.getByTestId("ApplicationPage-firstName"),
      "Christina",
    );
    await userEvent.click(screen.getByTestId("ApplicationPage-i9Appointment"));
    await userEvent.click(screen.getByTestId("ApplicationPage-submit"));
  }

  test("the heartbeat and the save name this tab by the same identifier, and the save carries the version", async () => {
    axiosMock
      .onGet("/api/applications")
      .reply(200, { ...application, version: 4 });
    axiosMock
      .onPut("/api/applications")
      .reply(200, { ...application, version: 5 });
    renderPage();

    await waitFor(() => expect(heartbeats().length).toBe(1));
    expect(heartbeats()[0].url).toBe("/api/applications/heartbeat?id=2");
    const clientId = heartbeats()[0].headers["X-Client-Id"];
    expect(clientId).toBeTruthy();

    await editAndSave();

    await waitFor(() => expect(axiosMock.history.put.length).toBe(1));
    expect(axiosMock.history.put[0].params).toEqual({ id: "2", version: 4 });
    expect(axiosMock.history.put[0].headers["X-Client-Id"]).toBe(clientId);
  });

  test("no heartbeat while the application is only to be read", async () => {
    axiosMock
      .onGet("/api/recruitments/applicable")
      .reply(200, [{ ...openUla, applicationStatus: "CLOSED" }, closedTa]);
    vi.setSystemTime(new Date(2026, 5, 1, 12, 0, 0));
    renderPage();

    await screen.findByTestId("ApplicationPage-view-only");
    expect(heartbeats()).toHaveLength(0);
    expect(screen.queryByTestId("ApplicationPage-multiple-tabs")).toBeNull();
  });

  test("an applicant is told that an admin has the application open, with the name as text", async () => {
    axiosMock.onPost(HEARTBEAT).reply(200, {
      others: [admin, me],
      heartbeatSeconds: 20,
      newest: false,
      arrivedAtMillis: 1,
    });
    renderPage();

    const banner = await screen.findByTestId("ApplicationPage-multiple-tabs");
    expect(banner).toHaveTextContent(
      "Admin jane@ucsb.edu (Jane <b>Doe</b>) has this application open for editing. We recommend that you close this window and try again in a few minutes. If this message persists, please reach out to jane@ucsb.edu",
    );
    expect(banner.querySelector("b")).toBeNull();
    // It is advice: the form is still there.
    expect(screen.getByTestId("ApplicationPage-submit")).toBeInTheDocument();
  });

  test("the applicant's own other tab is announced as before", async () => {
    axiosMock
      .onPost(HEARTBEAT)
      .reply(200, { others: [me], heartbeatSeconds: 20 });
    renderPage();

    expect(
      await screen.findByTestId("ApplicationPage-multiple-tabs"),
    ).toHaveTextContent(
      "You are also editing this application in another tab or window. Please know that this is risky; we recommend closing all but one of these.",
    );
  });

  test("the applicant who arrived last is asked, and may leave for the home page", async () => {
    const fetchMock = vi.fn().mockResolvedValue({});
    vi.stubGlobal("fetch", fetchMock);
    axiosMock.onPost(HEARTBEAT).reply(200, {
      others: [admin],
      heartbeatSeconds: 20,
      newest: true,
      arrivedAtMillis: 1,
    });
    renderPage();

    expect(
      await screen.findByTestId("ApplicationPage-multiple-tabs-modal-message"),
    ).toHaveTextContent("Admin jane@ucsb.edu (Jane <b>Doe</b>) has this");
    await userEvent.click(
      screen.getByTestId("ApplicationPage-multiple-tabs-modal-leave"),
    );

    expect(mockNavigate).toHaveBeenCalledWith("/");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/applications/leave?id=2",
      expect.objectContaining({ method: "POST", keepalive: true }),
    );
    vi.unstubAllGlobals();
  });

  test("a save from an old copy shows the conflict, not a toast, and Reload brings the latest", async () => {
    axiosMock
      .onGet("/api/applications")
      .reply(200, { ...application, version: 4 });
    axiosMock.onPut("/api/applications").reply(409, {
      message: "changed",
      version: 5,
      application: { ...application, version: 5 },
    });
    renderPage();

    await editAndSave();

    expect(
      await screen.findByTestId("ApplicationPage-conflict-message"),
    ).toHaveTextContent(
      "This application was changed in another tab or window, or by an admin. Reload to see the latest version.",
    );
    expect(mockToast).not.toHaveBeenCalled();

    axiosMock
      .onGet("/api/applications")
      .reply(200, { ...application, version: 5 });
    const before = axiosMock.history.get.filter(
      (r) => r.url === "/api/applications",
    ).length;
    await userEvent.click(
      screen.getByTestId("ApplicationPage-conflict-reload"),
    );

    await waitFor(() =>
      expect(screen.queryByTestId("ApplicationPage-conflict")).toBeNull(),
    );
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter((r) => r.url === "/api/applications")
          .length,
      ).toBeGreaterThan(before),
    );
  });

  test("any other failed save is toasted and shows no conflict", async () => {
    axiosMock.onPut("/api/applications").reply(500);
    renderPage();

    await editAndSave();

    await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("ApplicationPage-conflict")).toBeNull();
  });
});
