import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import HiringStaffIndexPage from "main/pages/Admin/HiringStaffIndexPage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import mockConsole from "tests/testutils/mockConsole";
import { roleEmailFixtures } from "fixtures/roleEmailFixtures";

import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";
import * as useBackendModule from "main/utils/useBackend";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    toast: (x) => mockToast(x),
  };
});

const axiosMock = new AxiosMockAdapter(axios);

const useBackendSpy = vi.spyOn(useBackendModule, "useBackend");

describe("HiringStaffIndexPage tests", () => {
  const getEndpoint = "/api/admin/hiringStaff/all";
  const deleteEndpoint = "/api/admin/hiringStaff/delete";

  const testId = "HiringStaffIndexPage";

  const setupAdminUser = () => {
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.adminUser);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
  };

  const queryClient = new QueryClient();

  afterEach(() => {
    useBackendSpy.mockClear();
  });

  test("Renders with New Hiring Staff Button", async () => {
    setupAdminUser();
    axiosMock.onGet(getEndpoint).reply(200, []);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <HiringStaffIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/New Hiring Staff/)).toBeInTheDocument();
    });
    const button = screen.getByText(/New Hiring Staff/);
    expect(button).toHaveAttribute("href", "/admin/hiringStaff/create");
    expect(button).toHaveAttribute("style", "float: right;");
  });

  test("renders three items correctly", async () => {
    setupAdminUser();
    axiosMock.onGet(getEndpoint).reply(200, roleEmailFixtures.threeItems);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <HiringStaffIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId(`${testId}-cell-row-0-col-email`),
      ).toHaveTextContent("instructor1@example.com");
    });
    expect(
      screen.getByTestId(`${testId}-cell-row-1-col-email`),
    ).toHaveTextContent("admin1@example.com");
    expect(
      screen.getByTestId(`${testId}-cell-row-2-col-email`),
    ).toHaveTextContent("instructor2@example.com");

    // delete button should be visible
    expect(
      screen.getByTestId(`${testId}-cell-row-0-col-delete-button`),
    ).toBeInTheDocument();

    // No ADMIN_EMAILS note here: there is no seed list for hiring staff, so every row can go.
    expect(screen.queryByText(/ADMIN_EMAILS/)).toBeNull();
    expect(screen.getByText("Hiring Staff")).toBeInTheDocument();
    expect(
      screen.getByTestId("HiringStaffIndexPage-role-note"),
    ).toHaveTextContent(
      "Hiring Staff see the Soft Offer Results of each ULA recruitment whose soft offers have been released, and nothing else: no Admin menu, no other admin pages.",
    );
  });

  test("renders empty table when backend unavailable", async () => {
    setupAdminUser();

    axiosMock.onGet(getEndpoint).timeout();

    const restoreConsole = mockConsole();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <HiringStaffIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(axiosMock.history.get.length).toBeGreaterThanOrEqual(1);
    });

    const errorMessage = console.error.mock.calls[0][0];
    expect(errorMessage).toMatch(
      `Error communicating with backend via GET on ${getEndpoint}`,
    );
    restoreConsole();
  });

  test("what happens when you click delete", async () => {
    setupAdminUser();

    axiosMock.onGet(getEndpoint).reply(200, roleEmailFixtures.threeItems);
    axiosMock.onDelete(deleteEndpoint).reply(200, "first instructor deleted");

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <HiringStaffIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId(`${testId}-cell-row-0-col-email`),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByTestId(`${testId}-cell-row-0-col-email`),
    ).toHaveTextContent("instructor1@example.com");

    const deleteButton = screen.getByTestId(
      `${testId}-cell-row-0-col-delete-button`,
    );
    expect(deleteButton).toBeInTheDocument();

    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith("first instructor deleted");
    });

    await waitFor(() => {
      expect(axiosMock.history.delete.length).toBe(1);
    });
    expect(axiosMock.history.delete[0].url).toBe(deleteEndpoint);
    expect(axiosMock.history.delete[0].params).toEqual({
      email: "instructor1@example.com",
    });
  });
  test("useBackend is called with correct cache query key", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <HiringStaffIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(useBackendSpy).toHaveBeenCalledWith(
      [`/api/admin/hiringStaff/all`],
      { method: "GET", url: "/api/admin/hiringStaff/all" },
      [],
    );
  });

  /** Issue #61: the name columns are blank for anyone who has not logged in yet. */
  test("explains at the top where the names come from", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <HiringStaffIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByTestId("HiringStaffIndexPage-names-note"),
    ).toHaveTextContent(
      "First and Last name are populated when the user logs in for the first time.",
    );
  });
});
