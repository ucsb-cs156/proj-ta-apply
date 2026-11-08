import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import BudgetAuditTrailCard, {
  HIRING_TARGET_AUDIT_KEY,
} from "main/components/Budget/BudgetAuditTrailCard";
import recruitmentAuditTrailFixtures from "fixtures/recruitmentAuditTrailFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);
const URL = "/api/admin/recruitmentaudittrail/hiringTargets";
const OPEN_KEY = "collapsibleCard.BudgetPage-auditTrail";

const renderCard = (yyyyq = "20264") =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <BudgetAuditTrailCard yyyyq={yyyyq} />
    </QueryClientProvider>,
  );

/** The hiring-target requests made so far, as their params. */
const requests = () =>
  axiosMock.history.get
    .filter((request) => request.url === URL)
    .map((request) => request.params);

const cell = (row, col) =>
  screen.getByTestId(`BudgetPage-audit-cell-row-${row}-col-${col}`);

describe("BudgetAuditTrailCard tests", () => {
  beforeEach(() => {
    localStorage.clear();
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet(URL)
      .reply(200, recruitmentAuditTrailFixtures.hiringTargetPage);
  });

  test("the key the saves invalidate is the endpoint's URL", () => {
    expect(HIRING_TARGET_AUDIT_KEY).toBe(URL);
  });

  test("a backend error is toasted, naming the GET and its URL, and the card keeps loading", async () => {
    axiosMock.onGet(URL).reply(500, { message: "boom" });
    localStorage.setItem(OPEN_KEY, "open");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderCard();

    await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
    expect(mockToast).toHaveBeenCalledWith(
      "Error communicating with backend via GET on /api/admin/recruitmentaudittrail/hiringTargets",
    );
    expect(screen.getByTestId("BudgetPage-audit-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("BudgetPage-audit-empty")).toBeNull();
    errorSpy.mockRestore();
  });

  test("is closed by default, with the title and the smaller line beneath it, and fetches nothing", async () => {
    renderCard();

    const toggle = screen.getByTestId("BudgetPage-auditTrail-toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveTextContent("▸ Audit Trail");
    expect(
      screen.getByRole("heading", { level: 2, name: /^Audit Trail/ }),
    ).toContainElement(toggle);
    const subtitle = screen.getByTestId("BudgetPage-auditTrail-subtitle");
    expect(subtitle).toHaveTextContent("Track changes to hiring targets");
    expect(subtitle).toHaveClass("d-block", "fs-6", "fw-normal");
    expect(toggle).toContainElement(subtitle);
    expect(
      screen.queryByTestId("BudgetPage-auditTrail-body"),
    ).not.toBeInTheDocument();
    // Closed, the card asks the backend for nothing at all.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(requests()).toHaveLength(0);
  });

  test("opening it asks for the quarter's hiring-target changes, newest first, ten at a time", async () => {
    renderCard("20264");

    await userEvent.click(screen.getByTestId("BudgetPage-auditTrail-toggle"));

    await screen.findByTestId("BudgetPage-audit-total");
    expect(screen.queryByTestId("BudgetPage-audit-loading")).toBeNull();
    expect(requests()).toEqual([
      {
        quarter: "20264",
        page: 0,
        size: 10,
        sort: "id",
        direction: "desc",
      },
    ]);
    expect(localStorage.getItem(OPEN_KEY)).toBe("open");
  });

  test("open, it shows the usual columns plus Type, one row per change in the order served", async () => {
    localStorage.setItem(OPEN_KEY, "open");
    renderCard();

    // Until the answer comes there is neither the table nor the empty sentence.
    const loading = screen.getByTestId("BudgetPage-audit-loading");
    expect(loading).toHaveTextContent("Loading…");
    expect(loading).toHaveClass("mb-0");
    expect(screen.queryByTestId("BudgetPage-audit-empty")).toBeNull();
    expect(screen.queryByTestId("BudgetPage-audit")).toBeNull();

    expect(
      await screen.findByTestId("BudgetPage-audit-total"),
    ).toHaveTextContent("3 changes recorded.");
    const table = screen.getByTestId("BudgetPage-audit");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((th) => th.textContent),
    ).toEqual([
      "id",
      "Changed",
      "Changed By",
      "Type",
      "What Changed",
      "Old Value",
      "New Value",
    ]);
    expect(cell(0, "id")).toHaveTextContent("12");
    expect(cell(0, "changedAt").textContent).toBe("1/7/2026, 10:15:00 AM");
    expect(cell(0, "editorEmail")).toHaveTextContent("admin@ucsb.edu");
    expect(cell(0, "type")).toHaveTextContent("ULA");
    expect(cell(0, "whatChanged")).toHaveTextContent("totalHiringTarget");
    expect(cell(0, "oldValue")).toHaveTextContent("1");
    expect(cell(0, "newValue")).toHaveTextContent("10");
    expect(cell(1, "type")).toHaveTextContent("TA");
    expect(cell(1, "oldValue")).toHaveTextContent("8");
    expect(cell(1, "newValue")).toHaveTextContent("9");
    expect(cell(2, "type")).toHaveTextContent("TA");
    expect(cell(2, "editorEmail")).toHaveTextContent("phtcon@ucsb.edu");
    expect(
      screen.queryByTestId("BudgetPage-audit-cell-row-3-col-id"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("BudgetPage-audit-empty"),
    ).not.toBeInTheDocument();
    // One page: on it, neither button leads anywhere.
    expect(
      screen.getByTestId("BudgetPage-audit-page-indicator"),
    ).toHaveTextContent("Page 1 of 1");
    expect(screen.getByTestId("BudgetPage-audit-previous")).toBeDisabled();
    expect(screen.getByTestId("BudgetPage-audit-next")).toBeDisabled();
    expect(screen.getByTestId("BudgetPage-audit-page-size")).toHaveValue("10");
    expect(screen.getByLabelText("Page size")).toBe(
      screen.getByTestId("BudgetPage-audit-page-size"),
    );
  });

  test("a quarter whose targets have never changed gets one sentence and no table", async () => {
    axiosMock.onGet(URL).reply(200, recruitmentAuditTrailFixtures.emptyPage);
    localStorage.setItem(OPEN_KEY, "open");
    renderCard("20271");

    const empty = await screen.findByTestId("BudgetPage-audit-empty");
    expect(empty).toHaveTextContent(
      "No hiring target has been changed yet for this quarter.",
    );
    expect(empty.tagName).toBe("P");
    expect(empty).toHaveClass("mb-0");
    await waitFor(() => expect(requests()).toHaveLength(1));
    expect(requests()[0].quarter).toBe("20271");
    expect(screen.queryByTestId("BudgetPage-audit")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("BudgetPage-audit-total"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("BudgetPage-audit-page-size"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("BudgetPage-audit-next"),
    ).not.toBeInTheDocument();
  });

  test("Next and Previous page through the changes, asking the server for each page", async () => {
    axiosMock.onGet(URL).reply((config) => {
      if (config.params.page === 0) {
        return [200, recruitmentAuditTrailFixtures.hiringTargetFirstOfTwoPages];
      }
      // The second page takes a moment, long enough to see what is shown meanwhile.
      return new Promise((resolve) =>
        setTimeout(
          () =>
            resolve([
              200,
              recruitmentAuditTrailFixtures.hiringTargetSecondOfTwoPages,
            ]),
          150,
        ),
      );
    });
    localStorage.setItem(OPEN_KEY, "open");
    renderCard();

    expect(
      await screen.findByTestId("BudgetPage-audit-page-indicator"),
    ).toHaveTextContent("Page 1 of 2");
    expect(screen.getByTestId("BudgetPage-audit-previous")).toBeDisabled();
    const next = screen.getByTestId("BudgetPage-audit-next");
    expect(next).toBeEnabled();
    expect(cell(0, "id")).toHaveTextContent("12");
    expect(cell(1, "id")).toHaveTextContent("11");

    await userEvent.click(next);

    // The first page stays up until the second arrives: no Loading, no empty sentence between.
    expect(screen.queryByTestId("BudgetPage-audit-loading")).toBeNull();
    expect(screen.queryByTestId("BudgetPage-audit-empty")).toBeNull();
    expect(cell(0, "id")).toHaveTextContent("12");
    await waitFor(() => expect(cell(0, "id")).toHaveTextContent("9"));
    expect(
      screen.getByTestId("BudgetPage-audit-page-indicator"),
    ).toHaveTextContent("Page 2 of 2");
    // The same button, still there, now at the end.
    expect(next).toBeInTheDocument();
    expect(next).toBeDisabled();
    expect(
      screen.queryByTestId("BudgetPage-audit-cell-row-1-col-id"),
    ).not.toBeInTheDocument();
    expect(requests()).toHaveLength(2);
    expect(requests()[1]).toEqual({
      quarter: "20264",
      page: 1,
      size: 10,
      sort: "id",
      direction: "desc",
    });

    const previous = screen.getByTestId("BudgetPage-audit-previous");
    expect(previous).toBeEnabled();
    await userEvent.click(previous);

    await waitFor(() => expect(cell(0, "id")).toHaveTextContent("12"));
    expect(
      screen.getByTestId("BudgetPage-audit-page-indicator"),
    ).toHaveTextContent("Page 1 of 2");
    expect(previous).toBeDisabled();
    // Back to the first page, shown at once from the cache and re-read in the background.
    await waitFor(() => expect(requests()).toHaveLength(3));
    expect(requests()[2].page).toBe(0);
  });

  test("choosing a page size asks for that many, from the first page", async () => {
    axiosMock.onGet(URL).reply((config) => [
      200,
      {
        ...(config.params.page === 0
          ? recruitmentAuditTrailFixtures.hiringTargetFirstOfTwoPages
          : recruitmentAuditTrailFixtures.hiringTargetSecondOfTwoPages),
        size: config.params.size,
      },
    ]);
    localStorage.setItem(OPEN_KEY, "open");
    renderCard();

    await screen.findByTestId("BudgetPage-audit-total");
    await userEvent.click(screen.getByTestId("BudgetPage-audit-next"));
    await waitFor(() =>
      expect(
        screen.getByTestId("BudgetPage-audit-page-indicator"),
      ).toHaveTextContent("Page 2 of 2"),
    );

    const select = screen.getByTestId("BudgetPage-audit-page-size");
    expect(
      [...select.querySelectorAll("option")].map((option) => option.value),
    ).toEqual(["10", "25", "50", "100"]);
    await userEvent.selectOptions(select, "25");

    await waitFor(() => expect(requests()).toHaveLength(3));
    expect(requests()[2]).toEqual({
      quarter: "20264",
      page: 0,
      size: 25,
      sort: "id",
      direction: "desc",
    });
    expect(select).toHaveValue("25");
    await waitFor(() =>
      expect(
        screen.getByTestId("BudgetPage-audit-page-indicator"),
      ).toHaveTextContent("Page 1 of 2"),
    );
  });

  test("closing the card drops the body; reopening fetches afresh", async () => {
    localStorage.setItem(OPEN_KEY, "open");
    renderCard();
    await screen.findByTestId("BudgetPage-audit-total");

    await userEvent.click(screen.getByTestId("BudgetPage-auditTrail-toggle"));
    expect(
      screen.queryByTestId("BudgetPage-auditTrail-body"),
    ).not.toBeInTheDocument();
    expect(localStorage.getItem(OPEN_KEY)).toBe("closed");

    await userEvent.click(screen.getByTestId("BudgetPage-auditTrail-toggle"));
    expect(await screen.findByTestId("BudgetPage-audit-total")).toBeVisible();
  });
});
