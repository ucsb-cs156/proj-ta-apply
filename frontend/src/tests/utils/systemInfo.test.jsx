import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSystemInfo } from "main/utils/systemInfo";
import { renderHook, waitFor } from "@testing-library/react";
import mockConsole from "tests/testutils/mockConsole";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import {
  PACIFIC_TIME_ZONE,
  appTimeZone,
  formatPacificDateTime,
  setAppTimeZone,
} from "main/utils/pacificTime";

const axiosMock = new AxiosMockAdapter(axios);

describe("utils/systemInfo tests", () => {
  beforeEach(() => {
    axiosMock.reset();
    axiosMock.resetHistory();
  });

  afterEach(() => {
    // the hook sets the app's zone for every test that follows (issue #513); put it back
    setAppTimeZone(PACIFIC_TIME_ZONE);
  });

  describe("useSystemInfo tests", () => {
    test("useSystemInfo returns initialData when request is pending", async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );

      const restoreConsole = mockConsole();

      axiosMock.onGet("/api/systemInfo").timeout();

      const { result } = renderHook(() => useSystemInfo(), { wrapper });

      expect(result.current.data).toEqual({
        springH2ConsoleEnabled: false,
        showSwaggerUILink: false,
        oauthLogin: "/oauth2/authorization/google",
        sourceRepo: "",
      });

      await waitFor(() => expect(result.current.isFetched).toBe(true));

      restoreConsole();
      queryClient.clear();
    });

    test("useSystemInfo retrieves data from API", async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );

      axiosMock
        .onGet("/api/systemInfo")
        .reply(200, systemInfoFixtures.showingBoth);

      const { result } = renderHook(() => useSystemInfo(), { wrapper });

      await waitFor(() =>
        expect(result.current.isFetchedAfterMount).toBe(true),
      );

      expect(result.current.data).toEqual(systemInfoFixtures.showingBoth);
      expect(appTimeZone()).toBe("America/Los_Angeles");
      queryClient.clear();
    });

    // Issue #513: the server's zone reaches every formatter the moment systemInfo arrives.
    test("useSystemInfo hands the server's time zone to the formatters", async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );

      axiosMock.onGet("/api/systemInfo").reply(200, {
        ...systemInfoFixtures.showingBoth,
        timeZone: "Asia/Tokyo",
      });

      const { result } = renderHook(() => useSystemInfo(), { wrapper });

      await waitFor(() =>
        expect(result.current.isFetchedAfterMount).toBe(true),
      );

      expect(result.current.data.timeZone).toBe("Asia/Tokyo");
      expect(appTimeZone()).toBe("Asia/Tokyo");
      // 7 a.m. UTC on July 1 is 4 p.m. in Tokyo
      expect(formatPacificDateTime("2026-07-01T07:00:00Z")).toBe(
        "7/1/2026, 4:00:00 PM",
      );
      queryClient.clear();
    });

    test("useSystemInfo leaves the zone alone when the server names none", async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );

      const { timeZone: _omitted, ...withoutZone } =
        systemInfoFixtures.showingBoth;
      axiosMock.onGet("/api/systemInfo").reply(200, withoutZone);

      const { result } = renderHook(() => useSystemInfo(), { wrapper });

      await waitFor(() =>
        expect(result.current.isFetchedAfterMount).toBe(true),
      );

      expect(result.current.data).toEqual(withoutZone);
      expect(appTimeZone()).toBe("America/Los_Angeles");
      queryClient.clear();
    });

    test("useSystemInfo catches errors, logs them, and returns defaults", async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );

      axiosMock.onGet("/api/systemInfo").reply(404);

      const restoreConsole = mockConsole();

      const { result } = renderHook(() => useSystemInfo(), { wrapper });

      await waitFor(() =>
        expect(result.current.isFetchedAfterMount).toBe(true),
      );

      expect(console.error).toHaveBeenCalled();
      const errorMsg = console.error.mock.calls[0][0];
      expect(errorMsg).toBe("Error fetching systemInfo:");

      restoreConsole();

      expect(result.current.data).toEqual({
        springH2ConsoleEnabled: false,
        showSwaggerUILink: false,
        oauthLogin: "/oauth2/authorization/google",
        sourceRepo: "",
      });
      queryClient.clear();
    });
  });
});
