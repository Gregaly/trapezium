import { svelte } from "@sveltejs/vite-plugin-svelte"
import { defineConfig } from "vitest/config"

export default defineConfig({
  // Only `.svelte` files go through it, so the plugin costs the other packages
  // nothing.
  plugins: [svelte({ hot: false })],
  resolve: {
    // The component under test imports its own package by name.
    conditions: ["svelte", "browser", "import"],
  },
  test: {
    include: ["packages/*/src/**/*.test.{ts,tsx}"],
    environment: "node",
    // The DOM-dependent tests say so themselves with a docblock, so the default
    // stays fast: the core has no DOM and never should.
    environmentMatchGlobs: [
      ["packages/react/**", "jsdom"],
      ["packages/vanilla/**", "jsdom"],
      ["packages/vue/**", "jsdom"],
      ["packages/svelte/**", "jsdom"],
    ],
  },
})
