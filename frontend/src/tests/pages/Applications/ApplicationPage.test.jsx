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
    axiosMock
      .onGet("/api/recruitments/applicable")
      .reply(200, [openUla, closedTa]);
    axiosMock
      .onGet("/api/recruitments/courses")
      .reply(200, ["CMPSC     8", "CMPSC   156"]);
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

  // ---- view only ----

  test("a closed recruitment leaves nothing to change", async () => {
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
    axiosMock
      .onGet("/api/applications")
      .reply(200, { ...application, recruitmentId: 1 });

    renderPage(1);

    expect(
      await screen.findByTestId("ApplicationPage-saved-comments"),
    ).toHaveTextContent("I have since finished CS 130A.");
  });

  test("a closed application with no comments shows none", async () => {
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
});
