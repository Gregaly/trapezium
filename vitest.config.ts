import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.{ts,tsx}"],
    environment: "node",
    // The DOM-dependent tests say so themselves with a docblock, so the default
    // stays fast: the core has no DOM and never should.
    environmentMatchGlobs: [
      ["packages/react/**", "jsdom"],
      ["packages/vanilla/**", "jsdom"],
    ],
  },
})
