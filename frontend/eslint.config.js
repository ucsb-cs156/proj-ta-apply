import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import storybook from "eslint-plugin-storybook";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores([
    "dist",
    "build",
    "storybook-static",
    "coverage",
    // A Stryker run that is interrupted leaves its sandbox behind; never lint it.
    ".stryker-tmp",
    "public/mockServiceWorker.js",
  ]),
  {
    ignores: ["public/mockServiceWorker.js", ".stryker-tmp/**"],
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  // https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
  ...storybook.configs["flat/recommended"],
  // The storybook preset above also matches the .jsx stories, which nothing else lints, so
  // tell the default parser they contain JSX.
  {
    files: ["**/*.stories.{js,jsx,mjs}"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
]);
