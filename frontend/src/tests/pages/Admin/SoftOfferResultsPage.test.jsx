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

import SoftOfferResultsPage from "main/pages/Admin/SoftOfferResultsPage";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import softOfferResultsFixtures from "fixtures/softOfferResultsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);
const P = "SoftOfferResultsPage";
const T = `${P}-table`;

function renderPage(recruitmentId = 5) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter
        initialEntries={[`/admin/recruitments/${recruitmentId}/softOffers`]}
      >
        <Routes>
          <Route
            path="/admin/recruitments/:recruitmentId/softOffers"
            element={<SoftOfferResultsPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const cells = (testid) =>
  [...screen.getByTestId(testid).querySelectorAll("td")].map(
    (td) => td.textContent,
  );

describe("SoftOfferResultsPage tests (issue #487)", () => {
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
      .reply(200, [recruitmentsFixtures.releasedUla]);
    axiosMock
      .onGet("/api/admin/softOffers")
      .reply(200, softOfferResultsFixtures.three);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-11-25T02:30:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("names the recruitment, shows the release and deadline, the counts, and asks for the right results", async () => {
    renderPage();

    expect(await screen.findByTestId(`${P}-title`)).toHaveTextContent(
      "Soft Offer Results: F25 ULA",
    );
    expect(await screen.findByTestId(`${P}-release`)).toHaveTextContent(
      "Soft offers released 10/20/2025, 9:30:00 AM. Deadline: 10/25/2025, 5:00:00 PM. Change Deadline",
    );
    expect(screen.queryByTestId(`${P}-deadline-modal`)).toBeNull();
    expect(screen.getByTestId(`${P}-counts`)).toHaveTextContent(
      "3 assigned ULAs: 1 proceed, 0 declined, 2 no response yet.",
    );
    const results = axiosMock.history.get.filter(
      (r) => r.url === "/api/admin/softOffers",
    );
    expect(results).toHaveLength(1);
    expect(results[0].params).toEqual({ recruitmentId: "5" });
  });

  test("the main table: the headers, a row per assigned ULA, the stamp in Pacific with its late mark, the stale answer muted", async () => {
    renderPage();

    const table = await screen.findByTestId(T);
    expect(
      [...table.querySelectorAll("th")].map((th) => th.textContent),
    ).toEqual(softOfferResultsFixtures.three.headers);
    expect(table.querySelectorAll("tbody tr")).toHaveLength(3);
    expect(cells(`${T}-row-0`)).toEqual([
      "Grace",
      "Hopper",
      "grace@ucsb.edu",
      "CMPSC 156",
      "CONRAD P",
      "phtcon@ucsb.edu",
      "no",
      "Proceed (for CMPSC 8)",
      "10/22/2025, 8:00:00 AM",
      "2025-10-22T08:00 call me (for details)",
    ]);
    expect(screen.getByTestId(`${T}-row-0-c7`)).toHaveClass(
      "text-muted",
      "fst-italic",
    );
    // Only the status column is styled and only the stamp column is formatted.
    expect(screen.getByTestId(`${T}-row-0-c9`)).not.toHaveClass("text-muted");
    expect(screen.getByTestId(`${T}-header-7`)).toHaveTextContent(
      "Offer Status",
    );
    expect(cells(`${T}-row-1`)).toEqual([
      "Ada",
      "Lovelace",
      "ada@ucsb.edu",
      "CMPSC 156",
      "CONRAD P",
      "phtcon@ucsb.edu",
      "yes",
      "Proceed",
      "10/26/2025, 9:00:00 AM (late)",
      "Yes!",
    ]);
    expect(screen.getByTestId(`${T}-row-1-c7`)).not.toHaveClass("text-muted");
    expect(cells(`${T}-row-2`).slice(7)).toEqual(["", "", ""]);
    expect(screen.getByTestId(`${T}-row-2-c8`)).toHaveTextContent("");
  });

  test("the second table lists answers from applicants no longer assigned, with its own columns", async () => {
    renderPage();

    expect(
      await screen.findByTestId(`${P}-unassigned-title`),
    ).toHaveTextContent("Responses from applicants no longer assigned");
    const table = screen.getByTestId(`${P}-unassigned`);
    expect(
      [...table.querySelectorAll("th")].map((th) => th.textContent),
    ).toEqual(softOfferResultsFixtures.three.unassignedHeaders);
    expect(cells(`${P}-unassigned-row-0`)).toEqual([
      "Linus",
      "Torvalds",
      "linus@ucsb.edu",
      "CMPSC 156",
      "Declined",
      "10/23/2025, 10:30:00 AM",
      "Moving away",
    ]);
    expect(screen.getByTestId(`${P}-unassigned-row-0-c4`)).not.toHaveClass(
      "text-muted",
    );
  });

  test("the CSV link downloads the backend's file under its name", async () => {
    renderPage();

    const link = await screen.findByTestId(`${P}-csv`);
    expect(link).toHaveTextContent("Download CSV");
    expect(link).toHaveAttribute(
      "href",
      "/api/admin/softOffers/csv?recruitmentId=5",
    );
    expect(link).toHaveAttribute("download", "soft-offers-5.csv");
    expect(link).toHaveClass("btn", "btn-outline-secondary");
  });

  test("with nobody assigned the table is empty and the second table is absent", async () => {
    axiosMock
      .onGet("/api/admin/softOffers")
      .reply(200, softOfferResultsFixtures.empty);
    renderPage();

    expect(await screen.findByTestId(`${P}-counts`)).toHaveTextContent(
      "0 assigned ULAs: 0 proceed, 0 declined, 0 no response yet.",
    );
    expect(screen.getByTestId(T).querySelectorAll("tbody tr")).toHaveLength(0);
    expect(screen.queryByTestId(`${P}-unassigned-title`)).toBeNull();
    expect(screen.queryByTestId(`${P}-unassigned`)).toBeNull();
  });

  test("a refusal from the backend is shown on the page, and nothing else", async () => {
    axiosMock.onGet("/api/admin/softOffers").reply(400, {
      message: "Soft offers have not been released for this recruitment.",
    });
    renderPage();

    expect(await screen.findByTestId(`${P}-error`)).toHaveTextContent(
      "Soft offers have not been released for this recruitment.",
    );
    expect(screen.queryByTestId(`${P}-release`)).toBeNull();
    expect(screen.queryByTestId(`${P}-csv`)).toBeNull();
    expect(mockToast).not.toHaveBeenCalled();
  });

  test("while the recruitment is not known the title is bare and there is no Change Deadline", async () => {
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, []);
    renderPage();

    expect(await screen.findByTestId(`${P}-release`)).toBeInTheDocument();
    expect(screen.getByTestId(`${P}-title`)).toHaveTextContent(
      /^Soft Offer Results$/,
    );
    expect(screen.queryByTestId(`${P}-change-deadline`)).toBeNull();
  });

  test("Change Deadline opens the modal on the current deadline; saving puts, toasts and re-reads the results", async () => {
    axiosMock.onPut("/api/admin/recruitments/softOffers").reply(200, {
      ...recruitmentsFixtures.releasedUla,
      softOfferDeadline: "2026-12-01T12:15:00",
    });
    renderPage();

    await userEvent.click(await screen.findByTestId(`${P}-change-deadline`));
    const input = screen.getByTestId(`${P}-deadline-deadline-input`);
    expect(input).toHaveValue("2025-10-25T17:00");
    fireEvent.change(input, { target: { value: "2026-12-01T12:15" } });
    await userEvent.click(screen.getByTestId(`${P}-deadline-confirm`));

    await waitFor(() => expect(axiosMock.history.put).toHaveLength(1));
    expect(axiosMock.history.put[0].params).toEqual({
      id: 5,
      deadline: "2026-12-01T12:15",
    });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("Soft offer deadline changed."),
    );
    await waitFor(() =>
      expect(screen.queryByTestId(`${P}-deadline-modal`)).toBeNull(),
    );
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter((r) => r.url === "/api/admin/softOffers"),
      ).toHaveLength(2),
    );
  });

  test("Cancel closes the Change Deadline modal", async () => {
    renderPage();

    await userEvent.click(await screen.findByTestId(`${P}-change-deadline`));
    expect(screen.getByTestId(`${P}-deadline-modal`)).toBeInTheDocument();
    await userEvent.click(screen.getByTestId(`${P}-deadline-cancel`));
    await waitFor(() =>
      expect(screen.queryByTestId(`${P}-deadline-modal`)).toBeNull(),
    );
    expect(within(screen.getByTestId(T)).getAllByRole("row")).toHaveLength(4);
  });
});
