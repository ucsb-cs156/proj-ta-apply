import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import FundingSourcesEditPage from "main/pages/Admin/FundingSourcesEditPage";
import { fundingSourcesFixtures } from "fixtures/fundingSourcesFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import * as useBackendModule from "main/utils/useBackend";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const mockNavigate = vi.fn();
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal()),
  Navigate: (x) => {
    mockNavigate(x);
    return null;
  },
}));

const useBackendSpy = vi.spyOn(useBackendModule, "useBackend");
const useBackendMutationSpy = vi.spyOn(useBackendModule, "useBackendMutation");

/** Issue #512: Admin → Funding Sources → Edit, which changes the explanation only. */
describe("FundingSourcesEditPage tests", () => {
  const axiosMock = new AxiosMockAdapter(axios);
  const getEndpoint = "/api/admin/fundingSources/all";
  const putEndpoint = "/api/admin/fundingSources/put";

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

  const renderPage = (abbreviation, props = {}) =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter
          initialEntries={[`/admin/fundingSources/edit/${abbreviation}`]}
        >
          <Routes>
            <Route
              path="/admin/fundingSources/edit/:abbreviation"
              element={<FundingSourcesEditPage {...props} />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

  test("shows the source from the list, with the abbreviation read-only", async () => {
    axiosMock
      .onGet(getEndpoint)
      .reply(200, fundingSourcesFixtures.threeSources);
    renderPage("sub0");

    expect(
      await screen.findByRole("heading", { name: "Edit Funding Source" }),
    ).toBeInTheDocument();
    const abbreviation = await screen.findByLabelText(/^Abbreviation/);
    expect(abbreviation).toHaveValue("sub0");
    expect(abbreviation).toHaveAttribute("readonly");
    expect(screen.getByLabelText(/^Explanation/)).toHaveValue(
      "Temporary Sub Zero",
    );
    expect(
      screen.getByTestId("FundingSourceForm-abbreviation-note"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("FundingSourceForm-submit")).toHaveTextContent(
      "Update",
    );
    expect(screen.queryByTestId("FundingSourcesEditPage-missing")).toBeNull();
    expect(useBackendSpy).toHaveBeenCalledWith(
      [getEndpoint],
      { method: "GET", url: getEndpoint },
      [],
    );
    expect(useBackendMutationSpy).toHaveBeenCalledWith(
      expect.any(Function),
      { onSuccess: expect.any(Function) },
      [getEndpoint],
    );
  });

  test("decodes the abbreviation in the URL", async () => {
    axiosMock
      .onGet(getEndpoint)
      .reply(200, [{ abbreviation: "A/B C", explanation: "Odd one" }]);
    renderPage("A%2FB%20C");

    expect(await screen.findByLabelText(/^Abbreviation/)).toHaveValue("A/B C");
    expect(screen.getByLabelText(/^Explanation/)).toHaveValue("Odd one");
  });

  test("on Update, puts the trimmed explanation in the body, toasts and goes back to the list", async () => {
    axiosMock
      .onGet(getEndpoint)
      .reply(200, fundingSourcesFixtures.threeSources);
    axiosMock
      .onPut(putEndpoint)
      .reply(200, {
        abbreviation: "sub0",
        explanation: "Temporary Sub Zero funds",
      });
    renderPage("sub0");

    fireEvent.change(await screen.findByLabelText(/^Explanation/), {
      target: { value: " Temporary Sub Zero funds " },
    });
    fireEvent.click(screen.getByTestId("FundingSourceForm-submit"));

    await waitFor(() => expect(axiosMock.history.put.length).toBe(1));
    expect(axiosMock.history.put[0].url).toBe(putEndpoint);
    expect(axiosMock.history.put[0].params).toEqual({ abbreviation: "sub0" });
    expect(JSON.parse(axiosMock.history.put[0].data)).toEqual({
      explanation: "Temporary Sub Zero funds",
    });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Funding source updated - abbreviation: sub0",
      ),
    );
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin/fundingSources" });
  });

  test("in storybook a successful Update does not navigate away", async () => {
    axiosMock
      .onGet(getEndpoint)
      .reply(200, fundingSourcesFixtures.threeSources);
    axiosMock
      .onPut(putEndpoint)
      .reply(200, {
        abbreviation: "sub0",
        explanation: "Temporary Sub Zero funds",
      });
    renderPage("sub0", { storybook: true });

    fireEvent.change(await screen.findByLabelText(/^Explanation/), {
      target: { value: "Temporary Sub Zero funds" },
    });
    fireEvent.click(screen.getByTestId("FundingSourceForm-submit"));

    await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Edit Funding Source" }),
    ).toBeInTheDocument();
  });

  test("a 404 from the backend is toasted and the page stays", async () => {
    axiosMock
      .onGet(getEndpoint)
      .reply(200, fundingSourcesFixtures.threeSources);
    axiosMock.onPut(putEndpoint).reply(404, {
      type: "EntityNotFoundException",
      message: "FundingSource with id sub0 not found",
    });
    renderPage("sub0");

    fireEvent.change(await screen.findByLabelText(/^Explanation/), {
      target: { value: "Temporary Sub Zero funds" },
    });
    fireEvent.click(screen.getByTestId("FundingSourceForm-submit"));

    await waitFor(() => expect(axiosMock.history.put.length).toBe(1));
    await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
    expect(mockToast.mock.calls[0][0]).toMatch(/404/);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("says Loading... until the list arrives, then that there is no such source", async () => {
    axiosMock
      .onGet(getEndpoint)
      .reply(200, fundingSourcesFixtures.threeSources);
    renderPage("startup");

    expect(
      await screen.findByTestId("FundingSourcesEditPage-missing"),
    ).toHaveTextContent("Loading...");
    await waitFor(() =>
      expect(
        screen.getByTestId("FundingSourcesEditPage-missing"),
      ).toHaveTextContent(
        "There is no funding source with the abbreviation startup.",
      ),
    );
    expect(screen.queryByLabelText(/^Abbreviation/)).toBeNull();
    expect(screen.queryByTestId("FundingSourceForm-submit")).toBeNull();
  });
});
