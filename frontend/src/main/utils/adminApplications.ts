import { formatPacificDateTime } from "main/utils/pacificTime";
import type {
  Application,
  ApplicationOrigin,
} from "main/components/Applications/ApplicationTable";

/** The submission time in Pacific time; blank when it was never stamped. */
export const submittedText = (submittedAt: string | null | undefined): string =>
  formatPacificDateTime(submittedAt);

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

/**
 * The admin's read-only view of one application, or of one draft (issue #296): the same page,
 * whichever it is shown for.
 */
export const adminApplicationPath = (
  id: number | string,
  draft = false,
): string =>
  draft ? `/admin/draft-applications/${id}` : `/admin/applications/${id}`;

/** The admin's edit form for one application. */
export const adminApplicationEditPath = (id: number | string): string =>
  `/admin/applications/${id}/edit`;

/** Where Save and Cancel on the admin's view of an application or draft go back to. */
export const applicationsListPath = (
  recruitmentId: number | string,
  draft = false,
): string =>
  draft
    ? `/admin/recruitments/${recruitmentId}/draft-applications`
    : `/admin/recruitments/${recruitmentId}/applications`;

/**
 * Where an admin reads one application or draft, and saves their comments on it (issue #296). The
 * two kinds are served by the same page and table; this is all that differs between them.
 */
export const adminApplicationUrls = (
  draft: boolean,
): { one: string; all: string; comments: string } => {
  const base = draft
    ? "/api/admin/draftApplications"
    : "/api/admin/applications";
  return { one: base, all: `${base}/all`, comments: `${base}/adminComments` };
};

/** "3 Draft Applications" or "1 Draft Application", for the top of the drafts page. */
export const draftsText = (count: number): string =>
  `${count} Draft ${count === 1 ? "Application" : "Applications"}`;

/**
 * Issue #411: the toast after the drafts page's "Copy emails of draft applicants to clipboard"
 * button has done its work: "Emails of 3 draft applicants copied to clipboard." (or "Email of 1
 * draft applicant").
 */
export const draftEmailsCopiedText = (count: number): string =>
  count === 1
    ? "Email of 1 draft applicant copied to clipboard."
    : `Emails of ${count} draft applicants copied to clipboard.`;

/**
 * Issue #411: the tooltip over that button, which says what the emails are for. The recruitment's
 * primary consideration date (as the backend sends it, yyyy-mm-dd, the same way the recruitment's
 * row shows it) is the deadline it names; when the recruitment has none, or is not known yet, the
 * sentence names "the primary consideration date" instead.
 */
export const draftEmailsTooltip = (
  primaryConsiderationDate: string | null | undefined,
): string =>
  "A day or two before closing the applications, you may want to email all " +
  "of the students that have submitted draft applications to let them know " +
  "that they will need to login and finalize their application before " +
  `${primaryConsiderationDate ?? "the primary consideration date"} if they ` +
  "want their application to be reviewed. Let them know that draft " +
  "applications are not considered; only applications that have been " +
  "submitted.";
