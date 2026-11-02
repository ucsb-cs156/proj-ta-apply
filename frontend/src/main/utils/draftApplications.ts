import type { Application } from "main/components/Applications/ApplicationTable";

/**
 * The answers on an application, each of which may be missing: all a form needs to start from,
 * whether the application was submitted or is a draft.
 */
export type ApplicationAnswers = {
  [K in keyof Application]?: Application[K] | null;
};

/**
 * An application as it is being filled in (issue #270). The answers have the same names and types
 * as a submitted application's, but any of them may be missing, and it carries none of what only a
 * submitted application has (status, admin comments, origin and so on).
 */
export type DraftApplication = ApplicationAnswers & {
  id: number;
  recruitmentId: number;
  email: string;
  /** When it was last saved, as an ISO date-time. */
  updatedAt: string | null;
  /** How many times it has been saved; a save carries the one it last saw (see useDraftSaving). */
  version: number;
};

/** The warning under "Continue editing draft application" on the home page. */
export const DRAFT_WARNING =
  "Your application is not yet complete; incomplete applications are not considered.";

/** The student's draft for one recruitment, if any. */
export const draftFor = (
  drafts: DraftApplication[],
  recruitmentId: number,
): DraftApplication | undefined =>
  drafts.find((d) => d.recruitmentId === recruitmentId);

/**
 * Whether the form has ever saved this draft. The form saves everything it shows, so a saved draft
 * always has a first name (an empty one at the least), whereas the empty draft made when the form
 * is first opened has none. The apply page uses this to offer the answers from the student's
 * earlier application only while the draft has nothing of its own.
 */
export const draftWasSaved = (draft: DraftApplication): boolean =>
  draft.firstName !== null && draft.firstName !== undefined;
