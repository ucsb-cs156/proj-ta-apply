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

/** A query as react-query hands it to the interval function: only its read counts matter. */
type Query = { state: { dataUpdateCount: number; errorUpdateCount: number } };
const queryRead = (dataUpdateCount: number, errorUpdateCount = 0): Query => ({
  state: { dataUpdateCount, errorUpdateCount },
});
type Interval = (query: Query) => number;

describe("refreshOptions", () => {
  test("draws a new wait after every read of the query", () => {
    const draws = [0, 1, 0.5];
    let i = 0;
    const options = refreshOptions<string[]>(
      true,
      { adminRefreshSec: 5, adminRefreshJitter: 3 },
      () => draws[i++],
    );
    const interval = options.refetchInterval as Interval;
    const query = queryRead(1);
    const first = interval(query);
    query.state.dataUpdateCount = 2;
    const second = interval(query);
    query.state.errorUpdateCount = 1;
    expect([first, second, interval(query)]).toEqual([2000, 8000, 5000]);
  });

  test("gives the same wait however often it is asked between two reads, so a page that renders often still refreshes (issue #426)", () => {
    const draws = [0, 1];
    let i = 0;
    const options = refreshOptions<string[]>(
      true,
      { adminRefreshSec: 5, adminRefreshJitter: 3 },
      () => draws[i++],
    );
    const interval = options.refetchInterval as Interval;
    const query = queryRead(3);

    expect([interval(query), interval(query), interval(query)]).toEqual([
      2000, 2000, 2000,
    ]);
    // Another query has a draw of its own.
    expect(interval(queryRead(3))).toBe(8000);
  });

  test("draws again, before any new read, when the timing changes, as when the settings arrive", () => {
    const query = queryRead(0);
    const before = refreshOptions<string[]>(false, undefined, () => 0);
    const wait = (options: typeof before) =>
      (options.refetchInterval as Interval)(query);
    expect(wait(before)).toBe(10000);

    const admin = { adminRefreshSec: 5, adminRefreshJitter: 3 };
    expect(wait(refreshOptions<string[]>(true, admin, () => 0))).toBe(2000);
    expect(
      wait(
        refreshOptions<string[]>(
          true,
          { adminRefreshSec: 5, adminRefreshJitter: 2 },
          () => 0,
        ),
      ),
    ).toBe(3000);
    expect(wait(refreshOptions<string[]>(true, admin, () => 0, 10))).toBe(7000);
  });

  test("tells reads apart by both counts, whatever their digits", () => {
    const draws = [0, 1];
    let i = 0;
    const options = refreshOptions<string[]>(
      true,
      { adminRefreshSec: 5, adminRefreshJitter: 3 },
      () => draws[i++],
    );
    const interval = options.refetchInterval as Interval;
    const query = queryRead(1, 11);
    const first = interval(query);
    query.state.dataUpdateCount = 11;
    query.state.errorUpdateCount = 1;

    expect([first, interval(query)]).toEqual([2000, 8000]);
  });

  test("uses the non-admin pair for everyone else", () => {
    const options = refreshOptions<string[]>(
      false,
      { nonAdminRefresh: 15, nonAdminJitter: 5 },
      () => 0,
    );
    expect((options.refetchInterval as Interval)(queryRead(0))).toBe(10000);
  });

  test("another mean wait keeps the role's jitter (issue #426)", () => {
    const draws = [0, 1];
    let i = 0;
    const options = refreshOptions<string[]>(
      true,
      { adminRefreshSec: 5, adminRefreshJitter: 3 },
      () => draws[i++],
      10,
    );
    const interval = options.refetchInterval as Interval;
    expect([interval(queryRead(0)), interval(queryRead(0))]).toEqual([
      7000, 13000,
    ]);
  });

  test("another mean wait never has a jitter larger than itself (issue #426)", () => {
    const options = refreshOptions<string[]>(
      true,
      { adminRefreshSec: 20, adminRefreshJitter: 15 },
      () => 1,
      10,
    );
    expect((options.refetchInterval as Interval)(queryRead(0))).toBe(20000);
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

  const run = (options = {}, baseSeconds?: number) =>
    renderHook(
      () =>
        useRefreshingBackend<string>(
          ["/api/thing"],
          { method: "GET", url: "/api/thing" },
          "initial",
          false,
          options,
          baseSeconds,
        ),
      { wrapper: wrapperFor(newClient()) },
    );

  /** Hides or shows the tab, as the browser does when the user switches tabs. */
  const setVisibility = (state: "hidden" | "visible") => {
    Object.defineProperty(document, "visibilityState", {
      value: state,
      configurable: true,
    });
    window.dispatchEvent(new Event("visibilitychange"));
  };

  test("a page given another mean wait re-reads at that pace (issue #426)", async () => {
    stub(apiCurrentUserFixtures.adminUser, {
      ...systemInfoFixtures.showingNeither,
      adminRefreshSec: 5,
      adminRefreshJitter: 0,
    });
    const { result } = run({}, 10);
    await waitFor(() => expect(result.current.data).toBe("v1"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
    });
    expect(result.current.data).toBe("v1");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    await waitFor(() => expect(result.current.data).toBe("v2"));
  });

  test("a page that renders more often than it waits still re-reads (issue #426)", async () => {
    stub(apiCurrentUserFixtures.adminUser, {
      ...systemInfoFixtures.showingNeither,
      adminRefreshSec: 5,
      adminRefreshJitter: 3,
    });
    // Every draw differs a little, as Math.random's do.
    let n = 0;
    const random = vi
      .spyOn(Math, "random")
      .mockImplementation(() => 0.5 + (n++ % 2) / 20);
    try {
      const { result, rerender } = run({}, 10);
      await waitFor(() => expect(result.current.data).toBe("v1"));
      // A heartbeat or a clock renders the page every 2 seconds.
      for (let second = 0; second < 16; second += 2) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2000);
        });
        rerender();
      }
      await waitFor(() => expect(result.current.data).toBe("v2"));
    } finally {
      random.mockRestore();
    }
  });

  test("a hidden tab does not fetch, and one shown again re-reads at once (issue #426)", async () => {
    stub(apiCurrentUserFixtures.adminUser, {
      ...systemInfoFixtures.showingNeither,
      adminRefreshSec: 5,
      adminRefreshJitter: 0,
    });
    try {
      const { result } = run({}, 10);
      await waitFor(() => expect(result.current.data).toBe("v1"));
      const before = thingCalls();

      setVisibility("hidden");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });
      expect(thingCalls()).toBe(before);

      setVisibility("visible");
      await waitFor(() => expect(result.current.data).toBe("v2"));
      expect(thingCalls()).toBe(before + 1);
    } finally {
      setVisibility("visible");
    }
  });

  test("a window that can be seen but has lost the focus keeps re-reading, as one of two side by side does (issue #426)", async () => {
    stub(apiCurrentUserFixtures.adminUser, {
      ...systemInfoFixtures.showingNeither,
      adminRefreshSec: 5,
      adminRefreshJitter: 0,
    });
    const { result } = run({}, 10);
    await waitFor(() => expect(result.current.data).toBe("v1"));
    const hasFocus = vi.spyOn(document, "hasFocus").mockReturnValue(false);
    try {
      window.dispatchEvent(new Event("blur"));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10500);
      });
      await waitFor(() => expect(result.current.data).toBe("v2"));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10500);
      });
      await waitFor(() => expect(result.current.data).toBe("v3"));
    } finally {
      hasFocus.mockRestore();
    }
  });

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
