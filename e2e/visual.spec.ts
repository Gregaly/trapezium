import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { expect, test } from "@playwright/test"

/**
 * What it looks like.
 *
 * The design is the product here, so a change to the stylesheet that nobody
 * intended should fail something. These compare against committed screenshots;
 * when a change is deliberate, `pnpm test:e2e:visual --update-snapshots` accepts
 * the new look and the diff in the pull request shows exactly what moved.
 *
 * Chromium only, and only where a snapshot has been recorded for the platform —
 * font rasterising differs between a laptop and a CI container, so each platform
 * has its own baselines and a platform without any skips rather than failing on
 * a picture nobody has ever agreed to.
 */

const SNAPSHOTS = fileURLToPath(new URL("visual.spec.ts-snapshots/", import.meta.url))

/**
 * Whether this picture has been agreed to on this operating system.
 *
 * A run that is recording says yes to everything — otherwise the first run on a
 * new platform would skip itself and never write the baseline it was asked for.
 */
function agreed(name: string): boolean {
  if (test.info().config.updateSnapshots !== "none") return true

  const platform = process.platform === "darwin" ? "darwin" : "linux"
  return existsSync(`${SNAPSHOTS}${name}-chromium-${platform}.png`)
}

test.describe.configure({ mode: "parallel" })
test.skip(({ browserName }) => browserName !== "chromium", "one engine is enough for a picture")

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 900 },
  { name: "tablet", width: 768, height: 1000 },
  { name: "desktop", width: 1440, height: 1000 },
]

for (const viewport of VIEWPORTS) {
  for (const theme of ["light", "dark"] as const) {
    test(`the table at ${viewport.name}, ${theme}`, async ({ page }) => {
      test.skip(
        !agreed(`table-${viewport.name}-${theme}`),
        "no baseline recorded on this platform yet — run with --update-snapshots",
      )

      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" })
      await page.goto("http://localhost:4330/examples/playground/dist/")

      const table = page.locator(".tpz").filter({ has: page.locator(".tpz-search") }).first()
      await expect(table.locator("tbody tr").first()).toBeVisible()

      await expect(table).toHaveScreenshot(`table-${viewport.name}-${theme}.png`, { animations: "disabled" })
    })
  }
}

test("a column menu, open", async ({ page }) => {
  test.skip(!agreed("menu-open"), "no baseline recorded on this platform yet — run with --update-snapshots")

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" })
  await page.goto("http://localhost:4330/examples/playground/dist/")

  const table = page.locator(".tpz").filter({ has: page.locator(".tpz-search") }).first()
  await expect(table.locator("tbody tr").first()).toBeVisible()

  await table.getByRole("button", { name: /Status column options/i }).click()
  const panel = page.locator(".tpz-portal").last()
  await expect(panel).toBeVisible()

  await expect(panel).toHaveScreenshot("menu-open.png", { animations: "disabled" })
})
