import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  FROM_CANCELLED_URL,
  toastServerMessage,
} from "main/utils/useCreateFromCancelled";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  toast: (x: unknown) => mockToast(x),
}));

describe("useCreateFromCancelled", () => {
  beforeEach(() => {
    mockToast.mockClear();
  });

  test("asks the drafts endpoint (issue #420)", () => {
    expect(FROM_CANCELLED_URL).toBe("/api/draftApplications/fromCancelled");
  });

  test("a refusal is toasted in the server's own words", () => {
    toastServerMessage({
      response: { status: 400, data: { message: "Applications are closed" } },
    });
    expect(mockToast).toHaveBeenCalledWith("Applications are closed");
  });

  test("a lost session or unreachable server is only logged", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    toastServerMessage({ response: { status: 403 } });
    toastServerMessage(new Error("network down"));
    expect(mockToast).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });
});
