/**
 * The one copy of the reconstruction lives in docs/legacy so it can be read on GitHub too. The
 * backend packages that directory as the static path /legacy (see pom.xml), the Vite dev server
 * proxies /legacy to the backend, and Storybook serves it from staticDirs.
 */
export const LEGACY_FORM_URL = "/legacy/legacy-ta-application-form.html";

export const LEGACY_BANNER_TEXT =
  "This page is not functional. It preserves the user interface of the old TA" +
  " application so that it can be compared with the new application. Data entered" +
  " on this page is not stored anywhere. This is for documentation purposes only.";

/** Grows the frame to fit its document, so the page scrolls as one instead of in a box. */
export function fitFrameToContent(frame: HTMLIFrameElement): void {
  const height = frame.contentDocument?.documentElement.scrollHeight;
  if (height) {
    frame.style.height = `${height + 16}px`;
  }
}
