import { describe, expect, test } from "vitest";
import { CLIENT_ID_HEADER } from "main/concurrency/headers";

describe("headers", () => {
  test("the name is the one the server uses", () => {
    expect(CLIENT_ID_HEADER).toBe("X-Client-Id");
  });
});
