import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCurrentUser, useLogout, hasRole } from "main/utils/currentUser";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  apiCurrentUserFixtures,
  currentUserFixtures,
} from "fixtures/currentUserFixtures";
import mockConsole from "tests/testutils/mockConsole";
import { useNavigate } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

vi.mock("react-router");
const { MemoryRouter } = await vi.importActual("react-router");

const axiosMock = new AxiosMockAdapter(axios);

describe("utils/currentUser tests", () => {
  beforeEach(() => {
    axiosMock.reset();
    axiosMock.resetHistory();
    vi.clearAllMocks();
  });

  describe("useCurrentUser tests", () => {
    test("useCurrentUser returns initialData when request is pending", () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );

      axiosMock.onGet("/api/currentUser").timeout();

      const { result } = renderHook(() => useCurrentUser(), { wrapper });

      expect(result.current).toEqual({ loggedIn: false, root: null });
      queryClient.clear();
    });

    test("useCurrentUser returns user data from API", async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );

      axiosMock
        .onGet("/api/currentUser")
        .reply(200, apiCurrentUserFixtures.userOnly);

      const { result } = renderHook(() => useCurrentUser(), { wrapper });

      await waitFor(() =>
        expect(result.current).toEqual(currentUserFixtures.userOnly),
      );
      queryClient.clear();
    });

    test("useCurrentUser returns { loggedIn: false, root: {} } for 403", async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );

      axiosMock.onGet("/api/currentUser").reply(403);

      const { result } = renderHook(() => useCurrentUser(), { wrapper });

      await waitFor(() =>
        expect(result.current).toEqual({ loggedIn: false, root: {} }),
      );
      queryClient.clear();
    });
  });

  describe("hasRole tests", () => {
    test("hasRole returns false for null/undefined/empty currentUser", () => {
      expect(hasRole(null, "ROLE_ADMIN")).toBeFalsy();
      expect(hasRole(undefined, "ROLE_ADMIN")).toBeFalsy();
      expect(hasRole({}, "ROLE_ADMIN")).toBeFalsy();
      expect(hasRole({ loggedIn: true }, "ROLE_ADMIN")).toBeFalsy();
      expect(hasRole({ loggedIn: true, root: null }, "ROLE_ADMIN")).toBeFalsy();
      expect(hasRole({ loggedIn: true, root: {} }, "ROLE_ADMIN")).toBeFalsy();
    });

    test("hasRole returns correct values for properly-defined currentUser", () => {
      expect(
        hasRole({ loggedIn: true, root: { rolesList: [] } }, "ROLE_ADMIN"),
      ).toBeFalsy();
      expect(
        hasRole(
          { loggedIn: true, root: { rolesList: ["ROLE_USER"] } },
          "ROLE_ADMIN",
        ),
      ).toBeFalsy();
      expect(
        hasRole(
          { loggedIn: true, root: { rolesList: ["ROLE_USER", "ROLE_ADMIN"] } },
          "ROLE_ADMIN",
        ),
      ).toBeTruthy();
      expect(
        hasRole(
          { loggedIn: true, root: { rolesList: ["ROLE_USER"] } },
          "ROLE_USER",
        ),
      ).toBeTruthy();
    });
  });

  describe("useLogout tests", () => {
    test("useLogout calls /logout, resets queries, and navigates to /", async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }) => (
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>{children}</MemoryRouter>
        </QueryClientProvider>
      );

      axiosMock.onPost("/logout").reply(200);

      const navigateSpy = vi.fn();
      useNavigate.mockImplementation(() => navigateSpy);

      const resetQueriesSpy = vi.spyOn(queryClient, "resetQueries");

      const { result } = renderHook(() => useLogout(), { wrapper });

      act(() => {
        result.current.mutate();
      });

      await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith("/"));
      await waitFor(() =>
        expect(resetQueriesSpy).toHaveBeenCalledWith({
          queryKey: ["current user"],
        }),
      );

      queryClient.clear();
    });
  });
});
