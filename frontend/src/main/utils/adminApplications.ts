import type {
  Application,
  ApplicationOrigin,
} from "main/components/Applications/ApplicationTable";

/** The submission time in the admin's own locale and time zone; blank when it was never stamped. */
export const submittedText = (submittedAt: string | null): string =>
  submittedAt ? new Date(submittedAt).toLocaleString() : "";

/**
 * "20 Applications Received", with the test applications an admin entered and the fake ones Developer
 * Mode generated counted apart.
 */
export const receivedText = (applications: Application[]): string => {
  const real = applications.filter((a) => a.origin === "APPLICANT").length;
  const tests = applications.filter((a) => a.origin === "ADMIN_TEST").length;
  const fakes = applications.length - real - tests;
  const plural = (n: number, word: string) =>
    `${n} ${word} ${n === 1 ? "application" : "applications"}`;
  const base = `${real} ${real === 1 ? "Application" : "Applications"} Received`;
  const extras = [
    ...(tests > 0 ? [plural(tests, "test")] : []),
    ...(fakes > 0 ? [plural(fakes, "fake")] : []),
  ];
  return extras.length === 0 ? base : `${base} (plus ${extras.join(" and ")})`;
};

/** The long name of where an application came from; blank for a real applicant's own. */
export const originLabel = (origin: ApplicationOrigin): string => {
  switch (origin) {
    case "ADMIN_TEST":
      return "Test application (admin)";
    case "DEVELOPER_MODE":
      return "Fake application (developer mode)";
    default:
      return "";
  }
};

/** "15 applications" or "1 application", for a recruitment card's header (issue #108). */
export const applicationsText = (count: number): string =>
  `${count} ${count === 1 ? "application" : "applications"}`;

/** The admin's read-only view of one application. */
export const adminApplicationPath = (id: number | string): string =>
  `/admin/applications/${id}`;

/** The admin's edit form for one application. */
export const adminApplicationEditPath = (id: number | string): string =>
  `/admin/applications/${id}/edit`;

/** Where Save and Cancel on the admin's view of an application go back to. */
export const applicationsListPath = (recruitmentId: number | string): string =>
  `/admin/recruitments/${recruitmentId}/applications`;
