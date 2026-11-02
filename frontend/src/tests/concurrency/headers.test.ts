import { describe, expect, test } from "vitest";
import {
  CLIENT_ID_HEADER,
  HEARTBEAT_SECONDS_HEADER,
  OTHER_CLIENTS_ACTIVE_HEADER,
  headerValue,
} from "main/concurrency/headers";

describe("headers", () => {
  test("the names are the ones the server uses", () => {
    expect(CLIENT_ID_HEADER).toBe("X-Client-Id");
    expect(OTHER_CLIENTS_ACTIVE_HEADER).toBe("X-Other-Clients-Active");
    expect(HEARTBEAT_SECONDS_HEADER).toBe("X-Heartbeat-Seconds");
  });
});

describe("headerValue", () => {
  test("finds a header whatever case it came in", () => {
    expect(
      headerValue(
        { "x-other-clients-active": "true" },
        "X-Other-Clients-Active",
      ),
    ).toBe("true");
    expect(
      headerValue(
        { "X-OTHER-CLIENTS-ACTIVE": "false" },
        "x-other-clients-active",
      ),
    ).toBe("false");
  });

  test("turns a number into text", () => {
    expect(
      headerValue({ "x-heartbeat-seconds": 20 }, "X-Heartbeat-Seconds"),
    ).toBe("20");
  });

  test("picks out the one asked for from several", () => {
    expect(
      headerValue(
        { "content-type": "application/json", "x-client-id": "abc" },
        "X-Client-Id",
      ),
    ).toBe("abc");
  });

  test("is undefined when the header is missing, or null, or there are no headers", () => {
    expect(
      headerValue({ "content-type": "text/plain" }, "X-Client-Id"),
    ).toBeUndefined();
    expect(headerValue({ "x-client-id": null }, "X-Client-Id")).toBeUndefined();
    expect(
      headerValue({ "x-client-id": undefined }, "X-Client-Id"),
    ).toBeUndefined();
    expect(headerValue({}, "X-Client-Id")).toBeUndefined();
    expect(headerValue(null, "X-Client-Id")).toBeUndefined();
    expect(headerValue(undefined, "X-Client-Id")).toBeUndefined();
    expect(headerValue("not headers", "X-Client-Id")).toBeUndefined();
  });

  test("an empty value is a value", () => {
    expect(headerValue({ "x-client-id": "" }, "X-Client-Id")).toBe("");
  });
});
