import type { Application } from "main/components/Applications/ApplicationTable";

/** The submission time in the admin's own locale and time zone; blank when it was never stamped. */
export const submittedText = (submittedAt: string | null): string =>
  submittedAt ? new Date(submittedAt).toLocaleString() : "";

/** "20 Applications Received", with the test applications an admin entered counted apart. */
export const receivedText = (applications: Application[]): string => {
  const real = applications.filter((a) => !a.testApplication).length;
  const tests = applications.length - real;
  const base = `${real} ${real === 1 ? "Application" : "Applications"} Received`;
  return tests === 0
    ? base
    : `${base} (plus ${tests} test ${tests === 1 ? "application" : "applications"})`;
};

/** Where Save and Cancel on the admin's view of an application go back to. */
export const applicationsListPath = (recruitmentId: number | string): string =>
  `/admin/recruitments/${recruitmentId}/applications`;
