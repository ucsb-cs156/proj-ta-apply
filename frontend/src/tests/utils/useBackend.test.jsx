import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";

import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import { vi } from "vitest";

vi.mock("react-router");

const axiosMock = new AxiosMockAdapter(axios);
const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    toast: (x) => mockToast(x),
  };
});

describe("utils/useBackend tests", () => {
  beforeEach(() => {
    vi.spyOn(console, "error");
    console.error.mockImplementation(() => null);
    axiosMock.reset();
    axiosMock.resetHistory();
    mockToast.mockReset();
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  describe("utils/useBackend useBackend tests", () => {
    test("useBackend handles 404 error correctly", async () => {
      // See: https://react-query.tanstack.com/guides/testing#turn-off-retries
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            // ✅ turns retries off
            retry: false,
          },
        },
      });
      const wrapper = ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );

      axiosMock.onGet("/api/admin/users").reply(404, {});

      const { result } = renderHook(
        () =>
          useBackend(
            ["/api/admin/users"],
            { method: "GET", url: "/api/admin/users" },
            ["initialData"],
          ),
        { wrapper },
      );

      await waitFor(() => result.current.isError);

      expect(result.current.data).toEqual(["initialData"]);
      await waitFor(() => expect(console.error).toHaveBeenCalled());
      const errorMessage = console.error.mock.calls[0][0];
      expect(errorMessage).toMatch(
        "Error communicating with backend via GET on /api/admin/users",
      );
      expect(mockToast).toHaveBeenCalledWith(
        "Error communicating with backend via GET on /api/admin/users",
      );
    });
    test("useBackend handles error correctly with suppressed toast", async () => {
      // See: https://react-query.tanstack.com/guides/testing#turn-off-retries
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            // ✅ turns retries off
            retry: false,
          },
        },
      });
      const wrapper = ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );

      axiosMock.onGet("/api/admin/users").reply(404, {});

      const { result } = renderHook(
        () =>
          useBackend(
            ["/api/admin/users"],
            { method: "GET", url: "/api/admin/users" },
            ["initialData"],
            true,
          ),
        { wrapper },
      );

      await waitFor(() => result.current.isError);

      expect(result.current.data).toEqual(["initialData"]);
      await waitFor(() => expect(console.error).toHaveBeenCalled());
      const errorMessage = console.error.mock.calls[0][0];
      expect(errorMessage).toMatch(
        "Error communicating with backend via GET on /api/admin/users",
      );
      expect(mockToast).not.toHaveBeenCalled();
    });
    test("useBackend handles disabled correctly", async () => {
      // See: https://react-query.tanstack.com/guides/testing#turn-off-retries
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            // ✅ turns retries off
            retry: false,
          },
        },
      });
      const wrapper = ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );

      axiosMock.onGet("/api/admin/users").reply(404, {});

      const { result } = renderHook(
        () =>
          useBackend(
            ["/api/admin/users"],
            { method: "GET", url: "/api/admin/users" },
            ["initialData"],
            false,
            { enabled: false },
          ),
        { wrapper },
      );

      expect(result.current.isLoading).toBe(false);
    });
  });
  describe("utils/useBackend useBackendMutation tests", () => {
    test("useBackendMutation handles success correctly", async () => {
      // See: https://react-query.tanstack.com/guides/testing#turn-off-retries
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            // ✅ turns retries off
            retry: false,
          },
        },
      });
      const wrapper = ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );

      queryClient.setQueryData(["/api/ucsbdates/all"], []);

      axiosMock.onPost("/api/ucsbdates/post").reply(202, {
        id: 17,
        quarterYYYYQ: "20221",
        name: "Groundhog Day",
        localDateTime: "2022-02-02T12:00",
      });

      const objectToAxiosParams = (ucsbDate) => ({
        url: "/api/ucsbdates/post",
        method: "POST",
        params: {
          quarterYYYYQ: ucsbDate.quarterYYYYQ,
          name: ucsbDate.name,
          localDateTime: ucsbDate.localDateTime,
        },
      });

      const onSuccess = vi.fn().mockImplementation((ucsbDate) => {
        mockToast(
          `New ucsbDate Created - id: ${ucsbDate.id} name: ${ucsbDate.name}`,
        );
      });

      const { result } = renderHook(
        () =>
          useBackendMutation(objectToAxiosParams, { onSuccess }, [
            "/api/ucsbdates/all",
          ]),
        { wrapper },
      );

      const mutation = result.current;
      act(() =>
        mutation.mutate({
          quarterYYYYQ: "20221",
          name: "Groundhog Day",
          localDateTime: "2022-02-02T12:00",
        }),
      );

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());
      expect(mockToast).toHaveBeenCalledWith(
        "New ucsbDate Created - id: 17 name: Groundhog Day",
      );
      expect(
        queryClient.getQueryState(["/api/ucsbdates/all"]).isInvalidated,
      ).toBe(true);
    });
    test("useBackendMutation silently ignores non-array keys", async () => {
      // See: https://react-query.tanstack.com/guides/testing#turn-off-retries
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            // ✅ turns retries off
            retry: false,
          },
        },
      });
      const wrapper = ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );

      queryClient.setQueryData(["/api/ucsbdates/all"], []);

      axiosMock.onPost("/api/ucsbdates/post").reply(202, {
        id: 17,
        quarterYYYYQ: "20221",
        name: "Groundhog Day",
        localDateTime: "2022-02-02T12:00",
      });

      const objectToAxiosParams = (ucsbDate) => ({
        url: "/api/ucsbdates/post",
        method: "POST",
        params: {
          quarterYYYYQ: ucsbDate.quarterYYYYQ,
          name: ucsbDate.name,
          localDateTime: ucsbDate.localDateTime,
        },
      });

      const onSuccess = vi.fn().mockImplementation((ucsbDate) => {
        mockToast(
          `New ucsbDate Created - id: ${ucsbDate.id} name: ${ucsbDate.name}`,
        );
      });

      const { result } = renderHook(
        () =>
          useBackendMutation(
            objectToAxiosParams,
            { onSuccess },
            "/api/ucsbdates/all",
          ),
        { wrapper },
      );

      const mutation = result.current;
      act(() =>
        mutation.mutate({
          quarterYYYYQ: "20221",
          name: "Groundhog Day",
          localDateTime: "2022-02-02T12:00",
        }),
      );

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());
      expect(mockToast).toHaveBeenCalledWith(
        "New ucsbDate Created - id: 17 name: Groundhog Day",
      );
      expect(
        queryClient.getQueryState(["/api/ucsbdates/all"]).isInvalidated,
      ).toBe(false);
    });
    test("useBackendMutation handles error correctly", async () => {
      // See: https://react-query.tanstack.com/guides/testing#turn-off-retries
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            // ✅ turns retries off
            retry: false,
          },
        },
      });
      const wrapper = ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
      axiosMock.onPost("/api/ucsbdates/post").reply(404);

      const objectToAxiosParams = (ucsbDate) => ({
        url: "/api/ucsbdates/post",
        method: "POST",
        params: {
          quarterYYYYQ: ucsbDate.quarterYYYYQ,
          name: ucsbDate.name,
          localDateTime: ucsbDate.localDateTime,
        },
      });

      const onSuccess = vi.fn().mockImplementation((ucsbDate) => {
        mockToast(
          `New ucsbDate Created - id: ${ucsbDate.id} name: ${ucsbDate.name}`,
        );
      });

      const { result } = renderHook(
        () => useBackendMutation(objectToAxiosParams, { onSuccess }),
        { wrapper },
      );

      const mutation = result.current;

      mutation.mutate(
        {
          quarterYYYYQ: "20221",
          name: "Bastille Day",
          localDateTime: "2022-06-14T12:00",
        },
        {
          onError: (e) =>
            console.error(
              "onError from mutation.mutate called!",
              String(e).substring(0, 199),
            ),
        },
      );

      await waitFor(() => expect(mockToast).toHaveBeenCalled());
      expect(mockToast).toHaveBeenCalledTimes(1);
      expect(mockToast).toHaveBeenCalledWith(
        "Error: Request failed with status code 404",
      );

      expect(console.error).toHaveBeenCalledTimes(1);
      const errorMessage1 = console.error.mock.calls[0][1];
      expect(errorMessage1).toMatch(/Request failed with status code 404/);
      const errorMessage2 = console.error.mock.calls[0][0];
      expect(errorMessage2).toMatch(/onError from mutation.mutate called!/);
    });

    test("invalidation behavior", async () => {});
  });

  // Issue #198: once the session is gone or the server is unreachable, the failures are logged
  // but not toasted; failures the backend answered are still toasted.
  describe("utils/useBackend quiet failures (issue #198)", () => {
    const quietClient = () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
    const wrapperFor = (queryClient) => {
      const Wrapper = ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
      return Wrapper;
    };
    const renderGet = () =>
      renderHook(
        () =>
          useBackend(
            ["/api/admin/users"],
            { method: "GET", url: "/api/admin/users" },
            ["initialData"],
          ),
        { wrapper: wrapperFor(quietClient()) },
      );

    test.each([401, 403])(
      "useBackend logs but does not toast a %i",
      async (status) => {
        axiosMock.onGet("/api/admin/users").reply(status, {});
        const { result } = renderGet();

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(console.error.mock.calls[0][0]).toBe(
          "Error communicating with backend via GET on /api/admin/users",
        );
        expect(console.error.mock.calls[0][1].response.status).toBe(status);
        expect(mockToast).not.toHaveBeenCalled();
        expect(result.current.data).toEqual(["initialData"]);
      },
    );

    test("useBackend logs but does not toast when the server cannot be reached", async () => {
      axiosMock.onGet("/api/admin/users").networkError();
      const { result } = renderGet();

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error.mock.calls[0][1].response).toBeUndefined();
      expect(mockToast).not.toHaveBeenCalled();
    });

    test.each([400, 500])(
      "useBackend still toasts a %i the backend answered",
      async (status) => {
        axiosMock.onGet("/api/admin/users").reply(status, {});
        const { result } = renderGet();

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(mockToast).toHaveBeenCalledTimes(1);
        expect(mockToast).toHaveBeenCalledWith(
          "Error communicating with backend via GET on /api/admin/users",
        );
        expect(console.error).toHaveBeenCalledTimes(1);
      },
    );

    const renderPost = () =>
      renderHook(
        () =>
          useBackendMutation(() => ({
            url: "/api/ucsbdates/post",
            method: "POST",
          })),
        { wrapper: wrapperFor(quietClient()) },
      );

    test("useBackendMutation logs but does not toast a 403", async () => {
      axiosMock.onPost("/api/ucsbdates/post").reply(403);
      const { result } = renderPost();

      act(() => result.current.mutate({}));

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(mockToast).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error.mock.calls[0][0]).toBe("Backend request failed");
      expect(console.error.mock.calls[0][1].response.status).toBe(403);
    });

    test("useBackendMutation logs but does not toast an unreachable server", async () => {
      axiosMock.onPost("/api/ucsbdates/post").networkError();
      const { result } = renderPost();

      act(() => result.current.mutate({}));

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(mockToast).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error.mock.calls[0][0]).toBe("Backend request failed");
    });

    test("useBackendMutation still toasts a 400 the backend answered", async () => {
      axiosMock.onPost("/api/ucsbdates/post").reply(400, { message: "no" });
      const { result } = renderPost();

      act(() => result.current.mutate({}));

      await waitFor(() => expect(mockToast).toHaveBeenCalled());
      expect(mockToast).toHaveBeenCalledWith(
        "Error: Request failed with status code 400",
      );
      expect(console.error).not.toHaveBeenCalled();
    });
  });
});
