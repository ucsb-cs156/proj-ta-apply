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

/** The class on the element the legacy form is rendered into; its stylesheet is scoped to it. */
export const LEGACY_SCOPE_CLASS = "legacy-form";

/** The class the legacy stylesheet uses to hide the reconstruction notes and field names. */
export const LEGACY_HIDE_NOTES_CLASS = "hidefn";

/** The id of the checkbox in the legacy form that shows and hides those notes. */
export const LEGACY_NOTES_TOGGLE_ID = "shownotes";

export type LegacyForm = {
  /** The form's stylesheet, rewritten to apply only inside the scope element. */
  css: string;
  /** The form's body markup, with its scripts removed. */
  body: string;
};

/**
 * Scopes the legacy document's stylesheet to the element it is rendered into.
 *
 * <p>The document styles `body` and `:root`, which inside this app would restyle the whole page.
 * Wrapping the sheet in a CSS nesting block for the scope class makes every rule a descendant
 * rule, and the three selectors that named the document itself are pointed at the scope element
 * instead: `:root` and `body` become `&`, and the `.hidefn` the document toggled on its body
 * becomes `&.hidefn`.
 */
export function scopeLegacyCss(css: string): string {
  const scoped = css
    .replace(/:root/g, "&")
    .replace(/(^|[\s};])body(?=[\s{.,:#[])/g, "$1&")
    .replace(
      new RegExp(`\\.${LEGACY_HIDE_NOTES_CLASS} `, "g"),
      `&.${LEGACY_HIDE_NOTES_CLASS} `,
    );
  return `.${LEGACY_SCOPE_CLASS}{\n${scoped}\n}`;
}

/**
 * Pulls the parts of the legacy HTML document that can be rendered inside this app: the body
 * markup, without its script (the notes toggle is handled by the page instead), and the stylesheet,
 * scoped so it cannot leak out. An empty string gives an empty body, which the page shows as still
 * loading.
 */
export function extractLegacyForm(html: string): LegacyForm {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const css = Array.from(doc.querySelectorAll("style"))
    .map((style) => style.textContent)
    .join("\n");
  doc.querySelectorAll("script").forEach((script) => script.remove());
  return { css: scopeLegacyCss(css), body: doc.body.innerHTML };
}
