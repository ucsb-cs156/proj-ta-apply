import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

/**
 * Issue #137: every radio button's border colour is defined once, as a CSS variable in index.css,
 * and applied by one rule. jsdom does not apply stylesheets, so this reads the file itself.
 */
describe("radio button colour in index.css", () => {
  const css = readFileSync("src/index.css", "utf8");

  test("the colour is a single variable, a darker grey than Bootstrap's default", () => {
    const match = css.match(/--radio-border-color:\s*(#[0-9a-fA-F]{6});/);
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe("#6c757d");
    expect(css.match(/--radio-border-color:/g)).toHaveLength(1);
  });

  test("one rule applies it to every radio button", () => {
    expect(css).toMatch(
      /\.form-check-input\[type="radio"\]\s*\{\s*border-color:\s*var\(--radio-border-color\);\s*\}/,
    );
  });
});
