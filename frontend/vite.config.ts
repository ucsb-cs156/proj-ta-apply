import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  server: {
    host: "127.0.0.1",
    port: 3000,
    proxy: {
      "/api": "http://localhost:8080",
      "/logout": "http://localhost:8080",
      "/oauth2": "http://localhost:8080",
      // Only the OAuth2 callback, not /login/success (an SPA route Vite must serve itself).
      "/login/oauth2": "http://localhost:8080",
    },
  },
  build: {
    outDir: "build",
  },
  test: {
    dangerouslyIgnoreUnhandledErrors: false,
    globals: true,
    environment: "jsdom",
    setupFiles: "./vitest.setup.js",
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    coverage: {
      enabled: true,
      provider: "v8",
      include: ["src/main/**"],
      thresholds: {
        lines: 70.0,
        statements: 70.0,
        branches: 60.0,
        functions: 75.0,
      },
      reporter: ["html", "text-summary"],
    },
  },
});
