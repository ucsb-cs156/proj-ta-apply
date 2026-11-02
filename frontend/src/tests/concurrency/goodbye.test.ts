import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { sendGoodbye } from "main/concurrency/goodbye";

const clearCookie = (name: string) => {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
};

describe("sendGoodbye", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({});
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearCookie("XSRF-TOKEN");
    clearCookie("XSRF-TOKEN-NOT");
    clearCookie("other");
  });

  test("POSTs to the URL with keepalive, naming the client", () => {
    sendGoodbye("/thing/leave?id=3", "tab-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/thing/leave?id=3", {
      method: "POST",
      keepalive: true,
      credentials: "same-origin",
      headers: { "X-Client-Id": "tab-1" },
    });
  });

  test("sends the CSRF token too when the page has one", () => {
    document.cookie = "other=1";
    document.cookie = "XSRF-TOKEN=abc%2F123";

    sendGoodbye("/thing/leave", "tab-1");

    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      "X-Client-Id": "tab-1",
      "X-XSRF-TOKEN": "abc/123",
    });
  });

  test("a cookie whose name only begins the same way is not the token", () => {
    document.cookie = "XSRF-TOKEN-NOT=zzz";

    sendGoodbye("/thing/leave", "tab-1");

    expect(fetchMock.mock.calls[0][1].headers).toStrictEqual({
      "X-Client-Id": "tab-1",
    });
  });

  test("a goodbye that cannot be delivered is of no interest", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    expect(() => sendGoodbye("/thing/leave", "tab-1")).not.toThrow();
    // Were the rejection not handled, the test run would fail for it.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
