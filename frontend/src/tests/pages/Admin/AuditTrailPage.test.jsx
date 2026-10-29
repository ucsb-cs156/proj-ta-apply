import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import AuditTrailPage from "main/pages/Admin/AuditTrailPage";
import auditTrailFixtures from "fixtures/auditTrailFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const axiosMock = new AxiosMockAdapter(axios);

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <AuditTrailPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The params of every request for the trail so far, in order. */
const trailRequests = () =>
  axiosMock.history.get
    .filter((r) => r.url === "/api/admin/audittrail/all")
    .map((r) => r.params);

describe("AuditTrailPage tests", () => {
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
      .onGet("/api/admin/audittrail/all")
      .reply(200, auditTrailFixtures.firstPage);
  });

  test("asks for the first page, newest first, and shows it with the count", async () => {
    renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Audit Trail" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId("AuditTrailPage-table-cell-row-0-col-id"),
    ).toHaveTextContent("3");
    expect(screen.getByTestId("AuditTrailPage-total")).toHaveTextContent(
      "3 changes recorded.",
    );
    expect(
      screen.getByTestId("AuditTrailPage-page-indicator"),
    ).toHaveTextContent("Page 1 of 1");
    expect(screen.getByTestId("AuditTrailPage-previous")).toBeDisabled();
    expect(screen.getByTestId("AuditTrailPage-next")).toBeDisabled();
    expect(trailRequests()).toEqual([
      { page: 0, size: 10, sort: "id", direction: "desc" },
    ]);
  });

  test("the sort column, direction and page size are sent, and reset to page one", async () => {
    axiosMock.onGet("/api/admin/audittrail/all").reply(200, {
      ...auditTrailFixtures.firstPage,
      totalElements: 25,
      totalPages: 3,
    });
    renderPage();
    await screen.findByTestId("AuditTrailPage-table-cell-row-0-col-id");

    // Go to page two first, so the resets can be seen.
    await userEvent.click(screen.getByTestId("AuditTrailPage-next"));
    await waitFor(() =>
      expect(trailRequests().at(-1)).toEqual({
        page: 1,
        size: 10,
        sort: "id",
        direction: "desc",
      }),
    );

    await userEvent.selectOptions(
      screen.getByTestId("AuditTrailPage-sort"),
      "fieldName",
    );
    await waitFor(() =>
      expect(trailRequests().at(-1)).toEqual({
        page: 0,
        size: 10,
        sort: "fieldName",
        direction: "desc",
      }),
    );
    expect(screen.getByLabelText("Sort by")).toHaveValue("fieldName");

    await userEvent.click(screen.getByTestId("AuditTrailPage-next"));
    await userEvent.selectOptions(
      screen.getByTestId("AuditTrailPage-direction"),
      "asc",
    );
    await waitFor(() =>
      expect(trailRequests().at(-1)).toEqual({
        page: 0,
        size: 10,
        sort: "fieldName",
        direction: "asc",
      }),
    );
    expect(screen.getByLabelText("Direction")).toHaveValue("asc");

    await userEvent.click(screen.getByTestId("AuditTrailPage-next"));
    await userEvent.selectOptions(
      screen.getByTestId("AuditTrailPage-page-size"),
      "50",
    );
    await waitFor(() =>
      expect(trailRequests().at(-1)).toEqual({
        page: 0,
        size: 50,
        sort: "fieldName",
        direction: "asc",
      }),
    );
    expect(screen.getByLabelText("Page size")).toHaveValue("50");
  });

  test("Previous and Next move through the pages and stop at the ends", async () => {
    const pageOf = (number) => ({
      content: [{ ...auditTrailFixtures.threeRows[0], id: 100 + number }],
      number,
      size: 10,
      totalElements: 25,
      totalPages: 3,
    });
    axiosMock.onGet("/api/admin/audittrail/all").reply((config) => {
      return [200, pageOf(config.params.page)];
    });
    renderPage();

    expect(
      await screen.findByTestId("AuditTrailPage-table-cell-row-0-col-id"),
    ).toHaveTextContent("100");
    expect(
      screen.getByTestId("AuditTrailPage-page-indicator"),
    ).toHaveTextContent("Page 1 of 3");
    expect(screen.getByTestId("AuditTrailPage-previous")).toBeDisabled();
    expect(screen.getByTestId("AuditTrailPage-next")).toBeEnabled();

    await userEvent.click(screen.getByTestId("AuditTrailPage-next"));
    await waitFor(() =>
      expect(
        screen.getByTestId("AuditTrailPage-page-indicator"),
      ).toHaveTextContent("Page 2 of 3"),
    );
    expect(
      screen.getByTestId("AuditTrailPage-table-cell-row-0-col-id"),
    ).toHaveTextContent("101");
    expect(screen.getByTestId("AuditTrailPage-previous")).toBeEnabled();

    await userEvent.click(screen.getByTestId("AuditTrailPage-next"));
    await waitFor(() =>
      expect(
        screen.getByTestId("AuditTrailPage-page-indicator"),
      ).toHaveTextContent("Page 3 of 3"),
    );
    expect(screen.getByTestId("AuditTrailPage-next")).toBeDisabled();

    await userEvent.click(screen.getByTestId("AuditTrailPage-previous"));
    await waitFor(() =>
      expect(
        screen.getByTestId("AuditTrailPage-page-indicator"),
      ).toHaveTextContent("Page 2 of 3"),
    );
    expect(trailRequests().map((p) => p.page)).toEqual([0, 1, 2, 1]);
  });

  test("an empty trail says so, with one page and nothing to page through", async () => {
    axiosMock.onGet("/api/admin/audittrail/all").reply(200, {
      content: [],
      number: 0,
      size: 10,
      totalElements: 0,
      totalPages: 0,
    });
    renderPage();

    await waitFor(() => expect(trailRequests()).toHaveLength(1));
    expect(screen.getByTestId("AuditTrailPage-total")).toHaveTextContent(
      "0 changes recorded.",
    );
    expect(
      screen.getByTestId("AuditTrailPage-page-indicator"),
    ).toHaveTextContent("Page 1 of 1");
    expect(
      screen.queryByTestId("AuditTrailPage-table-cell-row-0-col-id"),
    ).toBeNull();
    expect(screen.getByTestId("AuditTrailPage-next")).toBeDisabled();
  });

  test("the explanation points at the [See value] link", () => {
    renderPage();
    expect(screen.getByText("[See value]")).toBeInTheDocument();
  });
});
