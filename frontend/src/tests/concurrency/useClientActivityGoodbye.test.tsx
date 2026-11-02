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
const LEAVE = "/thing/leave?id=1";
const PHILL = { label: "phtcon@ucsb.edu (Phill Conrad)", samePerson: false };

const beats = () => axiosMock.history.post.filter((r) => r.url === URL);

/** Lets the heartbeat in flight finish, and then the time given pass. */
const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const pageshow = (persisted: boolean) =>
  window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted }));

describe("useClientActivity: who arrived last (issue #284)", () => {
  beforeEach(() => {
    axiosMock.reset();
    axiosMock.resetHistory();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("is not the newest, and has no arrival, until the server says", () => {
    const { result } = renderHook(() =>
      useClientActivity({ heartbeatUrl: null }),
    );
    expect(result.current.newest).toBe(false);
    expect(result.current.arrivedAt).toBe(0);
  });

  test("takes both from each answer, which replaces the last", async () => {
    axiosMock
      .onPost(URL)
      .replyOnce(200, { others: [PHILL], newest: true, arrivedAtMillis: 123 })
      .onPost(URL)
      .reply(200, { others: [PHILL], newest: false, arrivedAtMillis: 456 });
    const { result } = renderHook(() =>
      useClientActivity({ heartbeatUrl: URL }),
    );

    await advance(0);
    expect(result.current.newest).toBe(true);
    expect(result.current.arrivedAt).toBe(123);
    await advance(DEFAULT_HEARTBEAT_MS);
    expect(result.current.newest).toBe(false);
    expect(result.current.arrivedAt).toBe(456);
  });
});

describe("useClientActivity: goodbye (issue #284)", () => {
  const fetchMock = vi.fn();
  const goodbyes = () => fetchMock.mock.calls.filter((c) => c[0] === LEAVE);

  beforeEach(() => {
    axiosMock.reset();
    axiosMock.resetHistory();
    vi.useFakeTimers();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({});
    vi.stubGlobal("fetch", fetchMock);
    axiosMock.onPost(URL).reply(200, { others: [] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test("pagehide sends one goodbye, naming the tab, with keepalive", async () => {
    const { result } = renderHook(() =>
      useClientActivity({ heartbeatUrl: URL, leaveUrl: LEAVE }),
    );
    await advance(0);
    expect(goodbyes().length).toBe(0);

    window.dispatchEvent(new Event("pagehide"));

    expect(goodbyes().length).toBe(1);
    const [url, init] = goodbyes()[0];
    expect(url).toBe(LEAVE);
    expect(init.method).toBe("POST");
    expect(init.keepalive).toBe(true);
    expect(init.headers["X-Client-Id"]).toBe(result.current.clientId);
  });

  test("heartbeats stop after pagehide, even one that was still on its way", async () => {
    let finish: () => void = () => {};
    axiosMock.reset();
    axiosMock.onPost(URL).reply(
      () =>
        new Promise((resolve) => {
          finish = () => resolve([200, { others: [] }]);
        }),
    );
    renderHook(() => useClientActivity({ heartbeatUrl: URL, leaveUrl: LEAVE }));
    await advance(0);
    expect(beats().length).toBe(1);

    window.dispatchEvent(new Event("pagehide"));
    finish();
    await advance(60_000);

    expect(beats().length).toBe(1);
  });

  test("pagehide with a heartbeat waiting to be sent stops it", async () => {
    renderHook(() => useClientActivity({ heartbeatUrl: URL, leaveUrl: LEAVE }));
    await advance(0);
    expect(beats().length).toBe(1);

    window.dispatchEvent(new Event("pagehide"));
    await advance(60_000);

    expect(beats().length).toBe(1);
  });

  test("with nowhere to say goodbye, pagehide sends nothing but heartbeats still stop", async () => {
    renderHook(() => useClientActivity({ heartbeatUrl: URL }));
    await advance(0);

    window.dispatchEvent(new Event("pagehide"));
    await advance(60_000);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(beats().length).toBe(1);
  });

  test("a page restored from the cache announces itself at once and goes on beating", async () => {
    renderHook(() => useClientActivity({ heartbeatUrl: URL, leaveUrl: LEAVE }));
    await advance(0);
    window.dispatchEvent(new Event("pagehide"));
    await advance(60_000);
    expect(beats().length).toBe(1);

    pageshow(true);
    await advance(0);
    expect(beats().length).toBe(2);

    await advance(DEFAULT_HEARTBEAT_MS);
    expect(beats().length).toBe(3);
  });

  test("a page shown for the first time, not restored, does nothing more", async () => {
    renderHook(() => useClientActivity({ heartbeatUrl: URL, leaveUrl: LEAVE }));
    await advance(0);
    expect(beats().length).toBe(1);

    pageshow(false);
    await advance(0);

    expect(beats().length).toBe(1);
  });

  test("leaving the hook, as moving to another page of the app does, sends the goodbye", async () => {
    const { result, unmount } = renderHook(() =>
      useClientActivity({ heartbeatUrl: URL, leaveUrl: LEAVE }),
    );
    await advance(0);

    unmount();

    expect(goodbyes().length).toBe(1);
    expect(goodbyes()[0][1].headers["X-Client-Id"]).toBe(
      result.current.clientId,
    );
  });

  test("no goodbye from a hook with no URL, or with nowhere to send it", async () => {
    const first = renderHook(() =>
      useClientActivity({ heartbeatUrl: null, leaveUrl: LEAVE }),
    );
    window.dispatchEvent(new Event("pagehide"));
    first.unmount();
    const second = renderHook(() => useClientActivity({ heartbeatUrl: URL }));
    await advance(0);
    second.unmount();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("once the hook has gone, pagehide and pageshow no longer reach it", async () => {
    const { unmount } = renderHook(() =>
      useClientActivity({ heartbeatUrl: URL, leaveUrl: LEAVE }),
    );
    await advance(0);
    unmount();
    expect(goodbyes().length).toBe(1);

    window.dispatchEvent(new Event("pagehide"));
    pageshow(true);
    await advance(0);

    expect(goodbyes().length).toBe(1);
    expect(beats().length).toBe(1);
  });

  test("a new place to say goodbye is used from then on, and the old one is told", async () => {
    const OTHER_LEAVE = "/thing/leave?id=2";
    const { result, rerender } = renderHook(
      ({ leaveUrl }: { leaveUrl: string }) =>
        useClientActivity({ heartbeatUrl: URL, leaveUrl }),
      { initialProps: { leaveUrl: LEAVE } },
    );
    await advance(0);

    rerender({ leaveUrl: OTHER_LEAVE });
    await advance(0);
    expect(goodbyes().length).toBe(1);

    act(() => result.current.leave());
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(OTHER_LEAVE);
  });

  test("leave() says goodbye now, naming the tab", async () => {
    const { result } = renderHook(() =>
      useClientActivity({ heartbeatUrl: URL, leaveUrl: LEAVE }),
    );
    await advance(0);

    act(() => result.current.leave());

    expect(goodbyes().length).toBe(1);
    expect(goodbyes()[0][1].headers["X-Client-Id"]).toBe(
      result.current.clientId,
    );
  });

  test("leave() with nowhere to say it does nothing", () => {
    const { result } = renderHook(() =>
      useClientActivity({ heartbeatUrl: URL }),
    );
    act(() => result.current.leave());
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
