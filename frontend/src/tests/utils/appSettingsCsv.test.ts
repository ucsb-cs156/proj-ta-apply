import { describe, test, expect } from "vitest";
import {
  CSV_HELP_PATH,
  csvDownloadUrl,
  csvUploadUrl,
  uploadSummary,
} from "main/utils/appSettingsCsv";

describe("appSettingsCsv", () => {
  test("the upload summary reads like the email uploads' toast", () => {
    expect(uploadSummary({ inserted: 3, alreadyPresent: 1 })).toBe(
      "Upload complete: 3 added, 1 already present",
    );
    expect(uploadSummary({ inserted: 0, alreadyPresent: 0 })).toBe(
      "Upload complete: 0 added, 0 already present",
    );
  });

  test("the urls are keyed by list", () => {
    expect(csvDownloadUrl("ta-majors")).toBe(
      "/api/admin/settings/ta-majors/csv",
    );
    expect(csvUploadUrl("ula-topics")).toBe(
      "/api/admin/settings/ula-topics/upload/csv",
    );
  });

  test("the help link points at the settings section of the CSV help page", () => {
    expect(CSV_HELP_PATH).toBe("/help/csv#settings-lists");
  });
});
