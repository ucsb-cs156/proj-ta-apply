import { describe, expect, test } from "vitest";
import {
  ADMIN_MENU_ENTRIES,
  HELP_PAGES,
  VIDEO_INSTRUCTIONS_TEXT,
  VIDEO_INSTRUCTIONS_URL,
} from "main/utils/helpPages";

describe("helpPages", () => {
  test("the Help menu's pages, in menu order, with who each is for", () => {
    expect(HELP_PAGES).toEqual([
      { path: "/help/about", label: "About TA Apply", audience: "everyone" },
      {
        path: "/help/ta-applicants",
        label: "For TA Applicants",
        audience: "everyone",
      },
      {
        path: "/help/ula-applicants",
        label: "For ULA Applicants",
        audience: "everyone",
      },
      {
        path: "/help/instructors",
        label: "For Instructors",
        audience: "instructor",
      },
      { path: "/help/admins", label: "For Admins", audience: "admin" },
      {
        path: "/help/csv",
        label: "CSV Upload/Download Formats",
        audience: "admin",
      },
    ]);
  });

  test("the video instructions link", () => {
    expect(VIDEO_INSTRUCTIONS_URL).toBe(
      "https://docs.google.com/document/d/10b4MzotCXZCAkR1p5vTgBB_4gHyrw6a0AusVEKfoXdI/edit?tab=t.0#heading=h.khi2ca2p71ii",
    );
    expect(VIDEO_INSTRUCTIONS_TEXT).toBe(
      "Instructions for preparing your video",
    );
  });

  test("every Admin and Developer menu option has an entry with a section", () => {
    expect(ADMIN_MENU_ENTRIES.map((e) => [e.menu, e.label, e.path])).toEqual([
      ["Admin", "Users", "/admin/users"],
      ["Admin", "Admins", "/admin/admins"],
      ["Admin", "Instructors", "/admin/instructors"],
      ["Admin", "Courses", "/admin/courses"],
      ["Home page", "Recruitments", "/"],
      ["Admin", "TA App Settings", "/admin/settings/ta"],
      ["Admin", "ULA App Settings", "/admin/settings/ula"],
      ["Admin", "Legacy TA Application", "/admin/legacy-ta-application"],
      ["Admin", "Audit Trail", "/admin/audittrail"],
      ["Developer", "Jobs", "/admin/jobs"],
      ["Developer", "Developer Info", "/admin/developer"],
    ]);
    expect(ADMIN_MENU_ENTRIES.map((e) => e.section)).toEqual([
      "users",
      "admins",
      "instructors",
      "courses",
      "recruitments",
      "ta-app-settings",
      "ula-app-settings",
      "legacy-ta-application",
      "audit-trail",
      "jobs",
      "developer-info",
    ]);
    ADMIN_MENU_ENTRIES.forEach((entry) => {
      expect(entry.summary.length).toBeGreaterThan(20);
    });
  });
});
