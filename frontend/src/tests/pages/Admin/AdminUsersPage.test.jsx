import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";
import usersFixtures from "fixtures/usersFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import AdminUsersPage from "main/pages/Admin/AdminUsersPage";
import * as useBackendModule from "main/utils/useBackend";
import mockConsole from "tests/testutils/mockConsole";

const axiosMock = new AxiosMockAdapter(axios);
const useBackendSpy = vi.spyOn(useBackendModule, "useBackend");

describe("AdminUsersPage tests", () => {
  const getEndpoint = "/api/admin/users";

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

  const renderPage = () => {
    const queryClient = new QueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminUsersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  afterEach(() => {
    useBackendSpy.mockClear();
  });

  test("renders paged users with controls", async () => {
    setupAdminUser();
    axiosMock.onGet(getEndpoint).replyOnce(200, {
      content: usersFixtures.threeUsers,
      number: 0,
      size: 10,
      totalElements: 3,
      totalPages: 1,
    });

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByTestId("UsersTable-cell-row-0-col-email"),
      ).toHaveTextContent("phtcon@ucsb.edu");
    });

    expect(screen.getByText("Users")).toBeInTheDocument();
    expect(screen.getByLabelText("Page size")).toHaveValue("10");
    expect(
      screen.getByTestId("AdminUsersPage-page-indicator"),
    ).toHaveTextContent("Page 1 of 1");
    expect(screen.getByText("Previous")).toBeDisabled();
    expect(screen.getByText("Next")).toBeDisabled();
    expect(
      screen.getByTestId("UsersTable-cell-row-0-col-email"),
    ).toHaveTextContent("phtcon@ucsb.edu");
    expect(
      screen.getByTestId("UsersTable-cell-row-2-col-instructor"),
    ).toHaveTextContent("true");
  });

  test("supports paging and changing page size", async () => {
    setupAdminUser();
    let usersRequestCount = 0;
    axiosMock.onGet(getEndpoint).reply(() => {
      usersRequestCount += 1;

      if (usersRequestCount === 1) {
        return [
          200,
          {
            content: [usersFixtures.threeUsers[0]],
            number: 0,
            size: 10,
            totalElements: 2,
            totalPages: 2,
          },
        ];
      }

      if (usersRequestCount === 2) {
        return [
          200,
          {
            content: [usersFixtures.threeUsers[1]],
            number: 1,
            size: 10,
            totalElements: 2,
            totalPages: 2,
          },
        ];
      }

      return [
        200,
        {
          content: [usersFixtures.threeUsers[0], usersFixtures.threeUsers[1]],
          number: 0,
          size: 25,
          totalElements: 2,
          totalPages: 1,
        },
      ];
    });

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByTestId("UsersTable-cell-row-0-col-email"),
      ).toHaveTextContent("phtcon@ucsb.edu");
    });

    fireEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(
        screen.getByTestId("AdminUsersPage-page-indicator"),
      ).toHaveTextContent("Page 2 of 2");
    });
    expect(
      screen.getByTestId("UsersTable-cell-row-0-col-email"),
    ).toHaveTextContent("pconrad.cis@gmail.com");

    fireEvent.change(screen.getByLabelText("Page size"), {
      target: { value: "25" },
    });

    await waitFor(() => {
      expect(
        screen.getByTestId("UsersTable-cell-row-1-col-email"),
      ).toHaveTextContent("pconrad.cis@gmail.com");
    });
    expect(
      screen.getByTestId("AdminUsersPage-page-indicator"),
    ).toHaveTextContent("Page 1 of 1");
    expect(
      screen.getByTestId("UsersTable-cell-row-0-col-email"),
    ).toHaveTextContent("phtcon@ucsb.edu");
    expect(
      screen.getByTestId("UsersTable-cell-row-1-col-email"),
    ).toHaveTextContent("pconrad.cis@gmail.com");
  });

  test("renders empty table when backend unavailable", async () => {
    setupAdminUser();
    axiosMock.onGet(getEndpoint).timeout();

    const restoreConsole = mockConsole();

    renderPage();

    await waitFor(() => {
      expect(axiosMock.history.get.length).toBeGreaterThanOrEqual(1);
    });

    const errorMessage = console.error.mock.calls[0][0];
    expect(errorMessage).toMatch(
      `Error communicating with backend via GET on ${getEndpoint}`,
    );
    restoreConsole();
  });

  test("useBackend is called with correct cache query key", () => {
    setupAdminUser();
    axiosMock.onGet(getEndpoint).reply(200, {
      content: [],
      number: 0,
      size: 10,
      totalElements: 0,
      totalPages: 0,
    });

    renderPage();

    expect(useBackendSpy).toHaveBeenCalledWith(
      ["/api/admin/users", 0, 10],
      {
        method: "GET",
        url: "/api/admin/users",
        params: { page: 0, size: 10 },
      },
      {
        content: [],
        number: 0,
        size: 10,
        totalElements: 0,
        totalPages: 0,
      },
    );
  });
});
