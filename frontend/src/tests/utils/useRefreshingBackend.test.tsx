import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  refreshOptions,
  useRefreshingBackend,
} from "main/utils/useRefreshingBackend";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const axiosMock = new AxiosMockAdapter(axios);

const wrapperFor = (client: QueryClient) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };

const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe("refreshOptions", () => {
  test("hands out a function that draws a new wait every time", () => {
    const draws = [0, 1, 0.5];
    let i = 0;
    const options = refreshOptions<string[]>(
      true,
      { adminRefreshSec: 5, adminRefreshJitter: 3 },
      () => draws[i++],
    );
    const interval = options.refetchInterval as () => number;
    expect([interval(), interval(), interval()]).toEqual([2000, 8000, 5000]);
  });

  test("uses the non-admin pair for everyone else", () => {
    const options = refreshOptions<string[]>(
      false,
      { nonAdminRefresh: 15, nonAdminJitter: 5 },
      () => 0,
    );
    expect((options.refetchInterval as () => number)()).toBe(10000);
  });

  test("pauses in hidden tabs and refetches when the window is focused", () => {
    const options = refreshOptions<string[]>(true, undefined);
    expect(options.refetchIntervalInBackground).toBe(false);
    expect(options.refetchOnWindowFocus).toBe(true);
  });
});

describe("useRefreshingBackend", () => {
  beforeEach(() => {
    axiosMock.reset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const stub = (user: unknown, info: object) => {
    axiosMock.onGet("/api/currentUser").reply(200, user);
    axiosMock.onGet("/api/systemInfo").reply(200, info);
    let n = 0;
    axiosMock.onGet("/api/thing").reply(() => [200, `v${++n}`]);
  };

  const thingCalls = () =>
    axiosMock.history.get.filter((r) => r.url === "/api/thing").length;

  const run = (options = {}) =>
    renderHook(
      () =>
        useRefreshingBackend<string>(
          ["/api/thing"],
          { method: "GET", url: "/api/thing" },
          "initial",
          false,
          options,
        ),
      { wrapper: wrapperFor(newClient()) },
    );

  test("an admin's page re-reads on its own, without a reload", async () => {
    stub(apiCurrentUserFixtures.adminUser, {
      ...systemInfoFixtures.showingNeither,
      adminRefreshSec: 5,
      adminRefreshJitter: 0,
      nonAdminRefresh: 100,
      nonAdminJitter: 0,
    });
    const { result } = run();
    await waitFor(() => expect(result.current.data).toBe("v1"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5100);
    });
    await waitFor(() => expect(result.current.data).toBe("v2"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5100);
    });
    await waitFor(() => expect(result.current.data).toBe("v3"));
  });

  test("a non-admin waits the longer interval", async () => {
    stub(apiCurrentUserFixtures.userOnly, {
      ...systemInfoFixtures.showingNeither,
      adminRefreshSec: 5,
      adminRefreshJitter: 0,
      nonAdminRefresh: 20,
      nonAdminJitter: 0,
    });
    const { result } = run();
    await waitFor(() => expect(result.current.data).toBe("v1"));
    const before = thingCalls();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(thingCalls()).toBe(before);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(11000);
    });
    await waitFor(() => expect(result.current.data).toBe("v2"));
  });

  test("options given by the caller win", async () => {
    stub(apiCurrentUserFixtures.adminUser, {
      ...systemInfoFixtures.showingNeither,
      adminRefreshSec: 5,
      adminRefreshJitter: 0,
    });
    const { result } = run({ refetchInterval: false });
    await waitFor(() => expect(result.current.data).toBe("v1"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(result.current.data).toBe("v1");
  });
});
