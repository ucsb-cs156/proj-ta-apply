/**
 * The labels for the coded answers on an application, shared by the admin's read-only view and
 * the applications table (issues #109 and #189).
 */

export const RESIDENCY_LABELS: Record<string, string> = {
  US_CITIZEN: "US Citizen",
  US_RESIDENT: "US Permanent Resident",
  F1_STUDENT_VISA: "F1 Student Visa",
  J1_STUDENT_VISA: "J1 Student Visa",
  OTHER: "Other",
};

export const LANGUAGE_EXAM_LABELS: Record<string, string> = {
  EXEMPT_US_CITIZEN: "exempt (U.S. Citizen)",
  PASSED_US_PERMANENT_RESIDENT: "passed (U.S. Perm. Resident)",
  PASSED_F1_OR_J1_VISA: "passed (F1 or J1 visa)",
  NOT_PASSED: "not passed",
};

export const CLASS_LEVEL_LABELS: Record<string, string> = {
  PHD: "PhD",
  MS: "MS",
};
