import { describe, expect, test } from "vitest";
import { lastRefreshedText } from "main/utils/lastRefreshed";

describe("lastRefreshedText", () => {
  test("names the time of the last refresh, as the Pacific time it is stored in", () => {
    const iso = "2026-02-01T03:00:00";
    expect(lastRefreshedText(iso)).toBe(
      `Last refreshed from the UCSB schedule: 2/1/2026, 3:00:00 AM.`,
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
