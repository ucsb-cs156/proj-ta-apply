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
const PHILL = { label: "phtcon@ucsb.edu (Phill Conrad)", samePerson: false };
const ME = { label: "me@example.org (Me)", samePerson: true };

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

  test("a given identifier is used instead of a new one, so two hooks can be one tab (issue #358)", async () => {
    const OTHER_URL = "/thing/heartbeat?id=2";
    axiosMock.onPost(URL).reply(200, { others: [] });
    axiosMock.onPost(OTHER_URL).reply(200, { others: [] });
    const first = renderHook(() => useClientActivity({ heartbeatUrl: URL }));
    const id = first.result.current.clientId;
    const second = renderHook(() =>
      useClientActivity({ heartbeatUrl: OTHER_URL, clientId: id }),
    );

    expect(second.result.current.clientId).toBe(id);
    expect(second.result.current.headers).toEqual({ "X-Client-Id": id });
    await advance(0);
    const otherBeats = axiosMock.history.post.filter(
      (r) => r.url === OTHER_URL,
    );
    expect(otherBeats).toHaveLength(1);
    expect(otherBeats[0].headers?.["X-Client-Id"]).toBe(id);
    expect(beats()[0].headers?.["X-Client-Id"]).toBe(id);
  });

  test("keeps the identifier out of storage, so a restored tab does not inherit one", () => {
    const local = vi.spyOn(Storage.prototype, "setItem");
    renderHook(() => useClientActivity({ heartbeatUrl: null }));
    expect(local).not.toHaveBeenCalled();
    local.mockRestore();
  });

  test("no one else is there to begin with, and nothing is sent without a URL", async () => {
    const { result } = renderHook(() =>
      useClientActivity({ heartbeatUrl: null }),
    );
    await advance(120_000);
    expect(result.current.others).toEqual([]);
    expect(axiosMock.history.post.length).toBe(0);
  });

  test("sends a heartbeat at once, naming itself, and then every 5 seconds", async () => {
    axiosMock.onPost(URL).reply(200, { others: [] });
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

  test("the default time between heartbeats is five seconds", () => {
    expect(DEFAULT_HEARTBEAT_MS).toBe(5_000);
  });

  test("the time between heartbeats can be given", async () => {
    axiosMock.onPost(URL).reply(200, { others: [] });
    renderHook(() =>
      useClientActivity({ heartbeatUrl: URL, defaultIntervalMs: 5000 }),
    );

    await advance(0);
    await advance(4999);
    expect(beats().length).toBe(1);
    await advance(1);
    expect(beats().length).toBe(2);
  });

  test("the others an answer lists are shown, with who they are", async () => {
    axiosMock.onPost(URL).reply(200, { others: [ME, PHILL] });
    const { result } = renderHook(() =>
      useClientActivity({ heartbeatUrl: URL }),
    );

    await advance(0);
    expect(result.current.others).toEqual([ME, PHILL]);
  });

  test("each answer replaces the last, so the names go when the others have", async () => {
    axiosMock
      .onPost(URL)
      .replyOnce(200, { others: [ME, PHILL] })
      .onPost(URL)
      .replyOnce(200, { others: [PHILL] })
      .onPost(URL)
      .reply(200, { others: [] });
    const { result } = renderHook(() =>
      useClientActivity({ heartbeatUrl: URL }),
    );

    await advance(0);
    expect(result.current.others).toEqual([ME, PHILL]);
    await advance(DEFAULT_HEARTBEAT_MS);
    expect(result.current.others).toEqual([PHILL]);
    await advance(DEFAULT_HEARTBEAT_MS);
    expect(result.current.others).toEqual([]);
  });

  test("an answer that is not what was expected is no one", async () => {
    axiosMock.onPost(URL).reply(200, "<html>not json</html>");
    const { result } = renderHook(() =>
      useClientActivity({ heartbeatUrl: URL }),
    );

    await advance(0);
    expect(beats().length).toBe(1);
    expect(result.current.others).toEqual([]);
  });

  test("the server says how often it wants a heartbeat, and it is obeyed", async () => {
    axiosMock.onPost(URL).reply(200, { others: [], heartbeatSeconds: 2 });
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
      .replyOnce(200, { others: [], heartbeatSeconds: "soon" })
      .onPost(URL)
      .replyOnce(200, { others: [], heartbeatSeconds: 0 })
      .onPost(URL)
      .replyOnce(200, { others: [], heartbeatSeconds: -5 })
      .onPost(URL)
      .reply(200, { others: [] });
    renderHook(() => useClientActivity({ heartbeatUrl: URL }));

    await advance(0);
    await advance(DEFAULT_HEARTBEAT_MS);
    await advance(DEFAULT_HEARTBEAT_MS);
    await advance(DEFAULT_HEARTBEAT_MS);
    // Four, at the default time apart, however the server's answers read.
    expect(beats().length).toBe(4);
  });

  test("an answer with no interval leaves the one in use", async () => {
    axiosMock
      .onPost(URL)
      .replyOnce(200, { others: [], heartbeatSeconds: 2 })
      .onPost(URL)
      .reply(200, { others: [] });
    renderHook(() => useClientActivity({ heartbeatUrl: URL }));

    await advance(0);
    await advance(2000);
    expect(beats().length).toBe(2);
    // The second answer named none, so the 2 seconds go on.
    await advance(2000);
    expect(beats().length).toBe(3);
  });

  test("a heartbeat that fails is tried again at the next time, and leaves the names as they were", async () => {
    axiosMock
      .onPost(URL)
      .replyOnce(200, { others: [PHILL] })
      .onPost(URL)
      .replyOnce(500)
      .onPost(URL)
      .reply(200, { others: [] });
    const { result } = renderHook(() =>
      useClientActivity({ heartbeatUrl: URL }),
    );

    await advance(0);
    expect(result.current.others).toEqual([PHILL]);
    await advance(DEFAULT_HEARTBEAT_MS);
    expect(beats().length).toBe(2);
    // Missed, so what was last said stands.
    expect(result.current.others).toEqual([PHILL]);
    await advance(DEFAULT_HEARTBEAT_MS);
    expect(beats().length).toBe(3);
    expect(result.current.others).toEqual([]);
  });

  test("a heartbeat the server refuses is not shown and does not stop the next", async () => {
    axiosMock
      .onPost(URL)
      .replyOnce(403, { message: "No" })
      .onPost(URL)
      .reply(200, { others: [PHILL] });
    const { result } = renderHook(() =>
      useClientActivity({ heartbeatUrl: URL }),
    );

    await advance(0);
    expect(result.current.others).toEqual([]);
    await advance(DEFAULT_HEARTBEAT_MS);
    expect(result.current.others).toEqual([PHILL]);
  });

  test("stops when the hook goes, and a heartbeat that comes back late is ignored", async () => {
    let finish: () => void = () => {};
    axiosMock.onPost(URL).reply(
      () =>
        new Promise((resolve) => {
          finish = () => resolve([200, { others: [PHILL] }]);
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
    expect(result.current.others).toEqual([]);
  });

  test("a new URL stops the old heartbeat and starts one for the new thing", async () => {
    const OTHER = "/thing/heartbeat?id=2";
    axiosMock.onPost(URL).reply(200, { others: [] });
    axiosMock.onPost(OTHER).reply(200, { others: [] });
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
          finish = () => resolve([200, { others: [PHILL] }]);
        }),
    );
    axiosMock.onPost(OTHER).reply(200, { others: [] });
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

    expect(result.current.others).toEqual([]);
  });

  test("goes quiet when the URL is taken away", async () => {
    axiosMock.onPost(URL).reply(200, { others: [] });
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
