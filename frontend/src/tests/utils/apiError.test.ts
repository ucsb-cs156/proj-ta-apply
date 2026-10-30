import { describe, expect, test } from "vitest";
import { apiErrorMessage } from "main/utils/apiError";

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
