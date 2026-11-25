import { describe, expect, test } from "vitest";
import {
  HIRING_STAFF_ALL_URL,
  HIRING_STAFF_CREATE_PATH,
  HIRING_STAFF_DELETE_URL,
  HIRING_STAFF_LABEL,
  HIRING_STAFF_PATH,
  HIRING_STAFF_POST_URL,
  HIRING_STAFF_ROLE,
  hiringStaffAddedToast,
} from "main/utils/hiringStaff";

describe("hiringStaff constants (issue #504)", () => {
  test("the role name matches the backend's RoleAssignmentService.ROLE_HIRING_STAFF", () => {
    expect(HIRING_STAFF_ROLE).toBe("ROLE_HIRING_STAFF");
  });

  test("the endpoints and pages hang off the admin's hiringStaff paths", () => {
    expect(HIRING_STAFF_LABEL).toBe("Hiring Staff");
    expect(HIRING_STAFF_ALL_URL).toBe("/api/admin/hiringStaff/all");
    expect(HIRING_STAFF_POST_URL).toBe("/api/admin/hiringStaff/post");
    expect(HIRING_STAFF_DELETE_URL).toBe("/api/admin/hiringStaff/delete");
    expect(HIRING_STAFF_PATH).toBe("/admin/hiringStaff");
    expect(HIRING_STAFF_CREATE_PATH).toBe("/admin/hiringStaff/create");
  });

  test("the toast names the email", () => {
    expect(hiringStaffAddedToast("finance@ucsb.edu")).toBe(
      "New hiring staff added - email: finance@ucsb.edu",
    );
  });
});
