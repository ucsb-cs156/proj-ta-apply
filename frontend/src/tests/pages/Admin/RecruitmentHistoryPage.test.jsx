import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import RecruitmentHistoryPage from "main/pages/Admin/RecruitmentHistoryPage";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import recruitmentAuditTrailFixtures from "fixtures/recruitmentAuditTrailFixtures";
import { AUDIT_PAGE_SIZES } from "main/utils/recruitmentAuditTrail";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const axiosMock = new AxiosMockAdapter(axios);

// Recruitment 1 is a closed TA round, 2 an open ULA one.
const [, openUla, closedTa] = recruitmentsFixtures.threeRecruitments;

function renderPage(recruitmentId = 1) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter
        initialEntries={[`/admin/recruitments/${recruitmentId}/history`]}
      >
        <Routes>
          <Route
            path="/admin/recruitments/:recruitmentId/history"
            element={<RecruitmentHistoryPage />}
          />
          <Route path="/admin/audittrail" element={<h1>Audit Trail</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// The audit trail requests made so far, as their params.
const auditRequests = () =>
  axiosMock.history.get
    .filter((request) => request.url === "/api/admin/recruitmentaudittrail/all")
    .map((request) => request.params);

const cell = (row, col) =>
  screen.getByTestId(`RecruitmentHistoryPage-audit-cell-row-${row}-col-${col}`);

describe("RecruitmentHistoryPage tests", () => {
  beforeEach(() => {
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
      .onGet("/api/admin/recruitmentaudittrail/all")
      .reply(200, recruitmentAuditTrailFixtures.onePage);
  });

  test("names the recruitment in the heading and repeats its row, read only", async () => {
    renderPage(1);

    const title = await screen.findByRole("heading", {
      level: 1,
      name: "Change History: TA positions, W26",
    });
    expect(title).toHaveAttribute(
      "data-testid",
      "RecruitmentHistoryPage-title",
    );

    // The one recruitment, fields only.
    expect(
      await screen.findByTestId(
        "RecruitmentHistoryPage-recruitment-cell-row-0-col-quarter",
      ),
    ).toHaveTextContent("W26");
    expect(
      screen.getByTestId(
        "RecruitmentHistoryPage-recruitment-cell-row-0-col-type",
      ),
    ).toHaveTextContent(closedTa.type);
    expect(
      screen.getByTestId(
        "RecruitmentHistoryPage-recruitment-cell-row-0-col-actualClosingDate",
      ),
    ).toHaveTextContent("2026-02-01");
    expect(
      screen.queryByTestId(
        "RecruitmentHistoryPage-recruitment-cell-row-1-col-quarter",
      ),
    ).toBeNull();
    expect(
      screen.queryByTestId(
        "RecruitmentHistoryPage-recruitment-cell-row-0-col-delete-button",
      ),
    ).toBeNull();
    // The heading comes before the recruitment's row, which comes before the trail.
    expect(
      title.compareDocumentPosition(
        screen.getByTestId("RecruitmentHistoryPage-recruitment"),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen
        .getByTestId("RecruitmentHistoryPage-recruitment")
        .compareDocumentPosition(
          screen.getByTestId("RecruitmentHistoryPage-audit-intro"),
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("a ULA recruitment is named as such", async () => {
    renderPage(2);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Change History: ULA positions, W26",
      }),
    ).toBeInTheDocument();
    expect(openUla.type).toBe("ULA");
    await waitFor(() => expect(auditRequests()).toHaveLength(1));
    expect(auditRequests()[0].recruitmentId).toBe("2");
  });

  test("before the recruitment arrives the heading is plain and the row is empty", async () => {
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, []);
    renderPage(1);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Change History" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByTestId("RecruitmentHistoryPage-audit-total"),
      ).toHaveTextContent("3 changes recorded."),
    );
    expect(
      screen.queryByTestId(
        "RecruitmentHistoryPage-recruitment-cell-row-0-col-quarter",
      ),
    ).toBeNull();
  });

  test("the intro says what is listed, and its Audit Trail link opens the Audit Trail page", async () => {
    renderPage(1);

    const intro = await screen.findByTestId(
      "RecruitmentHistoryPage-audit-intro",
    );
    expect(intro).toHaveTextContent(
      "Every change to this recruitment itself, newest first: when it was created, each time it was opened or closed, and each date that changed. Changes to individual applications are on the Audit Trail page.",
    );
    const link = screen.getByTestId("RecruitmentHistoryPage-audit-trail-link");
    expect(link).toHaveTextContent("Audit Trail page");
    expect(link).toHaveAttribute("href", "/admin/audittrail");
    expect(intro).toContainElement(link);

    await userEvent.click(link);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Audit Trail" }),
    ).toBeInTheDocument();
  });

  test("lists the recruitment's change history, newest first, asked for by id", async () => {
    renderPage(1);

    // The total starts at zero and updates once the page arrives.
    const total = await screen.findByTestId(
      "RecruitmentHistoryPage-audit-total",
    );
    await waitFor(() => expect(total).toHaveTextContent("3 changes recorded."));
    expect(cell(0, "whatChanged")).toHaveTextContent("actualOpeningDate");
    expect(cell(1, "whatChanged")).toHaveTextContent("applicationStatus");
    expect(cell(2, "whatChanged")).toHaveTextContent("created");
    // Issue #337: who made the change.
    expect(
      screen.getByTestId("RecruitmentHistoryPage-audit-header-editorEmail"),
    ).toHaveTextContent("Changed By");
    expect(cell(0, "editorEmail")).toHaveTextContent("admin@ucsb.edu");
    expect(cell(2, "editorEmail")).toHaveTextContent("");

    await waitFor(() => expect(auditRequests()).toHaveLength(1));
    expect(auditRequests()[0]).toEqual({
      recruitmentId: "1",
      page: 0,
      size: 10,
      sort: "id",
      direction: "desc",
    });
    expect(
      screen.getByTestId("RecruitmentHistoryPage-audit-page-indicator"),
    ).toHaveTextContent("Page 1 of 1");
    expect(
      screen.getByTestId("RecruitmentHistoryPage-audit-previous"),
    ).toBeDisabled();
    expect(
      screen.getByTestId("RecruitmentHistoryPage-audit-next"),
    ).toBeDisabled();
  });

  test("Next and Previous move through the pages, and a new page size starts over", async () => {
    // One handler, choosing by page and size: the first registered handler for a url wins, so
    // separate handlers per params would never be reached past the one in beforeEach.
    axiosMock.onGet("/api/admin/recruitmentaudittrail/all").reply((config) => {
      const { page, size } = config.params;
      if (size === 25) {
        return [200, recruitmentAuditTrailFixtures.onePage];
      }
      return [
        200,
        page === 0
          ? recruitmentAuditTrailFixtures.firstOfTwoPages
          : recruitmentAuditTrailFixtures.secondOfTwoPages,
      ];
    });
    renderPage(1);

    const indicator = await screen.findByTestId(
      "RecruitmentHistoryPage-audit-page-indicator",
    );
    await waitFor(() => expect(indicator).toHaveTextContent("Page 1 of 2"));
    const previous = screen.getByTestId(
      "RecruitmentHistoryPage-audit-previous",
    );
    const next = screen.getByTestId("RecruitmentHistoryPage-audit-next");
    expect(previous).toBeDisabled();
    expect(next).toBeEnabled();
    expect(cell(0, "whatChanged")).toHaveTextContent("actualOpeningDate");

    await userEvent.click(next);
    await waitFor(() => expect(indicator).toHaveTextContent("Page 2 of 2"));
    expect(cell(0, "whatChanged")).toHaveTextContent("created");
    expect(next).toBeDisabled();
    expect(previous).toBeEnabled();
    expect(auditRequests()[1]).toEqual({
      recruitmentId: "1",
      page: 1,
      size: 10,
      sort: "id",
      direction: "desc",
    });

    await userEvent.click(previous);
    await waitFor(() => expect(indicator).toHaveTextContent("Page 1 of 2"));
    expect(previous).toBeDisabled();

    // A bigger page starts again from the first page.
    await userEvent.click(next);
    await waitFor(() => expect(indicator).toHaveTextContent("Page 2 of 2"));
    const pageSize = screen.getByTestId(
      "RecruitmentHistoryPage-audit-page-size",
    );
    expect([...pageSize.options].map((o) => Number(o.value))).toEqual(
      AUDIT_PAGE_SIZES,
    );
    expect(AUDIT_PAGE_SIZES).toEqual([10, 25, 50, 100]);
    await userEvent.selectOptions(pageSize, "25");
    await waitFor(() => expect(indicator).toHaveTextContent("Page 1 of 1"));
    expect(auditRequests().at(-1)).toEqual({
      recruitmentId: "1",
      page: 0,
      size: 25,
      sort: "id",
      direction: "desc",
    });
    expect(
      screen.getByTestId("RecruitmentHistoryPage-audit-total"),
    ).toHaveTextContent("3 changes recorded.");
  });

  test("with no changes recorded the trail says so and shows page 1 of 1", async () => {
    axiosMock
      .onGet("/api/admin/recruitmentaudittrail/all")
      .reply(200, recruitmentAuditTrailFixtures.emptyPage);
    renderPage(1);

    expect(
      await screen.findByTestId("RecruitmentHistoryPage-audit-total"),
    ).toHaveTextContent("0 changes recorded.");
    await waitFor(() => expect(auditRequests()).toHaveLength(1));
    expect(
      screen.getByTestId("RecruitmentHistoryPage-audit-total"),
    ).toHaveTextContent("0 changes recorded.");
    expect(
      screen.getByTestId("RecruitmentHistoryPage-audit-page-indicator"),
    ).toHaveTextContent("Page 1 of 1");
    expect(
      screen.getByTestId("RecruitmentHistoryPage-audit-next"),
    ).toBeDisabled();
    expect(
      screen.queryByTestId("RecruitmentHistoryPage-audit-cell-row-0-col-id"),
    ).toBeNull();
  });

  test("before the trail arrives, the page is there with nothing in it", async () => {
    axiosMock.onGet("/api/admin/recruitmentaudittrail/all").timeout();
    renderPage(1);

    expect(
      await screen.findByRole("heading", { level: 1, name: /^Change History/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("RecruitmentHistoryPage-audit-total"),
    ).toHaveTextContent("0 changes recorded.");
    expect(
      screen.getByTestId("RecruitmentHistoryPage-audit-page-indicator"),
    ).toHaveTextContent("Page 1 of 1");
  });
});
