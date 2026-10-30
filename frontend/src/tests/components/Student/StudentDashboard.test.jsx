import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import StudentDashboard from "main/components/Student/StudentDashboard";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import applicationsFixtures from "fixtures/applicationsFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);

// S26 TA CLOSED never opened (id 3); W26 ULA OPEN (id 2); W26 TA CLOSED on 2026-02-01 (id 1).
const three = recruitmentsFixtures.threeRecruitments;
const [upcomingTa, openUla, closedTa] = three;

function renderDashboard(recruitments = three, applications = []) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <StudentDashboard
          recruitments={recruitments}
          applications={applications}
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
