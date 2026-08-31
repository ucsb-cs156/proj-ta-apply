import type { AxiosRequestConfig } from "axios";

/** Shape of the response from the role email CSV upload endpoints. */
export type UploadResult = {
  inserted: number;
  alreadyPresent: number;
  invalid: number;
  invalidEmails: string[];
};

/** Builds the multipart POST for a CSV upload to the given endpoint. */
export function csvUploadAxiosParams(
  url: string,
  file: File,
): AxiosRequestConfig {
  const formData = new FormData();
  formData.append("file", file);
  return {
    url,
    method: "POST",
    data: formData,
    headers: { "Content-Type": "multipart/form-data" },
  };
}

/**
 * The toast an admin sees after an upload. Shared so the grad students and instructors pages
 * report results in the same words.
 */
export function uploadResultMessage(result: UploadResult): string {
  let message = `Upload complete: ${result.inserted} added, ${result.alreadyPresent} already present, ${result.invalid} invalid`;
  if (result.invalidEmails?.length > 0) {
    message += ` (${result.invalidEmails.join(", ")})`;
  }
  return message;
}
