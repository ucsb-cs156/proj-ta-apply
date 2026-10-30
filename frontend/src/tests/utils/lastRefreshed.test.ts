import { describe, expect, test } from "vitest";
import { lastRefreshedText } from "main/utils/lastRefreshed";

describe("lastRefreshedText", () => {
  test("names the time of the last refresh in the local locale", () => {
    const iso = "2026-02-01T03:00:00";
    expect(lastRefreshedText(iso)).toBe(
      `Last refreshed from the UCSB schedule: ${new Date(iso).toLocaleString()}.`,
    );
  });

  test("says so when there has not been one", () => {
    expect(lastRefreshedText(null)).toBe(
      "Not yet refreshed from the UCSB schedule.",
    );
    expect(lastRefreshedText(undefined)).toBe(
      "Not yet refreshed from the UCSB schedule.",
    );
  });
});
