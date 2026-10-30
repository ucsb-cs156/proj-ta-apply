import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import QuartersPage from "main/pages/Admin/QuartersPage";
import quartersFixtures from "fixtures/quartersFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <QuartersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const listRequests = () =>
  axiosMock.history.get
    .filter((r) => r.url === "/api/admin/quarters/all")
    .map((r) => r.params);
const refreshRequests = () =>
  axiosMock.history.post.filter((r) => r.url === "/api/admin/quarters/refresh");

describe("QuartersPage tests", () => {
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
      .onGet("/api/admin/quarters/all", { params: { direction: "desc" } })
      .reply(200, quartersFixtures.threeNewestFirst);
    axiosMock
      .onGet("/api/admin/quarters/all", { params: { direction: "asc" } })
      .reply(200, quartersFixtures.threeOldestFirst);
    axiosMock
      .onPost("/api/admin/quarters/refresh")
      .reply(200, quartersFixtures.refresh);
  });

  test("refreshes once on opening, reports the range, and lists newest first", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Quarters" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Opening this page checks UCSB for quarters newer/),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("QuartersPage-summary")).toHaveTextContent(
        "Checked UCSB for quarters F21 through S22; 3 saved.",
      ),
    );
    expect(refreshRequests()).toHaveLength(1);

    await screen.findByTestId("QuartersPage-card-20222-qyy");
    expect(
      [
        ...screen
          .getByTestId("QuartersPage")
          .querySelectorAll("[data-testid$='-qyy']"),
      ].map((el) => el.textContent),
    ).toEqual(["S22", "W22", "F21"]);
    expect(listRequests()[0]).toEqual({ direction: "desc" });
    expect(screen.getByTestId("QuartersPage-direction")).toHaveValue("desc");
    expect(screen.getByTestId("QuartersPage-direction").style.width).toBe(
      "14em",
    );
    expect(
      [...screen.getByTestId("QuartersPage-direction").options].map((o) => [
        o.value,
        o.text,
      ]),
    ).toEqual([
      ["desc", "Newest quarter first"],
      ["asc", "Oldest quarter first"],
    ]);
  });

  test("the list is fetched again after the refresh, so new quarters show", async () => {
    renderPage();
    await waitFor(() => expect(refreshRequests()).toHaveLength(1));
    // Once before the refresh answered, once after it invalidated the list.
    await waitFor(() =>
      expect(listRequests().length).toBeGreaterThanOrEqual(2),
    );
    expect(listRequests().every((p) => p.direction === "desc")).toBe(true);
  });

  test("choosing oldest first asks the backend for asc and shows that order", async () => {
    renderPage();
    await screen.findByTestId("QuartersPage-card-20222-qyy");

    await userEvent.selectOptions(
      screen.getByTestId("QuartersPage-direction"),
      "asc",
    );

    await waitFor(() =>
      expect(
        [
          ...screen
            .getByTestId("QuartersPage")
            .querySelectorAll("[data-testid$='-qyy']"),
        ].map((el) => el.textContent),
      ).toEqual(["F21", "W22", "S22"]),
    );
    expect(listRequests().at(-1)).toEqual({ direction: "asc" });
    expect(screen.getByTestId("QuartersPage-direction")).toHaveValue("asc");
  });

  test("a failed refresh toasts and still shows what is on file", async () => {
    axiosMock
      .onPost("/api/admin/quarters/refresh")
      .reply(500, { message: "UCSB down" });
    renderPage();

    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockToast.mock.calls[0][0]).toBe(
      "Could not check UCSB for new quarters; showing what is on file.",
    );
    expect(
      await screen.findByTestId("QuartersPage-card-20222-qyy"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("QuartersPage-summary")).toHaveTextContent(
      "Checking UCSB for new quarters…",
    );
  });

  test("with nothing on file the cards say so", async () => {
    axiosMock.onGet("/api/admin/quarters/all").reply(200, []);
    axiosMock
      .onPost("/api/admin/quarters/refresh")
      .reply(200, { start: "20212", end: "20214", quarters: [] });
    renderPage();
    expect(await screen.findByTestId("QuartersPage-none")).toHaveTextContent(
      "No quarters on file yet.",
    );
    await waitFor(() =>
      expect(screen.getByTestId("QuartersPage-summary")).toHaveTextContent(
        "Checked UCSB for quarters S21 through F21; 0 saved.",
      ),
    );
  });
});
