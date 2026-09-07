import { expect, test } from "@playwright/test"

import { Table } from "./table.js"

/**
 * The Astro example: three islands on one page, one per framework.
 *
 * Each table is rendered on the server by its own framework and hydrated as an
 * island, and each keeps its own view in the shared URL under its own prefix.
 * The same script runs against all three, because the promise is that they
 * are the same table.
 */

const URL = "http://localhost:4370/"

const ISLANDS = [
  { name: "react", index: 0, prefix: "r_" },
  { name: "vue", index: 1, prefix: "v_" },
  { name: "svelte", index: 2, prefix: "s_" },
] as const

/** Waits until the live table has replaced the server markup — see server-rendered.spec.ts. */
async function hydrated(table: Table): Promise<void> {
  await expect
    .poll(() => table.root.locator('thead th[data-key="name"]').evaluate((cell) => cell.style.left))
    // A measured offset: not the server's zero, and not React's nothing-yet.
    .toMatch(/^[1-9]\d*px$/)
}

for (const island of ISLANDS) {
  test.describe(island.name, () => {
    test.describe("before any JavaScript", () => {
      test.use({ javaScriptEnabled: false })

      test("is in the server markup with the right rows", async ({ page }) => {
        await page.goto(URL)
        const table = Table.nth(page, island.index)

        await expect(table.rows()).toHaveCount(15)
        await expect(table.count()).toContainText("120 rows")
      })

      test("sorts by following a link, and leaves the other islands alone", async ({ page }) => {
        await page.goto(URL)
        const table = Table.nth(page, island.index)
        const others = ISLANDS.filter((other) => other !== island)
        const before = await Promise.all(others.map((other) => Table.nth(page, other.index).column("Name")))

        await table.header("Name").getByRole("link").first().click()

        await expect(page).toHaveURL(new RegExp(`${island.prefix}sort=name`))
        // A full page load: the rows have to be back before they are read.
        for (const each of ISLANDS) await expect(Table.nth(page, each.index).rows()).toHaveCount(15)
        const after = await table.column("Name")
        expect(after).toEqual([...after].sort())

        const untouched = await Promise.all(others.map((other) => Table.nth(page, other.index).column("Name")))
        expect(untouched).toEqual(before)
      })
    })

    test.describe("with JavaScript", () => {
      test("hydrates without complaint and comes alive", async ({ page }) => {
        const complaints: string[] = []
        page.on("console", (message) => {
          if (["warning", "error"].includes(message.type())) complaints.push(message.text())
        })

        await page.goto(URL)
        const table = Table.nth(page, island.index)
        await hydrated(table)

        expect(complaints.filter((text) => /hydrat|mismatch|did not match/i.test(text))).toEqual([])

        const enabled = table.rows().getByRole("checkbox").and(page.locator(":enabled"))
        await enabled.first().check()
        await expect(table.count()).toHaveText("1 selected")
      })
    })
  })
}
