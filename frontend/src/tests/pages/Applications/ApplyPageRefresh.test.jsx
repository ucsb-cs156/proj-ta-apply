import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import ApplyPage from "main/pages/Applications/ApplyPage";
import { APPLICATIONS_CLOSED_MESSAGE } from "main/utils/draftApplications";
import draftApplicationsFixtures from "fixtures/draftApplicationsFixtures";
import courseInstructorsFixtures from "fixtures/courseInstructorsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import appSettingsFixtures from "fixtures/appSettingsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: vi.fn(),
}));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => vi.fn(),
}));

const axiosMock = new AxiosMockAdapter(axios);

const [, openUla] = recruitmentsFixtures.threeRecruitments;
const closedUla = { ...openUla, applicationStatus: "CLOSED" };
const { emptyUlaDraft, savedUlaDraft } = draftApplicationsFixtures;

const draftSaves = () =>
  axiosMock.history.put.filter((r) => r.url === "/api/draftApplications");

let queryClient;

function renderPage() {
  queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/apply/2"]}>
        <Routes>
          <Route path="/apply/:recruitmentId" element={<ApplyPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** What the background refresh does: asks again, and the page shows whatever the server now says. */
const refresh = () =>
  act(async () => {
    await queryClient.invalidateQueries({
      queryKey: ["/api/recruitments/applicable"],
    });
  });

describe("ApplyPage when the recruitment changes while the form is open (issue #281)", () => {
  beforeEach(() => {
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.userOnly);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
    axiosMock.onGet("/api/recruitments/applicable").reply(200, [openUla]);
    axiosMock.onGet("/api/recruitments/courses").reply(200, []);
    axiosMock
      .onGet("/api/recruitments/instructors")
      .reply(200, courseInstructorsFixtures.twoCourses);
    axiosMock
      .onGet("/api/recruitments/options")
      .reply(200, appSettingsFixtures.ulaOptions);
    axiosMock.onGet("/api/applications/prefill").reply(200, []);
    axiosMock.onPost("/api/draftApplications/open").reply(200, emptyUlaDraft);
    axiosMock.onPut("/api/draftApplications").reply(200, savedUlaDraft);
    axiosMock.onGet("/api/applications/mine").reply(200, []);
    axiosMock.onGet("/api/notices/current").reply(200, []);
  });

  test("while applications are open there is no closed notice and the buttons work", async () => {
    renderPage();
    expect(await screen.findByTestId("ApplyPage-submit")).toBeEnabled();
    expect(screen.getByTestId("ApplyPage-saveDraft")).toBeEnabled();
    expect(screen.queryByTestId("ApplyPage-closed")).toBeNull();
  });

  test("when applications close, the form stays with what was typed and says the draft is kept", async () => {
    renderPage();
    const comments = await screen.findByTestId("ApplyPage-comments");
    fireEvent.change(comments, { target: { value: "Half-finished thought" } });

    axiosMock.onGet("/api/recruitments/applicable").reply(200, [closedUla]);
    await refresh();

    expect(await screen.findByTestId("ApplyPage-closed")).toHaveTextContent(
      APPLICATIONS_CLOSED_MESSAGE,
    );
    expect(APPLICATIONS_CLOSED_MESSAGE).toMatch(/draft is kept/);
    expect(APPLICATIONS_CLOSED_MESSAGE).toMatch(/can no longer be submitted/);
    // Nothing the applicant typed is replaced or removed.
    expect(screen.getByTestId("ApplyPage-comments")).toHaveValue(
      "Half-finished thought",
    );
    expect(screen.getByTestId("ApplyPage-submit")).toBeDisabled();
    expect(screen.getByTestId("ApplyPage-saveDraft")).toBeDisabled();
  });

  test("a recruitment that drops out of the list counts as closed, and the form stays", async () => {
    renderPage();
    const comments = await screen.findByTestId("ApplyPage-comments");
    fireEvent.change(comments, { target: { value: "Still here" } });

    axiosMock.onGet("/api/recruitments/applicable").reply(200, []);
    await refresh();

    expect(await screen.findByTestId("ApplyPage-closed")).toBeInTheDocument();
    expect(screen.getByTestId("ApplyPage-comments")).toHaveValue("Still here");
    expect(screen.getByTestId("ApplyPage-submit")).toBeDisabled();
    // The "not one you can apply to" message is for a page that never had the recruitment.
    expect(screen.queryByTestId("ApplyPage-unavailable")).toBeNull();
  });

  test("no draft saves are tried after applications close", async () => {
    renderPage();
    const comments = await screen.findByTestId("ApplyPage-comments");

    axiosMock.onGet("/api/recruitments/applicable").reply(200, [closedUla]);
    await refresh();
    await screen.findByTestId("ApplyPage-closed");

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      fireEvent.change(comments, { target: { value: "Too late" } });
      act(() => {
        vi.advanceTimersByTime(10000);
      });
    } finally {
      vi.useRealTimers();
    }
    expect(draftSaves()).toHaveLength(0);
  });

  test("a recruitment that was never there still says it is not one to apply to", async () => {
    axiosMock.onGet("/api/recruitments/applicable").reply(200, []);
    renderPage();
    expect(await screen.findByTestId("ApplyPage-unavailable")).toBeVisible();
    expect(screen.queryByTestId("ApplyPage-closed")).toBeNull();
  });

  test("the page refreshes the list by itself at the non-admin interval", async () => {
    axiosMock.onGet("/api/systemInfo").reply(200, {
      ...systemInfoFixtures.showingNeither,
      nonAdminRefresh: 1,
      nonAdminJitter: 0,
    });
    renderPage();
    const comments = await screen.findByTestId("ApplyPage-comments");
    fireEvent.change(comments, { target: { value: "Typing" } });

    axiosMock.onGet("/api/recruitments/applicable").reply(200, [closedUla]);

    expect(
      await screen.findByTestId("ApplyPage-closed", {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("ApplyPage-comments")).toHaveValue("Typing"),
    );
  });
});
