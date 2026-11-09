import { toast } from "react-toastify";

/** The toast after an email has been copied. */
export const EMAIL_COPIED = "Email copied to clipboard.";

/** The toast when the browser refuses to copy. */
export const CLIPBOARD_FAILED =
  "Unable to copy to clipboard. Check your browser clipboard permissions.";

/**
 * Copies the text to the clipboard and says so in a toast, or says that the browser refused
 * (issue #427; the same messages as the Recruitment Courses and Combined Allocation pages).
 */
export async function copyToClipboard(
  text: string,
  successMessage: string,
): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast(successMessage);
  } catch {
    toast(CLIPBOARD_FAILED);
  }
}
