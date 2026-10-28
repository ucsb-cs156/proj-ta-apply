import { describe, test, expect } from "vitest";
import {
  LEGACY_FORM_URL,
  LEGACY_HIDE_NOTES_CLASS,
  LEGACY_NOTES_TOGGLE_ID,
  LEGACY_SCOPE_CLASS,
  extractLegacyForm,
  scopeLegacyCss,
} from "main/utils/legacyForm";

describe("legacyForm utils", () => {
  test("the constants match the served file and the legacy markup", () => {
    expect(LEGACY_FORM_URL).toBe("/legacy/legacy-ta-application-form.html");
    expect(LEGACY_SCOPE_CLASS).toBe("legacy-form");
    expect(LEGACY_HIDE_NOTES_CLASS).toBe("hidefn");
    expect(LEGACY_NOTES_TOGGLE_ID).toBe("shownotes");
  });

  describe("scopeLegacyCss", () => {
    test("wraps the sheet in a nesting block for the scope class", () => {
      expect(scopeLegacyCss("table{width:100%}")).toBe(
        ".legacy-form{\ntable{width:100%}\n}",
      );
    });

    test("points :root at the scope element, including the dark-mode variants", () => {
      const css =
        ":root{--ink:#000}\n" +
        '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--ink:#fff}}\n' +
        ':root[data-theme="dark"]{--ink:#fff}';
      expect(scopeLegacyCss(css)).toBe(
        ".legacy-form{\n" +
          "&{--ink:#000}\n" +
          '@media (prefers-color-scheme: dark){&:not([data-theme="light"]){--ink:#fff}}\n' +
          '&[data-theme="dark"]{--ink:#fff}\n' +
          "}",
      );
    });

    test("points the body selector at the scope element wherever a selector starts", () => {
      expect(scopeLegacyCss("body{color:red}")).toBe(
        ".legacy-form{\n&{color:red}\n}",
      );
      // After a closing brace, after whitespace, after a semicolon-terminated at-rule.
      expect(scopeLegacyCss("a{}body{} body.x{}\nbody,p{}")).toBe(
        ".legacy-form{\na{}&{} &.x{}\n&,p{}\n}",
      );
      expect(scopeLegacyCss('@import "x";body{}')).toBe(
        '.legacy-form{\n@import "x";&{}\n}',
      );
    });

    test("leaves other selectors and words containing body alone", () => {
      expect(scopeLegacyCss("tbody tr{} #body{} .nobody{} body-x{}")).toBe(
        ".legacy-form{\ntbody tr{} #body{} .nobody{} body-x{}\n}",
      );
    });

    test("makes the hide-notes class a class of the scope element itself", () => {
      expect(scopeLegacyCss(".hidefn .fn,.hidefn .note{display:none}")).toBe(
        ".legacy-form{\n&.hidefn .fn,&.hidefn .note{display:none}\n}",
      );
    });
  });

  describe("extractLegacyForm", () => {
    const html =
      "<!doctype html><html><head><title>Legacy</title>" +
      "<style>body{color:red}</style><style>:root{--x:1}</style></head>" +
      "<body><div class='wrap'><h1>Form</h1>" +
      "<input type='checkbox' id='shownotes' checked></div>" +
      "<script>document.title='changed'</script></body></html>";

    test("returns the body markup without its scripts", () => {
      const { body } = extractLegacyForm(html);
      expect(body).toBe(
        '<div class="wrap"><h1>Form</h1>' +
          '<input type="checkbox" id="shownotes" checked=""></div>',
      );
      expect(body).not.toContain("<script");
    });

    test("joins every style element and scopes the result", () => {
      const { css } = extractLegacyForm(html);
      expect(css).toBe(".legacy-form{\n&{color:red}\n&{--x:1}\n}");
    });

    test("an empty document, as before the file has loaded, has an empty body", () => {
      const { css, body } = extractLegacyForm("");
      expect(body).toBe("");
      expect(css).toBe(".legacy-form{\n\n}");
    });
  });
});
