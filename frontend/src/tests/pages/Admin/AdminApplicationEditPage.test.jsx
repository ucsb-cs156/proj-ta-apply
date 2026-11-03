import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import AdminApplicationEditPage from "main/pages/Admin/AdminApplicationEditPage";
import applicationsFixtures from "fixtures/applicationsFixtures";
import appSettingsFixtures from "fixtures/appSettingsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import noticesFixtures from "fixtures/noticesFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import courseSectionsFixtures from "fixtures/courseSectionsFixtures";
import courseInstructorsFixtures from "fixtures/courseInstructorsFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);

const ula = applicationsFixtures.oneUlaApplication;
const ta = applicationsFixtures.oneTaApplication;

function renderPage(id = ula.id) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[`/admin/applications/${id}/edit`]}>
        <Routes>
          <Route
            path="/admin/applications/:id/edit"
            element={<AdminApplicationEditPage />}
          />
          <Route
            path="/admin/applications/:id"
            element={<p data-testid="view-page">the read-only view</p>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminApplicationEditPage tests", () => {
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
    axiosMock
      .onGet("/api/admin/recruitments/all")
      .reply(200, recruitmentsFixtures.threeRecruitments);
    axiosMock
      .onGet("/api/admin/applications", { params: { id: String(ula.id) } })
      .reply(200, ula);
    axiosMock
      .onGet("/api/admin/applications", { params: { id: String(ta.id) } })
      .reply(200, { ...ta, noticeVersionId: null });
    axiosMock
      .onGet("/api/recruitments/courses")
      .reply(200, ["CMPSC     8", "CMPSC   156"]);
    axiosMock
      .onGet("/api/recruitments/instructors")
      .reply(200, courseInstructorsFixtures.twoCourses);
    axiosMock
      .onGet("/api/recruitments/options")
      .reply(200, appSettingsFixtures.ulaOptions);
    axiosMock.onGet("/api/notices").reply(200, noticesFixtures.ulaV1);
    axiosMock
      .onGet("/api/recruitments/sections")
      .reply(200, courseSectionsFixtures.cmpsc156);
    axiosMock.onPut("/api/admin/applications").reply(200, ula);
  });

  /** Issue #150: the edit form fills the notice's fields from the recruitment. */
  test("fills the notice's quarter and date fields from the recruitment", async () => {
    axiosMock.onGet("/api/notices").reply(200, {
      ...noticesFixtures.ulaV1,
      content: "Apply for ${quarter} by ${primaryConsiderationDate}.",
    });
    renderPage();
    const content = await screen.findByTestId(
      "AdminApplicationEditPage-notice-content",
    );
    expect(content).toHaveTextContent(
      /Apply for (Winter|Spring) 2026 by (January 20|April 15), 2026\./,
    );
    expect(content).not.toHaveTextContent("${quarter}");
  });

  test("opens the applicant's form, filled in, for the application's recruitment", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: `Edit Application ${ula.id}: ULA positions, W26`,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("AdminApplicationEditPage-about"),
    ).toHaveTextContent(
      `Application from ${ula.email}. Every field you change is recorded in the audit trail.`,
    );
    // The ULA form, with the stored answers and the agreed notice already ticked.
    expect(
      screen.getByTestId("AdminApplicationEditPage-firstName"),
    ).toHaveValue(ula.firstName);
    // The interests list arrives with the options, after the application.
    expect(
      await screen.findByTestId("AdminApplicationEditPage-interest-Tutoring-5"),
    ).toBeChecked();
    expect(
      await screen.findByTestId("AdminApplicationEditPage-notice-agree"),
    ).toBeChecked();
    expect(
      screen.getByTestId("AdminApplicationEditPage-submit"),
    ).toHaveTextContent("Save Changes");

    await waitFor(() =>
      expect(
        axiosMock.history.get.filter(
          (r) => r.url === "/api/recruitments/courses",
        )[0].params,
      ).toEqual({ recruitmentId: ula.recruitmentId }),
    );
    expect(
      axiosMock.history.get.filter(
        (r) => r.url === "/api/recruitments/options",
      )[0].params,
    ).toEqual({ recruitmentId: ula.recruitmentId });
    expect(
      axiosMock.history.get.filter((r) => r.url === "/api/notices")[0].params,
    ).toEqual({ id: ula.noticeVersionId });
  });

  /** Issue #121: the admin's edit form names the instructors too. */
  test("the form names each course's instructors", async () => {
    renderPage();

    const select = await screen.findByTestId(
      "AdminApplicationEditPage-firstChoiceCourse",
    );
    await waitFor(() =>
      expect([...select.options].map((o) => o.textContent)).toContain(
        "CMPSC   156 (CONRAD P)",
      ),
    );
  });

  test("saving sends the admin endpoint the edited answers, then returns to the view", async () => {
    renderPage();

    const major = await screen.findByTestId("AdminApplicationEditPage-major");
    await waitFor(() => expect(major.options.length).toBeGreaterThan(2));
    await userEvent.selectOptions(major, "Mathematics");
    // The form holds an admin to the applicant's required answers; this application was saved
    // with the I-9 box unticked, which is required since issue #213.
    await userEvent.click(
      screen.getByTestId("AdminApplicationEditPage-i9Appointment"),
    );
    await userEvent.click(
      screen.getByTestId("AdminApplicationEditPage-submit"),
    );

    await waitFor(() => expect(axiosMock.history.put).toHaveLength(1));
    expect(axiosMock.history.put[0].url).toBe("/api/admin/applications");
    expect(axiosMock.history.put[0].params).toEqual({ id: String(ula.id) });
    const sent = JSON.parse(axiosMock.history.put[0].data);
    expect(sent.major).toBe("Mathematics");
    expect(sent.firstName).toBe(ula.firstName);
    expect(sent.interests).toEqual({ Tutoring: 5, Grading: 2 });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Application saved; the changes are in the audit trail.",
      ),
    );
    expect(await screen.findByTestId("view-page")).toBeInTheDocument();
  });

  test("Cancel returns to the read-only view without saving", async () => {
    renderPage();

    await userEvent.click(
      await screen.findByTestId("AdminApplicationEditPage-cancel"),
    );

    expect(await screen.findByTestId("view-page")).toBeInTheDocument();
    expect(axiosMock.history.put).toHaveLength(0);
  });

  /** An admin is not asked to agree to anything: with no agreed version, no notice is shown. */
  test("a TA application without an agreed notice shows the TA form and no notice", async () => {
    renderPage(ta.id);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: `Edit Application ${ta.id}: TA positions, W26`,
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId("AdminApplicationEditPage-classLevel"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("AdminApplicationEditPage-notice-agree"),
    ).toBeNull();
    expect(
      screen.getByTestId("AdminApplicationEditPage-about"),
    ).toHaveTextContent("Application from grad@ucsb.edu");
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter(
          (r) => r.url === "/api/recruitments/options",
        ),
      ).toHaveLength(1),
    );
    expect(
      axiosMock.history.get.filter((r) => r.url === "/api/notices"),
    ).toHaveLength(0);
  });

  test("a test application says so, and a recruitment the page cannot find leaves the heading plain", async () => {
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, []);
    axiosMock
      .onGet("/api/admin/applications", { params: { id: "9" } })
      .reply(200, {
        ...applicationsFixtures.oneTestApplication,
        id: 9,
        noticeVersionId: null,
      });
    renderPage(9);

    expect(
      await screen.findByTestId("AdminApplicationEditPage-about"),
    ).toHaveTextContent("Test application (admin) from admin@ucsb.edu");
    expect(
      screen.getByRole("heading", { level: 1, name: "Edit Application 9" }),
    ).toBeInTheDocument();
    // With no recruitment known, the TA form is the default.
    expect(
      screen.getByTestId("AdminApplicationEditPage-classLevel"),
    ).toBeInTheDocument();
  });

  test("before the application arrives only the heading is shown", () => {
    axiosMock.onGet("/api/admin/applications").reply(200, null);
    renderPage(77);

    expect(
      screen.getByRole("heading", { level: 1, name: "Edit Application 77" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("AdminApplicationEditPage-submit")).toBeNull();
  });

  // ---- issue #302: the version check and the multi-tab warning ----

  const HEARTBEAT = /\/api\/applications\/heartbeat/;
  const student = {
    label: "ula@ucsb.edu (Chris <b>Student</b>)",
    samePerson: false,
  };
  const otherAdmin = {
    label: "jane@ucsb.edu (Jane Doe)",
    samePerson: false,
    admin: true,
  };

  const heartbeats = () =>
    axiosMock.history.post.filter((r) =>
      r.url.startsWith("/api/applications/heartbeat"),
    );

  async function fillAndSave() {
    const major = await screen.findByTestId("AdminApplicationEditPage-major");
    await waitFor(() => expect(major.options.length).toBeGreaterThan(2));
    await userEvent.selectOptions(major, "Mathematics");
    await userEvent.click(
      screen.getByTestId("AdminApplicationEditPage-i9Appointment"),
    );
    await userEvent.click(
      screen.getByTestId("AdminApplicationEditPage-submit"),
    );
  }

  test("the heartbeat and the save name this tab by the same identifier, and the save carries the version", async () => {
    axiosMock
      .onGet("/api/admin/applications", { params: { id: String(ula.id) } })
      .reply(200, { ...ula, version: 6 });
    renderPage();

    await waitFor(() => expect(heartbeats().length).toBe(1));
    expect(heartbeats()[0].url).toBe(
      `/api/applications/heartbeat?id=${ula.id}`,
    );
    const clientId = heartbeats()[0].headers["X-Client-Id"];
    expect(clientId).toBeTruthy();

    await fillAndSave();

    await waitFor(() => expect(axiosMock.history.put).toHaveLength(1));
    expect(axiosMock.history.put[0].params).toEqual({
      id: String(ula.id),
      version: 6,
    });
    expect(axiosMock.history.put[0].headers["X-Client-Id"]).toBe(clientId);
  });

  test("no heartbeat is sent before the application is there", async () => {
    axiosMock.onGet("/api/admin/applications").reply(200, null);
    renderPage(77);

    await screen.findByRole("heading", { level: 1 });
    expect(heartbeats()).toHaveLength(0);
  });

  test("no warning when nobody else has the application open", async () => {
    axiosMock
      .onPost(HEARTBEAT)
      .reply(200, { others: [], heartbeatSeconds: 20 });
    renderPage();

    await screen.findByTestId("AdminApplicationEditPage-about");
    await waitFor(() => expect(heartbeats().length).toBe(1));
    expect(
      screen.queryByTestId("AdminApplicationEditPage-multiple-tabs"),
    ).toBeNull();
  });

  test("an admin whose tab was open first is told the applicant is also editing, and the name is text", async () => {
    axiosMock.onPost(HEARTBEAT).reply(200, {
      others: [student],
      heartbeatSeconds: 20,
      newest: false,
      arrivedAtMillis: 1,
    });
    renderPage();

    const banner = await screen.findByTestId(
      "AdminApplicationEditPage-multiple-tabs",
    );
    expect(banner).toHaveTextContent(
      "ula@ucsb.edu (Chris <b>Student</b>) is also editing this application. We recommend that you wait a few minutes or ask them to close it.",
    );
    expect(banner.querySelector("b")).toBeNull();
    expect(
      screen.queryByTestId("AdminApplicationEditPage-multiple-tabs-modal"),
    ).toBeNull();
  });

  test("an admin who arrived later is asked, with the proposed message", async () => {
    axiosMock.onPost(HEARTBEAT).reply(200, {
      others: [student],
      heartbeatSeconds: 20,
      newest: true,
      arrivedAtMillis: 1,
    });
    renderPage();

    const modal = await screen.findByTestId(
      "AdminApplicationEditPage-multiple-tabs-modal-message",
    );
    expect(modal).toHaveTextContent(
      "ula@ucsb.edu (Chris <b>Student</b>) already has this application open for editing. We recommend that you wait a few minutes or ask them to close it.",
    );
  });

  test("another admin gets the admin sentence", async () => {
    axiosMock.onPost(HEARTBEAT).reply(200, {
      others: [otherAdmin],
      heartbeatSeconds: 20,
      newest: false,
      arrivedAtMillis: 1,
    });
    renderPage();

    expect(
      await screen.findByTestId("AdminApplicationEditPage-multiple-tabs"),
    ).toHaveTextContent(
      "jane@ucsb.edu (Jane Doe) is also editing this application. We recommend that only one admin edits this page at a time.",
    );
  });

  test("leaving from the question says goodbye and returns to the view", async () => {
    const fetchMock = vi.fn().mockResolvedValue({});
    vi.stubGlobal("fetch", fetchMock);
    axiosMock.onPost(HEARTBEAT).reply(200, {
      others: [student],
      heartbeatSeconds: 20,
      newest: true,
      arrivedAtMillis: 1,
    });
    renderPage();

    await screen.findByTestId("AdminApplicationEditPage-multiple-tabs-modal");
    await userEvent.click(
      screen.getByTestId("AdminApplicationEditPage-multiple-tabs-modal-leave"),
    );

    expect(await screen.findByTestId("view-page")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/applications/leave?id=${ula.id}`,
      expect.objectContaining({ method: "POST", keepalive: true }),
    );
    vi.unstubAllGlobals();
  });

  test("a save from an old copy shows the conflict, not a toast, and Reload brings the latest", async () => {
    axiosMock
      .onGet("/api/admin/applications", { params: { id: String(ula.id) } })
      .reply(200, { ...ula, version: 6 });
    axiosMock.onPut("/api/admin/applications").reply(409, {
      message: "changed",
      version: 7,
      application: { ...ula, version: 7 },
    });
    renderPage();

    await fillAndSave();

    expect(
      await screen.findByTestId("AdminApplicationEditPage-conflict-message"),
    ).toHaveTextContent(
      "This application was changed in another tab or window, or by the applicant. Reload to see the latest version.",
    );
    expect(mockToast).not.toHaveBeenCalled();

    axiosMock
      .onGet("/api/admin/applications", { params: { id: String(ula.id) } })
      .reply(200, { ...ula, version: 7 });
    const before = axiosMock.history.get.filter(
      (r) => r.url === "/api/admin/applications",
    ).length;
    await userEvent.click(
      screen.getByTestId("AdminApplicationEditPage-conflict-reload"),
    );

    await waitFor(() =>
      expect(
        screen.queryByTestId("AdminApplicationEditPage-conflict"),
      ).toBeNull(),
    );
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter((r) => r.url === "/api/admin/applications")
          .length,
      ).toBeGreaterThan(before),
    );
  });

  test("any other failed save is toasted and shows no conflict", async () => {
    axiosMock.onPut("/api/admin/applications").reply(500);
    renderPage();

    await fillAndSave();

    await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByTestId("AdminApplicationEditPage-conflict"),
    ).toBeNull();
  });
});
