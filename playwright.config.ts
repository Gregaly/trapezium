import { defineConfig, devices } from "@playwright/test"

/**
 * The examples, driven as a user drives them.
 *
 * Everything below the DOM is covered by unit tests; this covers the parts that
 * only exist in a browser — real layout, real scrolling, real drag events, the
 * sticky header actually sticking, and a server-rendered page working before
 * its JavaScript arrives. Each example is a separate server, started here and
 * reused if one is already running.
 */

const CI = Boolean(process.env["CI"])

export default defineConfig({
  testDir: "e2e",
  outputDir: "test-results",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  /*
    Bounded on purpose. The examples are served by a twenty-line static server
    and a couple of dev servers, and fifteen workers hammering them produces
    failures that are about the harness rather than the library.
  */
  workers: CI ? 2 : 4,
  reporter: CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  // Scrolling a few hundred rows into view a page at a time is legitimately
  // slower than a click, and a busy machine should not make it a failure.
  timeout: 90_000,

  expect: {
    // A hair of tolerance, because font rasterising is not identical between a
    // developer's machine and a CI container.
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },

  use: {
    baseURL: "http://localhost:4300",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    // The engine behind Safari, and the one most likely to disagree about
    // sticky positioning and container queries.
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],

  webServer: [
    {
      /*
        Built and served, not `next dev`. The production server is what a
        consumer runs, and the dev server's chunks go stale whenever the
        example has been built for anything else — which reads as "hydration is
        broken" when it is only the harness.
      */
      command: "pnpm --filter @trapezium/example-next-server build && pnpm --filter @trapezium/example-next-server start",
      url: "http://localhost:4300",
      reuseExistingServer: !CI,
      // It builds first, so it is allowed longer than the others to appear.
      timeout: 300_000,
    },
    {
      command: "pnpm --filter @trapezium/example-vue dev",
      url: "http://localhost:4310",
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @trapezium/example-svelte dev",
      url: "http://localhost:4320",
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
    {
      // Serves the repository root, so it carries the plain-html example and
      // the built playground both.
      command: "pnpm --filter @trapezium/example-plain-html dev",
      url: "http://localhost:4330",
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
  ],
})
