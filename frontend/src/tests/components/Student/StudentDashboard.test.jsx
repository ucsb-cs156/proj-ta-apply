import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useParams } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import StudentDashboard from "main/components/Student/StudentDashboard";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import applicationsFixtures from "fixtures/applicationsFixtures";
import draftApplicationsFixtures from "fixtures/draftApplicationsFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);

// S26 TA CLOSED never opened (id 3); W26 ULA OPEN (id 2); W26 TA CLOSED on 2026-02-01 (id 1).
const three = recruitmentsFixtures.threeRecruitments;
const [upcomingTa, openUla, closedTa] = three;

function renderDashboard(
  recruitments = three,
  applications = [],
  drafts = undefined,
) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <StudentDashboard
          recruitments={recruitments}
          applications={applications}
          drafts={drafts}
          testIdPrefix="D"
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("StudentDashboard tests", () => {
  beforeEach(() => {
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Within six months of the TA's closing date.
    vi.setSystemTime(new Date(2026, 2, 1, 12, 0, 0));
    axiosMock
      .onPut("/api/applications/cancel")
      .reply(200, applicationsFixtures.oneCancelledApplication);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("upcoming, then current and recent as cards, and no past section without old applications", () => {
    renderDashboard();

    const headings = screen
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(headings).toEqual([
      "Upcoming Recruitments",
      "Current and Recent Recruitments",
    ]);
    expect(
      screen.getByTestId("D-upcoming-cell-row-0-col-quarter"),
    ).toHaveTextContent("S26");
    expect(screen.getByTestId("D-current-card-2-card")).toBeInTheDocument();
    expect(screen.getByTestId("D-current-card-1-card")).toBeInTheDocument();
    expect(screen.queryByTestId("D-none-open")).toBeNull();
    expect(screen.queryByTestId("D-past")).toBeNull();
  });

  test("a draft reaches the current card, which offers to continue it", () => {
    renderDashboard(three, [], [draftApplicationsFixtures.savedUlaDraft]);

    expect(screen.getByTestId("D-current-card-2-draft")).toHaveTextContent(
      "Continue editing draft application",
    );
    expect(screen.queryByTestId("D-current-card-2-apply")).toBeNull();
  });

  test("with nothing upcoming the heading is not shown, and with nothing current it says so", () => {
    renderDashboard([]);

    expect(
      screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
    ).toEqual(["Current and Recent Recruitments"]);
    expect(screen.getByTestId("D-none-open")).toHaveTextContent(
      "Applications are not currently being accepted.",
    );
    expect(screen.queryByTestId("D-upcoming")).toBeNull();
  });

  test("past recruitments appear only when the student applied to them", () => {
    vi.setSystemTime(new Date(2026, 9, 1, 12, 0, 0));
    renderDashboard(three, [applicationsFixtures.oneTaApplication]);

    expect(
      screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
    ).toEqual([
      "Upcoming Recruitments",
      "Current and Recent Recruitments",
      "Past Recruitments",
    ]);
    expect(
      screen.getByTestId("D-past-cell-row-0-col-quarter"),
    ).toHaveTextContent("W26");
    expect(
      screen.getByTestId("D-past-cell-row-0-col-view-link"),
    ).toHaveAttribute("href", "/applications/1");
    // The closed TA is no longer among the cards.
    expect(screen.queryByTestId("D-current-card-1-card")).toBeNull();
    expect(screen.getByTestId("D-current-card-2-card")).toBeInTheDocument();
  });

  test("cancelling goes through both modals, then sends the reason and toasts", async () => {
    renderDashboard([openUla], [applicationsFixtures.oneUlaApplication]);

    await userEvent.click(screen.getByTestId("D-current-card-2-cancel"));
    expect(await screen.findByTestId("D-cancel-step1")).toHaveTextContent(
      "ULA positions, W26",
    );
    await userEvent.click(screen.getByTestId("D-cancel-step1-yes"));
    await userEvent.type(
      await screen.findByTestId("D-cancel-reason"),
      "Found other employment",
    );
    await userEvent.click(screen.getByTestId("D-cancel-step2-yes"));

    await waitFor(() => expect(axiosMock.history.put.length).toBe(1));
    expect(axiosMock.history.put[0].url).toBe("/api/applications/cancel");
    expect(axiosMock.history.put[0].params).toEqual({
      id: 2,
      reason: "Found other employment",
    });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Your application has been cancelled.",
      ),
    );
    await waitFor(() =>
      expect(screen.queryByTestId("D-cancel-step2")).toBeNull(),
    );
  });

  test("backing out of the modals cancels nothing, and the next request starts afresh", async () => {
    renderDashboard(
      [openUla, closedTa],
      [
        applicationsFixtures.oneUlaApplication,
        applicationsFixtures.oneTaApplication,
      ],
    );

    await userEvent.click(screen.getByTestId("D-current-card-2-cancel"));
    await userEvent.click(await screen.findByTestId("D-cancel-step1-yes"));
    await userEvent.type(await screen.findByTestId("D-cancel-reason"), "Oops");
    await userEvent.click(screen.getByTestId("D-cancel-step2-no"));
    await waitFor(() =>
      expect(screen.queryByTestId("D-cancel-step2")).toBeNull(),
    );
    expect(axiosMock.history.put.length).toBe(0);

    // A different application: back at step one, with no leftover reason.
    await userEvent.click(screen.getByTestId("D-current-card-1-cancel"));
    expect(await screen.findByTestId("D-cancel-step1")).toHaveTextContent(
      "TA positions, W26",
    );
    await userEvent.click(screen.getByTestId("D-cancel-step1-yes"));
    expect(await screen.findByTestId("D-cancel-reason")).toHaveValue("");
    await userEvent.click(screen.getByTestId("D-cancel-step2-no"));
    await waitFor(() =>
      expect(screen.queryByTestId("D-cancel-step2")).toBeNull(),
    );
    expect(axiosMock.history.put.length).toBe(0);
  });

  test("a refused cancellation leaves the modal up", async () => {
    axiosMock
      .onPut("/api/applications/cancel")
      .reply(400, { message: "Please give a brief reason" });
    renderDashboard([openUla], [applicationsFixtures.oneUlaApplication]);

    await userEvent.click(screen.getByTestId("D-current-card-2-cancel"));
    await userEvent.click(await screen.findByTestId("D-cancel-step1-yes"));
    await userEvent.type(await screen.findByTestId("D-cancel-reason"), "x");
    await userEvent.click(screen.getByTestId("D-cancel-step2-yes"));

    await waitFor(() => expect(axiosMock.history.put.length).toBe(1));
    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockToast.mock.calls[0][0]).not.toBe(
      "Your application has been cancelled.",
    );
    expect(screen.getByTestId("D-cancel-step2")).toBeInTheDocument();
  });

  // ---- Create a new application (issue #420) ----

  function ApplyStandIn() {
    const { recruitmentId } = useParams();
    return <div data-testid="apply-page">{recruitmentId}</div>;
  }

  /** The dashboard at /, with a stand-in for the apply page to see where the student is sent. */
  function renderAtHome() {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route
              path="/"
              element={
                <StudentDashboard
                  recruitments={[openUla]}
                  applications={[applicationsFixtures.oneCancelledApplication]}
                  testIdPrefix="D"
                />
              }
            />
            <Route path="/apply/:recruitmentId" element={<ApplyStandIn />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  test("Create a new application turns the cancelled one into a draft and opens it", async () => {
    axiosMock
      .onPost("/api/draftApplications/fromCancelled")
      .reply(200, { ...draftApplicationsFixtures.savedUlaDraft, id: 77 });
    renderAtHome();

    await userEvent.click(screen.getByTestId("D-current-card-2-restart"));

    expect(await screen.findByTestId("apply-page")).toHaveTextContent(
      String(draftApplicationsFixtures.savedUlaDraft.recruitmentId),
    );
    expect(axiosMock.history.post.length).toBe(1);
    expect(axiosMock.history.post[0].params).toEqual({ applicationId: 4 });
    expect(mockToast).not.toHaveBeenCalled();
  });

  test("Create a new application is disabled while the request is under way", async () => {
    let answer;
    axiosMock.onPost("/api/draftApplications/fromCancelled").reply(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    renderAtHome();

    await userEvent.click(screen.getByTestId("D-current-card-2-restart"));

    await waitFor(() =>
      expect(screen.getByTestId("D-current-card-2-restart")).toBeDisabled(),
    );
    answer([400, { message: "Applications are not currently open" }]);
    await waitFor(() =>
      expect(screen.getByTestId("D-current-card-2-restart")).toBeEnabled(),
    );
  });

  test("a refused Create a new application toasts the server's reason and stays home", async () => {
    axiosMock.onPost("/api/draftApplications/fromCancelled").reply(400, {
      message: "You already have a draft application for this recruitment",
    });
    renderAtHome();

    await userEvent.click(screen.getByTestId("D-current-card-2-restart"));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "You already have a draft application for this recruitment",
      ),
    );
    expect(screen.queryByTestId("apply-page")).toBeNull();
    expect(screen.getByTestId("D-current-card-2-card")).toBeInTheDocument();
  });

  test("uses StudentDashboard as the default test id prefix", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <StudentDashboard recruitments={[]} applications={[]} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      screen.getByTestId("StudentDashboard-none-open"),
    ).toBeInTheDocument();
  });
});
