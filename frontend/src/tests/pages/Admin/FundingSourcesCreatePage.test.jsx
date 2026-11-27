import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import FundingSourcesCreatePage from "main/pages/Admin/FundingSourcesCreatePage";
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

const useBackendMutationSpy = vi.spyOn(useBackendModule, "useBackendMutation");

/** Issue #512: Admin → Funding Sources → Create Funding Source. */
describe("FundingSourcesCreatePage tests", () => {
  const axiosMock = new AxiosMockAdapter(axios);
  const postEndpoint = "/api/admin/fundingSources/post";

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

  const renderPage = (props = {}) =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <FundingSourcesCreatePage {...props} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

  test("renders the heading and an empty form", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Create Funding Source" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Abbreviation/)).toHaveValue("");
    expect(screen.getByLabelText(/^Abbreviation/)).not.toHaveAttribute(
      "readonly",
    );
    expect(screen.getByLabelText(/^Explanation/)).toHaveValue("");
    expect(screen.getByTestId("FundingSourceForm-submit")).toHaveTextContent(
      "Create",
    );
    expect(useBackendMutationSpy).toHaveBeenCalledWith(
      expect.any(Function),
      { onSuccess: expect.any(Function) },
      ["/api/admin/fundingSources/all"],
    );
  });

  test("on submit, posts the trimmed values, toasts and goes back to the list", async () => {
    axiosMock.onPost(postEndpoint).reply(200, {
      abbreviation: "NSF",
      explanation: "National Science Foundation",
    });
    renderPage();

    fireEvent.change(await screen.findByLabelText(/^Abbreviation/), {
      target: { value: " NSF " },
    });
    fireEvent.change(screen.getByLabelText(/^Explanation/), {
      target: { value: "National Science Foundation " },
    });
    fireEvent.click(screen.getByTestId("FundingSourceForm-submit"));

    await waitFor(() => expect(axiosMock.history.post.length).toBe(1));
    expect(axiosMock.history.post[0].url).toBe(postEndpoint);
    expect(axiosMock.history.post[0].params).toEqual({
      abbreviation: "NSF",
      explanation: "National Science Foundation",
    });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "New funding source created - abbreviation: NSF",
      ),
    );
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin/fundingSources" });
  });

  test("a 400 from the backend is toasted and the page stays", async () => {
    axiosMock.onPost(postEndpoint).reply(400, {
      type: "IllegalArgumentException",
      message: "Funding source NSF already exists",
    });
    renderPage();

    fireEvent.change(await screen.findByLabelText(/^Abbreviation/), {
      target: { value: "NSF" },
    });
    fireEvent.change(screen.getByLabelText(/^Explanation/), {
      target: { value: "Again" },
    });
    fireEvent.click(screen.getByTestId("FundingSourceForm-submit"));

    await waitFor(() => expect(axiosMock.history.post.length).toBe(1));
    await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
    expect(mockToast.mock.calls[0][0]).toMatch(/400/);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Create Funding Source" }),
    ).toBeInTheDocument();
  });

  test("in storybook a successful submit does not navigate away", async () => {
    axiosMock.onPost(postEndpoint).reply(200, {
      abbreviation: "NSF",
      explanation: "National Science Foundation",
    });
    renderPage({ storybook: true });

    fireEvent.change(await screen.findByLabelText(/^Abbreviation/), {
      target: { value: "NSF" },
    });
    fireEvent.change(screen.getByLabelText(/^Explanation/), {
      target: { value: "National Science Foundation" },
    });
    fireEvent.click(screen.getByTestId("FundingSourceForm-submit"));

    await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Create Funding Source" }),
    ).toBeInTheDocument();
  });
});
