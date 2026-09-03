import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // lib/api.ts reads NEXT_PUBLIC_API_URL into a module-level constant at
    // import time (matches how Next.js actually inlines NEXT_PUBLIC_ vars at
    // build time in the real app) — must be set before any test module is
    // loaded, which is exactly what Vitest's `env` config guarantees, unlike
    // setting process.env from inside a test/beforeEach (too late by then).
    env: {
      NEXT_PUBLIC_API_URL: "http://localhost:3000",
    },
  },
});
