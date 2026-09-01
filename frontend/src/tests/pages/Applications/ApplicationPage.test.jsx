import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import ApplicationPage from "main/pages/Applications/ApplicationPage";
import applicationsFixtures from "fixtures/applicationsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
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
    expect(screen.queryByTestId("ApplicationPage-comments-only")).toBeNull();
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
  });

  // ---- comments only ----

  test("after the deadline only the comments form is offered", async () => {
    vi.setSystemTime(new Date(2026, 1, 1, 12, 0, 0));
    renderPage();

    expect(
      await screen.findByTestId("ApplicationPage-comments-only"),
    ).toHaveTextContent("can no longer be edited");
    expect(
      screen.getByTestId("ApplicationPage-postApplicationComments"),
    ).toHaveValue("I have since finished CS 130A.");
    // The rest of the application is shown back, but not as an editable form.
    expect(screen.queryByTestId("ApplicationPage-firstName")).toBeNull();
    expect(
      screen.getByTestId("ApplicationPage-summary-Major"),
    ).toHaveTextContent("Computer Science");
  });

  test("saving comments sends a PUT to the comments endpoint", async () => {
    vi.setSystemTime(new Date(2026, 1, 1, 12, 0, 0));
    axiosMock.onPut("/api/applications/comments").reply(200, application);

    renderPage();

    const box = await screen.findByTestId(
      "ApplicationPage-postApplicationComments",
    );
    await userEvent.clear(box);
    await userEvent.type(box, "Also took CS 190J.");
    await userEvent.click(screen.getByTestId("ApplicationPage-submit"));

    await waitFor(() => expect(axiosMock.history.put.length).toBe(1));
    expect(axiosMock.history.put[0].url).toBe("/api/applications/comments");
    expect(axiosMock.history.put[0].params).toEqual({
      id: "2",
      postApplicationComments: "Also took CS 190J.",
    });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("Your comments have been saved."),
    );
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
      screen.queryByTestId("ApplicationPage-postApplicationComments"),
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
