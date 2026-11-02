import { describe, expect, test } from "vitest";
import { isConflict } from "main/utils/useDraftSaving";

describe("isConflict", () => {
  test("is true only for a 409 response", () => {
    expect(isConflict({ response: { status: 409 } })).toBe(true);
    expect(isConflict({ response: { status: 400 } })).toBe(false);
    expect(isConflict({ response: { status: 500 } })).toBe(false);
  });

  test("is false for an error with no response, and for nothing at all", () => {
    expect(isConflict(new Error("network down"))).toBe(false);
    expect(isConflict({ response: undefined })).toBe(false);
    expect(isConflict(null)).toBe(false);
    expect(isConflict(undefined)).toBe(false);
  });
});
