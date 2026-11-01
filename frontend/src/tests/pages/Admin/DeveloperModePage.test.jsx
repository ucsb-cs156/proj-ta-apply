import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import DeveloperModePage from "main/pages/Admin/DeveloperModePage";
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
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <DeveloperModePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const puts = () =>
  axiosMock.history.put.filter((r) => r.url === "/api/admin/developerMode");
const statusGets = () =>
  axiosMock.history.get.filter((r) => r.url === "/api/developerMode");

describe("DeveloperModePage tests", () => {
  beforeEach(() => {
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.adminUser);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.developerModeAvailable);
    axiosMock
      .onGet("/api/developerMode")
      .reply(200, { available: true, on: false });
    axiosMock
      .onPut("/api/admin/developerMode")
      .reply((config) => [
        200,
        { available: true, on: config.params.on === true },
      ]);
  });

  test("explains the switch and shows it off when the instance makes it available", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Developer Mode" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/test instances only/)).toBeInTheDocument();
    expect(
      screen.getByText(/must never be turned on in production/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Flipping the switch is not recorded in any change history/,
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId("DeveloperModePage-available"),
    ).toHaveTextContent(
      "The Developer Mode switch is available on this instance.",
    );
    const toggle = screen.getByTestId("DeveloperModePage-switch");
    expect(toggle).not.toBeChecked();
    expect(toggle).not.toBeDisabled();
    expect(screen.getByLabelText("Developer mode is off")).toBe(toggle);
    expect(
      screen.queryByTestId("DeveloperModePage-unavailable"),
    ).not.toBeInTheDocument();
  });

  test("shows the switch on when it is on", async () => {
    axiosMock
      .onGet("/api/developerMode")
      .reply(200, { available: true, on: true });
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("DeveloperModePage-switch")).toBeChecked(),
    );
    expect(screen.getByLabelText("Developer mode is on")).toBeInTheDocument();
  });

  test("flipping the switch on saves, toasts and re-reads the status", async () => {
    renderPage();
    const toggle = await screen.findByTestId("DeveloperModePage-switch");
    await waitFor(() => expect(statusGets()).toHaveLength(1));

    await userEvent.click(toggle);

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0].params).toEqual({ on: true });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("Developer mode is now on."),
    );
    await waitFor(() => expect(statusGets().length).toBeGreaterThan(1));
  });

  test("flipping the switch off sends on=false and toasts", async () => {
    axiosMock
      .onGet("/api/developerMode")
      .reply(200, { available: true, on: true });
    renderPage();
    const toggle = await screen.findByTestId("DeveloperModePage-switch");
    await waitFor(() => expect(toggle).toBeChecked());

    await userEvent.click(toggle);

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0].params).toEqual({ on: false });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("Developer mode is now off."),
    );
  });

  test("a refused flip is toasted as an error", async () => {
    axiosMock.onPut("/api/admin/developerMode").reply(404, {
      message: "Developer mode is not enabled on this instance",
    });
    renderPage();
    const toggle = await screen.findByTestId("DeveloperModePage-switch");

    await userEvent.click(toggle);

    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockToast.mock.calls[0][0]).toMatch(/404/);
    expect(mockToast).not.toHaveBeenCalledWith("Developer mode is now on.");
  });

  test("says the switch is not available when the instance does not enable it", async () => {
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
    axiosMock
      .onGet("/api/developerMode")
      .reply(200, { available: false, on: false });
    renderPage();

    const alert = await screen.findByTestId("DeveloperModePage-unavailable");
    expect(alert).toHaveTextContent(
      "The Developer Mode switch is not available on this instance: it was started without ENABLE_DEVELOPER_MODE=true. That is the right setting for production.",
    );
    expect(alert).toHaveClass("alert-secondary");
    expect(
      screen.queryByTestId("DeveloperModePage-switch"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("DeveloperModePage-available"),
    ).not.toBeInTheDocument();
  });
});
