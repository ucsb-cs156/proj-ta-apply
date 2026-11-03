import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  applicationHeartbeatUrl,
  applicationLeaveUrl,
  toastUnlessConflict,
} from "main/utils/applicationEditing";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  toast: (x: unknown) => mockToast(x),
}));

describe("applicationEditing", () => {
  beforeEach(() => {
    mockToast.mockClear();
  });

  test("the applicant's page and the admin's page share two endpoints", () => {
    expect(applicationHeartbeatUrl(7)).toBe("/api/applications/heartbeat?id=7");
    expect(applicationLeaveUrl("8")).toBe("/api/applications/leave?id=8");
  });

  test("a refused stale save is not toasted: the page shows it", () => {
    toastUnlessConflict({ response: { status: 409 } });
    expect(mockToast).not.toHaveBeenCalled();
  });

  test("any other failure is toasted", () => {
    toastUnlessConflict({
      response: { status: 500 },
      toString: () => "Error 500",
    });
    expect(mockToast).toHaveBeenCalledWith("Error 500");
  });

  test("a lost session or unreachable server is only logged", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    toastUnlessConflict({ response: { status: 403 } });
    toastUnlessConflict(new Error("network down"));
    expect(mockToast).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });
});
