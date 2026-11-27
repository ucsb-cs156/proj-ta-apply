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
import { SOFT_OFFER_COLUMNS_STORAGE_KEY } from "main/utils/softOfferResultsColumns";

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

/** The headings of a table, left to right, without their "hide" links and sort carets. */
const headings = (testid) =>
  [...screen.getByTestId(testid).querySelectorAll("thead th")].map((th) =>
    th.querySelector("[data-testid$='-sort-header']").textContent.trim(),
  );

describe("SoftOfferResultsPage tests (issue #487)", () => {
  beforeEach(() => {
    mockToast.mockClear();
    localStorage.clear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.adminUser);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
    axiosMock
      .onGet("/api/hiringStaff/recruitments")
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
    // Issue #500: the five columns for the financial office staff start hidden.
    expect(headings(T)).toEqual(
      softOfferResultsFixtures.three.headers.filter((h, i) => i < 3 || i > 7),
    );
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
    const stale = screen.getByTestId(`${T}-cell-row-0-col-status`);
    expect(stale.firstElementChild).toHaveClass("text-muted", "fst-italic");
    // Only the status column is styled and only the stamp column is formatted.
    expect(
      screen.getByTestId(`${T}-cell-row-0-col-comments`).querySelector("span"),
    ).toBeNull();
    expect(screen.getByTestId(`${T}-header-status`)).toHaveTextContent(
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
    expect(
      screen.getByTestId(`${T}-cell-row-1-col-status`).querySelector("span"),
    ).toBeNull();
    expect(cells(`${T}-row-2`).slice(7)).toEqual(["", "", ""]);
    expect(
      screen.getByTestId(`${T}-cell-row-2-col-respondedAt`),
    ).toHaveTextContent("");
  });

  test("the second table lists answers from applicants no longer assigned, with its own columns", async () => {
    renderPage();

    expect(
      await screen.findByTestId(`${P}-unassigned-title`),
    ).toHaveTextContent("Responses from applicants no longer assigned");
    expect(headings(`${P}-unassigned`)).toEqual(
      softOfferResultsFixtures.three.unassignedHeaders,
    );
    expect(cells(`${P}-unassigned-row-0`)).toEqual([
      "Linus",
      "Torvalds",
      "linus@ucsb.edu",
      "CMPSC 156",
      "Declined",
      "10/23/2025, 10:30:00 AM",
      "Moving away",
    ]);
    expect(
      screen
        .getByTestId(`${P}-unassigned-cell-row-0-col-status`)
        .querySelector("span"),
    ).toBeNull();
  });

  // ---- issue #511: the Copy Soft Offer Emails buttons ----

  test("the Copy Soft Offer Emails buttons copy the main table's emails by answer", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderPage();

    const line = await screen.findByTestId(`${P}-copy-emails`);
    expect(line).toHaveTextContent(
      'Copy Soft Offer Emails: All Responded "Proceed" Responded "Declined" No Response',
    );
    expect(screen.getByTestId(`${P}-copy-emails-declined`)).toBeDisabled();
    await userEvent.click(screen.getByTestId(`${P}-copy-emails-none`));
    // Grace's answer was for another lecture, so she has no response for this one; Linus, no
    // longer assigned, is not copied.
    expect(writeText).toHaveBeenCalledWith("grace@ucsb.edu\nalan@ucsb.edu");
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("2 emails copied to clipboard."),
    );
  });

  // ---- issue #494: the toolbar above the table, and the Columns menu ----

  test("Download CSV and the Columns menu sit in a toolbar just above the main table", async () => {
    renderPage();

    const toolbar = await screen.findByTestId(`${P}-toolbar`);
    expect(toolbar).toHaveClass("d-flex", "gap-2", "mb-2");
    expect(toolbar).toContainElement(screen.getByTestId(`${P}-columns`));
    expect(toolbar).toContainElement(screen.getByTestId(`${P}-csv`));
    expect(screen.getByTestId(`${P}-csv`)).toHaveClass("btn-sm");
    // The table comes right after the toolbar: nothing but the table's wrapper between them.
    expect(toolbar.nextElementSibling).toContainElement(screen.getByTestId(T));
    // Issue #511: the Copy Soft Offer Emails line sits between the counts and the toolbar.
    const copyLine = screen.getByTestId(`${P}-copy-emails`);
    expect(screen.getByTestId(`${P}-counts`).nextElementSibling).toBe(copyLine);
    expect(copyLine.nextElementSibling).toBe(toolbar);
  });

  test("the Columns menu offers every column but First name and Last name, labelled by the headings", async () => {
    renderPage();

    await userEvent.click(await screen.findByTestId(`${P}-columns-toggle`));
    expect(
      screen.getAllByRole("checkbox").map((box) => box.labels[0].textContent),
    ).toEqual([
      "Email",
      "Perm number",
      "Prev LA Qtrs",
      "Expected grad date",
      "Other Campus Job?",
      "Employee ID number",
      "Course assignment",
      "Course instructor",
      "Course instructor email",
      "First time ULA",
      "Offer Status",
      "Offer Response Date/Time",
      "Comments",
    ]);
    // No "hide" link over First name or Last name, in either table.
    expect(
      screen.queryByRole("button", { name: "Hide First name column" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Hide Last name column" }),
    ).toBeNull();
    expect(
      screen.getAllByRole("button", { name: "Hide Comments column" }),
    ).toHaveLength(2);
    // The second table's own column is always shown.
    expect(
      screen.queryByRole("button", { name: "Hide Course answered for column" }),
    ).toBeNull();
  });

  test("the five columns for the financial office staff start hidden, unticked in the menu; showing one is remembered apart (issue #500)", async () => {
    renderPage();
    await screen.findByTestId(`${T}-row-0`);

    expect(screen.queryByTestId(`${T}-header-permNumber`)).toBeNull();
    expect(screen.queryByTestId(`${T}-header-employeeId`)).toBeNull();
    expect(screen.getByTestId(`${P}-columns-toggle`)).toHaveTextContent(
      "Columns (5 hidden)",
    );
    await userEvent.click(screen.getByTestId(`${P}-columns-toggle`));
    expect(
      screen.getByRole("checkbox", { name: "Perm number" }),
    ).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Email" })).toBeChecked();

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Perm number" }),
    );
    expect(screen.getByTestId(`${T}-header-permNumber`)).toBeInTheDocument();
    expect(
      screen.getByTestId(`${T}-cell-row-1-col-permNumber`),
    ).toHaveTextContent("B234567");
    // Right after Email.
    expect(screen.getByTestId(`${T}-header-email`).nextElementSibling).toBe(
      screen.getByTestId(`${T}-header-permNumber`),
    );
    // Remembered under the ".shown" key, apart from the hidden list (which is untouched).
    expect(
      JSON.parse(
        localStorage.getItem(`${SOFT_OFFER_COLUMNS_STORAGE_KEY}.shown`),
      ),
    ).toEqual(["permNumber"]);
    expect(localStorage.getItem(SOFT_OFFER_COLUMNS_STORAGE_KEY)).toBeNull();
  });

  test("unticking a column hides it in both tables and is remembered; the hide link and Show All work too", async () => {
    renderPage();

    await userEvent.click(await screen.findByTestId(`${P}-columns-toggle`));
    await userEvent.click(screen.getByRole("checkbox", { name: "Comments" }));
    expect(screen.queryByTestId(`${T}-header-comments`)).toBeNull();
    expect(screen.queryByTestId(`${T}-cell-row-0-col-comments`)).toBeNull();
    expect(screen.queryByTestId(`${P}-unassigned-header-comments`)).toBeNull();
    expect(screen.getByTestId(`${T}-header-firstName`)).toBeInTheDocument();
    expect(
      JSON.parse(localStorage.getItem(SOFT_OFFER_COLUMNS_STORAGE_KEY)),
    ).toEqual(["comments"]);
    expect(screen.getByTestId(`${P}-columns-toggle`)).toHaveTextContent(
      "Columns (6 hidden)",
    );

    // The "hide" link over a heading of the second table hides the column in both tables.
    await userEvent.click(
      screen.getByTestId(`${P}-unassigned-header-email-hide`),
    );
    expect(screen.queryByTestId(`${T}-header-email`)).toBeNull();
    expect(
      JSON.parse(localStorage.getItem(SOFT_OFFER_COLUMNS_STORAGE_KEY)),
    ).toEqual(["comments", "email"]);

    await userEvent.click(screen.getByTestId(`${P}-columns-select-all`));
    expect(screen.getByTestId(`${T}-header-comments`)).toBeInTheDocument();
    expect(
      screen.getByTestId(`${P}-unassigned-header-email`),
    ).toBeInTheDocument();
    expect(
      JSON.parse(localStorage.getItem(SOFT_OFFER_COLUMNS_STORAGE_KEY)),
    ).toEqual([]);
    // Show All shows the five opt-in columns too (issue #500).
    expect(screen.getByTestId(`${T}-header-employeeId`)).toBeInTheDocument();
    expect(headings(T)).toEqual(softOfferResultsFixtures.three.headers);
  });

  test("columns hidden on an earlier visit start hidden", async () => {
    localStorage.setItem(
      SOFT_OFFER_COLUMNS_STORAGE_KEY,
      JSON.stringify(["instructorEmail", "status"]),
    );
    renderPage();

    await screen.findByTestId(`${T}-row-0`);
    expect(screen.queryByTestId(`${T}-header-instructorEmail`)).toBeNull();
    expect(screen.queryByTestId(`${T}-header-status`)).toBeNull();
    expect(screen.queryByTestId(`${P}-unassigned-header-status`)).toBeNull();
    expect(cells(`${T}-row-1`)).toEqual([
      "Ada",
      "Lovelace",
      "ada@ucsb.edu",
      "CMPSC 156",
      "CONRAD P",
      "yes",
      "10/26/2025, 9:00:00 AM (late)",
      "Yes!",
    ]);
  });

  test("Comments has the only drag handle, starting at 300px", async () => {
    renderPage();

    await screen.findByTestId(`${T}-row-0`);
    expect(screen.getAllByRole("separator")).toHaveLength(2);
    expect(screen.getByTestId(`${T}-header-comments`).style.width).toBe(
      "300px",
    );
    expect(
      screen.getByTestId(`${P}-unassigned-header-comments`).style.width,
    ).toBe("300px");
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
    expect(link).toHaveClass("btn", "btn-outline-secondary", "btn-sm");
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
    axiosMock.onGet("/api/hiringStaff/recruitments").reply(200, []);
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
