import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import FundingSourcesIndexPage from "main/pages/Admin/FundingSourcesIndexPage";
import { fundingSourcesFixtures } from "fixtures/fundingSourcesFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import mockConsole from "tests/testutils/mockConsole";
import * as useBackendModule from "main/utils/useBackend";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const mockedNavigate = vi.fn();
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mockedNavigate,
}));

const axiosMock = new AxiosMockAdapter(axios);
const useBackendSpy = vi.spyOn(useBackendModule, "useBackend");

/** Issue #512: Admin → Funding Sources. */
describe("FundingSourcesIndexPage tests", () => {
  const getEndpoint = "/api/admin/fundingSources/all";
  const deleteEndpoint = "/api/admin/fundingSources/delete";
  const testId = "FundingSourcesIndexPage";

  beforeEach(() => {
    vi.clearAllMocks();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.adminUser);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
  });

  const renderPage = () =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <FundingSourcesIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

  test("renders the heading, the note and the Create button on an empty list", async () => {
    axiosMock.onGet(getEndpoint).reply(200, []);
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Funding Sources" }),
    ).toBeInTheDocument();
    const create = screen.getByTestId(`${testId}-create`);
    expect(create).toHaveTextContent("Create Funding Source");
    expect(create).toHaveAttribute("href", "/admin/fundingSources/create");
    expect(create).toHaveAttribute("style", "float: right;");
    expect(create).toHaveClass("btn", "btn-primary");
    expect(screen.getByTestId(`${testId}-note`)).toHaveTextContent(
      "The abbreviation is what the Funding dropdown on Soft Offer Results and its CSV show; the explanation says what it means. An abbreviation cannot be changed once created: to change one, delete it and create another.",
    );
    expect(screen.getByText("Abbreviation")).toBeInTheDocument();
    expect(screen.getByText("Explanation")).toBeInTheDocument();
    expect(screen.getByTestId(`${testId}-header-edit`)).toHaveTextContent(
      "Edit",
    );
    expect(screen.getByTestId(`${testId}-header-delete`)).toHaveTextContent(
      "Delete",
    );
    expect(screen.queryByTestId(`${testId}-cell-row-0-col-abbreviation`)).toBe(
      null,
    );
    expect(useBackendSpy).toHaveBeenCalledWith(
      [getEndpoint],
      { method: "GET", url: getEndpoint },
      [],
    );
  });

  test("lists the sources sorted by abbreviation, each with Edit and Delete", async () => {
    axiosMock
      .onGet(getEndpoint)
      .reply(200, fundingSourcesFixtures.threeSourcesUnsorted);
    renderPage();

    expect(
      await screen.findByTestId(`${testId}-cell-row-0-col-abbreviation`),
    ).toHaveTextContent("ds-gift");
    expect(
      screen.getByTestId(`${testId}-cell-row-0-col-explanation`),
    ).toHaveTextContent("Data Science Gift");
    expect(
      screen.getByTestId(`${testId}-cell-row-1-col-abbreviation`),
    ).toHaveTextContent("sub0");
    expect(
      screen.getByTestId(`${testId}-cell-row-1-col-explanation`),
    ).toHaveTextContent("Temporary Sub Zero");
    expect(
      screen.getByTestId(`${testId}-cell-row-2-col-abbreviation`),
    ).toHaveTextContent("ula-gift");
    expect(
      screen.getByTestId(`${testId}-cell-row-2-col-explanation`),
    ).toHaveTextContent("Gift funding for ULAs");

    const edit = screen.getByTestId(`${testId}-cell-row-1-col-edit-button`);
    expect(edit).toHaveTextContent("Edit");
    expect(edit).toHaveClass("btn-primary");
    const del = screen.getByTestId(`${testId}-cell-row-1-col-delete-button`);
    expect(del).toHaveTextContent("Delete");
    expect(del).toHaveClass("btn-danger");
    // The table takes its natural width.
    expect(screen.getByTestId(testId)).toHaveClass("w-auto");
  });

  test("Edit opens the edit page of that row's abbreviation", async () => {
    axiosMock
      .onGet(getEndpoint)
      .reply(200, fundingSourcesFixtures.threeSources);
    renderPage();

    fireEvent.click(
      await screen.findByTestId(`${testId}-cell-row-1-col-edit-button`),
    );

    expect(mockedNavigate).toHaveBeenCalledWith(
      "/admin/fundingSources/edit/sub0",
    );
    expect(mockedNavigate).toHaveBeenCalledTimes(1);
  });

  test("Delete asks the backend at once and toasts its message", async () => {
    axiosMock
      .onGet(getEndpoint)
      .reply(200, fundingSourcesFixtures.threeSources);
    axiosMock
      .onDelete(deleteEndpoint)
      .reply(200, { message: "FundingSource with id TA deleted" });
    renderPage();

    fireEvent.click(
      await screen.findByTestId(`${testId}-cell-row-2-col-delete-button`),
    );

    await waitFor(() => expect(axiosMock.history.delete.length).toBe(1));
    expect(axiosMock.history.delete[0].url).toBe(deleteEndpoint);
    expect(axiosMock.history.delete[0].params).toEqual({
      abbreviation: "ula-gift",
    });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "FundingSource with id TA deleted",
      ),
    );
    // The list is re-read after the delete.
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter((r) => r.url === getEndpoint).length,
      ).toBeGreaterThanOrEqual(2),
    );
  });

  test("renders an empty table and logs when the backend is unavailable", async () => {
    axiosMock.onGet(getEndpoint).timeout();
    const restoreConsole = mockConsole();
    renderPage();

    await waitFor(() => {
      expect(axiosMock.history.get.length).toBeGreaterThanOrEqual(1);
    });
    // The layout's own developer-mode read may log first; look for this page's message.
    const expected = `Error communicating with backend via GET on ${getEndpoint}`;
    await waitFor(() =>
      expect(
        console.error.mock.calls.some((call) => call[0] === expected),
      ).toBe(true),
    );
    expect(screen.queryByTestId(`${testId}-cell-row-0-col-abbreviation`)).toBe(
      null,
    );
    restoreConsole();
  });
});
