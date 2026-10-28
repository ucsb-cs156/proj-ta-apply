/** What the App Settings CSV upload endpoint reports back. */
export type NameListUploadResult = { inserted: number; alreadyPresent: number };

/** The toast after an upload, in the same words as the email uploads use. */
export const uploadSummary = (result: NameListUploadResult): string =>
  `Upload complete: ${result.inserted} added, ${result.alreadyPresent} already present`;

/** Where the Help page documents the CSV shape the settings lists use. */
export const CSV_HELP_PATH = "/help/csv#settings-lists";

/** The download URL for one list; a plain link, so the browser saves the file itself. */
export const csvDownloadUrl = (listKey: string): string =>
  `/api/admin/settings/${listKey}/csv`;

/** The upload URL for one list. */
export const csvUploadUrl = (listKey: string): string =>
  `/api/admin/settings/${listKey}/upload/csv`;
