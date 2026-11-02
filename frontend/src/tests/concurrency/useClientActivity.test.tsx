import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import {
  DEFAULT_HEARTBEAT_MS,
  useClientActivity,
} from "main/concurrency/useClientActivity";

const axiosMock = new AxiosMockAdapter(axios);
const URL = "/thing/heartbeat?id=1";

const beats = () => axiosMock.history.post.filter((r) => r.url === URL);

/** Lets the heartbeat in flight finish, and then the time given pass. */
const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe("useClientActivity", () => {
  beforeEach(() => {
    axiosMock.reset();
    axiosMock.resetHistory();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("makes a random identifier, sent as a header, and keeps it for the life of the hook", () => {
    const { result, rerender } = renderHook(() =>
      useClientActivity({ heartbeatUrl: null }),
    );
    const id = result.current.clientId;

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(result.current.headers).toEqual({ "X-Client-Id": id });
    rerender();
    expect(result.current.clientId).toBe(id);
  });

  test("two hooks, as two tabs would be, have different identifiers", () => {
    const first = renderHook(() => useClientActivity({ heartbeatUrl: null }));
    const second = renderHook(() => useClientActivity({ heartbeatUrl: null }));
    expect(first.result.current.clientId).not.toBe(
      second.result.current.clientId,
    );
  });

  test("keeps the identifier out of storage, so a restored tab does not inherit one", () => {
    const local = vi.spyOn(Storage.prototype, "setItem");
    renderHook(() => useClientActivity({ heartbeatUrl: null }));
    expect(local).not.toHaveBeenCalled();
    local.mockRestore();
  });

  test("nobody else is active to begin with, and nothing is sent without a URL", async () => {
    const { result } = renderHook(() =>
      useClientActivity({ heartbeatUrl: null }),
    );
    await advance(120_000);
    expect(result.current.othersActive).toBe(false);
    expect(axiosMock.history.post.length).toBe(0);
  });

  test("sends a heartbeat at once, naming itself, and then every 20 seconds", async () => {
    axiosMock.onPost(URL).reply(204);
    const { result } = renderHook(() =>
      useClientActivity({ heartbeatUrl: URL }),
    );

    await advance(0);
    expect(beats().length).toBe(1);
    expect(beats()[0].headers?.["X-Client-Id"]).toBe(result.current.clientId);

    await advance(DEFAULT_HEARTBEAT_MS - 1);
    expect(beats().length).toBe(1);
    await advance(1);
    expect(beats().length).toBe(2);
    await advance(DEFAULT_HEARTBEAT_MS);
    expect(beats().length).toBe(3);
  });

  test("the default time between heartbeats is twenty seconds", () => {
    expect(DEFAULT_HEARTBEAT_MS).toBe(20_000);
  });

  test("the time between heartbeats can be given", async () => {
    axiosMock.onPost(URL).reply(204);
    renderHook(() =>
      useClientActivity({ heartbeatUrl: URL, defaultIntervalMs: 5000 }),
    );

    await advance(0);
    await advance(4999);
    expect(beats().length).toBe(1);
    await advance(1);
    expect(beats().length).toBe(2);
  });

  test("a response that says others are active shows it, and a later one that says not clears it", async () => {
    axiosMock
      .onPost(URL)
      .replyOnce(204, null, { "x-other-clients-active": "true" })
      .onPost(URL)
      .reply(204, null, { "x-other-clients-active": "false" });
    const { result } = renderHook(() =>
      useClientActivity({ heartbeatUrl: URL }),
    );

    await advance(0);
    expect(result.current.othersActive).toBe(true);
    await advance(DEFAULT_HEARTBEAT_MS);
    expect(result.current.othersActive).toBe(false);
  });

  test("a response that does not mention others leaves what was known", async () => {
    axiosMock
      .onPost(URL)
      .replyOnce(204, null, { "x-other-clients-active": "true" })
      .onPost(URL)
      .reply(204);
    const { result } = renderHook(() =>
      useClientActivity({ heartbeatUrl: URL }),
    );

    await advance(0);
    await advance(DEFAULT_HEARTBEAT_MS);
    expect(beats().length).toBe(2);
    expect(result.current.othersActive).toBe(true);
  });

  test("the server says how often it wants a heartbeat, and it is obeyed", async () => {
    axiosMock.onPost(URL).reply(204, null, { "x-heartbeat-seconds": "2" });
    renderHook(() => useClientActivity({ heartbeatUrl: URL }));

    await advance(0);
    expect(beats().length).toBe(1);
    await advance(1999);
    expect(beats().length).toBe(1);
    await advance(1);
    expect(beats().length).toBe(2);
    await advance(2000);
    expect(beats().length).toBe(3);
  });

  test("a heartbeat interval that is not a positive number is ignored", async () => {
    axiosMock
      .onPost(URL)
      .replyOnce(204, null, { "x-heartbeat-seconds": "soon" })
      .onPost(URL)
      .replyOnce(204, null, { "x-heartbeat-seconds": "0" })
      .onPost(URL)
      .replyOnce(204, null, { "x-heartbeat-seconds": "-5" })
      .onPost(URL)
      .reply(204);
    renderHook(() => useClientActivity({ heartbeatUrl: URL }));

    await advance(0);
    await advance(DEFAULT_HEARTBEAT_MS);
    await advance(DEFAULT_HEARTBEAT_MS);
    await advance(DEFAULT_HEARTBEAT_MS);
    // Four, at the default time apart, however the server's answers read.
    expect(beats().length).toBe(4);
  });

  test("observe takes in the headers of any response, such as a save's", async () => {
    const { result } = renderHook(() =>
      useClientActivity({ heartbeatUrl: null }),
    );

    act(() => {
      result.current.observe({
        "x-other-clients-active": "true",
        "x-heartbeat-seconds": "30",
      });
    });
    expect(result.current.othersActive).toBe(true);

    act(() => {
      result.current.observe({ "x-other-clients-active": "false" });
    });
    expect(result.current.othersActive).toBe(false);

    act(() => {
      result.current.observe(undefined);
    });
    expect(result.current.othersActive).toBe(false);
  });

  test("a heartbeat that fails is tried again at the next time", async () => {
    axiosMock
      .onPost(URL)
      .replyOnce(500)
      .onPost(URL)
      .reply(204, null, { "x-other-clients-active": "true" });
    const { result } = renderHook(() =>
      useClientActivity({ heartbeatUrl: URL }),
    );

    await advance(0);
    expect(beats().length).toBe(1);
    expect(result.current.othersActive).toBe(false);
    await advance(DEFAULT_HEARTBEAT_MS);
    expect(beats().length).toBe(2);
    expect(result.current.othersActive).toBe(true);
  });

  test("stops when the hook goes, and a heartbeat that comes back late is ignored", async () => {
    let finish: () => void = () => {};
    axiosMock.onPost(URL).reply(
      () =>
        new Promise((resolve) => {
          finish = () =>
            resolve([204, null, { "x-other-clients-active": "true" }]);
        }),
    );
    const { result, unmount } = renderHook(() =>
      useClientActivity({ heartbeatUrl: URL }),
    );
    await advance(0);
    expect(beats().length).toBe(1);

    unmount();
    finish();
    await advance(120_000);

    expect(beats().length).toBe(1);
    expect(result.current.othersActive).toBe(false);
  });

  test("a new URL stops the old heartbeat and starts one for the new thing", async () => {
    const OTHER = "/thing/heartbeat?id=2";
    axiosMock.onPost(URL).reply(204);
    axiosMock.onPost(OTHER).reply(204);
    const { rerender } = renderHook(
      ({ url }: { url: string | null }) =>
        useClientActivity({ heartbeatUrl: url }),
      { initialProps: { url: URL as string | null } },
    );
    await advance(0);
    expect(beats().length).toBe(1);

    rerender({ url: OTHER });
    await advance(0);
    await advance(DEFAULT_HEARTBEAT_MS);

    // The first thing is no longer beaten for.
    expect(beats().length).toBe(1);
    expect(axiosMock.history.post.filter((r) => r.url === OTHER).length).toBe(
      2,
    );
  });

  test("an answer to the old URL's heartbeat that comes late says nothing about the new one", async () => {
    const OTHER = "/thing/heartbeat?id=2";
    let finish: () => void = () => {};
    axiosMock.onPost(URL).reply(
      () =>
        new Promise((resolve) => {
          finish = () =>
            resolve([204, null, { "x-other-clients-active": "true" }]);
        }),
    );
    axiosMock
      .onPost(OTHER)
      .reply(204, null, { "x-other-clients-active": "false" });
    const { result, rerender } = renderHook(
      ({ url }: { url: string | null }) =>
        useClientActivity({ heartbeatUrl: url }),
      { initialProps: { url: URL as string | null } },
    );
    await advance(0);
    expect(beats().length).toBe(1);

    rerender({ url: OTHER });
    await advance(0);
    finish();
    await advance(0);

    expect(result.current.othersActive).toBe(false);
  });

  test("goes quiet when the URL is taken away", async () => {
    axiosMock.onPost(URL).reply(204);
    const { rerender } = renderHook(
      ({ url }: { url: string | null }) =>
        useClientActivity({ heartbeatUrl: url }),
      { initialProps: { url: URL as string | null } },
    );
    await advance(0);

    rerender({ url: null });
    await advance(120_000);

    expect(beats().length).toBe(1);
  });
});
