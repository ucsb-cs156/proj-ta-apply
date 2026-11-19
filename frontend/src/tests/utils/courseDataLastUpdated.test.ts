import { describe, expect, test } from "vitest";
import {
  courseDataLastUpdatedText,
  NIGHTLY_REFRESH_NOTE,
  REFRESH_STARTED_MESSAGE,
} from "main/utils/courseDataLastUpdated";

describe("courseDataLastUpdatedText", () => {
  test("names the time of the last update, as the Pacific time it is stored in", () => {
    const iso = "2026-02-01T03:00:00";
    expect(courseDataLastUpdatedText(iso)).toBe(
      `Course data last updated from the UCSB API: 2/1/2026, 3:00:00 AM.`,
    );
  });

  test("says so when there has not been one", () => {
    expect(courseDataLastUpdatedText(null)).toBe(
      "Course data not yet updated from the UCSB API.",
    );
    expect(courseDataLastUpdatedText(undefined)).toBe(
      "Course data not yet updated from the UCSB API.",
    );
  });

  test("the note and the toast say what the page says", () => {
    expect(NIGHTLY_REFRESH_NOTE).toBe(
      "Updated automatically every night at midnight.",
    );
    expect(REFRESH_STARTED_MESSAGE).toBe(
      "Refresh started. Watch its progress on the Developer > Jobs page; the time above the table changes when it finishes.",
    );
  });
});
