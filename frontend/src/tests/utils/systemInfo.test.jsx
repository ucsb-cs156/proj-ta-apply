import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSystemInfo } from "main/utils/systemInfo";
import { renderHook, waitFor } from "@testing-library/react";
import mockConsole from "tests/testutils/mockConsole";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const axiosMock = new AxiosMockAdapter(axios);

describe("utils/systemInfo tests", () => {
  beforeEach(() => {
    axiosMock.reset();
    axiosMock.resetHistory();
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
