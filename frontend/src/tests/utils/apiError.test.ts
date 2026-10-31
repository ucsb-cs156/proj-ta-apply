import { describe, expect, test } from "vitest";
import { apiErrorMessage, shouldToastBackendError } from "main/utils/apiError";

describe("apiErrorMessage", () => {
  test("prefers the backend's message", () => {
    expect(
      apiErrorMessage({
        message: "Request failed with status code 400",
        response: { data: { message: "No such enroll code" } },
      }),
    ).toBe("No such enroll code");
  });

  test("falls back to the error's text when there is no message", () => {
    expect(apiErrorMessage(new Error("Network Error"))).toBe(
      "Error: Network Error",
    );
    expect(apiErrorMessage({ response: { data: { message: "" } } })).toBe(
      "[object Object]",
    );
    expect(apiErrorMessage({ response: { data: { message: 42 } } })).toBe(
      "[object Object]",
    );
    expect(apiErrorMessage({ response: {} })).toBe("[object Object]");
    expect(apiErrorMessage(null)).toBe("null");
  });
});

describe("shouldToastBackendError (issue #198)", () => {
  test("a failure the backend answered is worth a toast", () => {
    expect(shouldToastBackendError({ response: { status: 400 } })).toBe(true);
    expect(shouldToastBackendError({ response: { status: 404 } })).toBe(true);
    expect(shouldToastBackendError({ response: { status: 500 } })).toBe(true);
    expect(shouldToastBackendError({ response: { status: 502 } })).toBe(true);
    // A response without a status is still a response.
    expect(shouldToastBackendError({ response: {} })).toBe(true);
  });

  test("a lost session is not", () => {
    expect(shouldToastBackendError({ response: { status: 401 } })).toBe(false);
    expect(shouldToastBackendError({ response: { status: 403 } })).toBe(false);
  });

  test("an unreachable server is not", () => {
    expect(shouldToastBackendError(new Error("Network Error"))).toBe(false);
    expect(shouldToastBackendError({ response: null })).toBe(false);
    expect(shouldToastBackendError({ response: undefined })).toBe(false);
    expect(shouldToastBackendError({})).toBe(false);
    expect(shouldToastBackendError(null)).toBe(false);
    expect(shouldToastBackendError(undefined)).toBe(false);
    expect(shouldToastBackendError("boom")).toBe(false);
  });
});
