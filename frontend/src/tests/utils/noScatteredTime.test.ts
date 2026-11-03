import { describe, expect, test } from "vitest";

/**
 * Issue #293: the app's times are Pacific, and the only code that may format a time, or ask for
 * "now" in the browser's own zone, is main/utils/pacificTime.ts. Anything else that calls
 * toLocaleString and its kin, or builds a Date from nothing, shows the wrong day or hour to
 * someone whose browser is elsewhere. This reads the source to keep it that way.
 */
const sources = import.meta.glob("/src/main/**/*.{ts,tsx,js,jsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const FORBIDDEN: [string, RegExp][] = [
  ["toLocaleString", /\.toLocale(?:Date|Time)?String\s*\(/],
  ["new Date() with no argument", /new Date\(\s*\)/],
  ["Date.now()", /Date\.now\(/],
  ["Intl.DateTimeFormat", /Intl\.DateTimeFormat/],
  ["toISOString", /\.toISOString\s*\(/],
  ["getTimezoneOffset", /getTimezoneOffset/],
];

// These measure how long something has been on the screen, never what time or day it is.
const DURATIONS_ONLY = new Set(["/src/main/concurrency/MultipleTabsModal.tsx"]);

describe("only pacificTime.ts formats a time or reads the browser's clock", () => {
  test("the source files were found", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(100);
    expect(sources["/src/main/utils/pacificTime.ts"]).toBeDefined();
  });

  test.each(FORBIDDEN)("nothing else uses %s", (_name, pattern) => {
    const offenders = Object.entries(sources)
      .filter(([path]) => path !== "/src/main/utils/pacificTime.ts")
      .filter(([path]) => !DURATIONS_ONLY.has(path))
      .filter(([, text]) => pattern.test(text))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});
