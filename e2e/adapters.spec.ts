import { expect, test, type Page } from "@playwright/test"

import { Table, downloadedText } from "./table.js"

/**
 * The same table, four ways.
 *
 * Vue, Svelte and plain JavaScript all render through the same DOM layer, so
 * the point of running the same script against each is to catch the day one of
 * them stops doing that — a binding that drops an update, a teardown that
 * leaves a menu behind, a prop that never reaches the renderer.
 *
 * The React case is the Next example, which has a file of its own because it
 * additionally has a server.
 */

const EXAMPLES = [
  { name: "vue", url: "http://localhost:4310/", pageSize: 15 },
  { name: "svelte", url: "http://localhost:4320/", pageSize: 15 },
  { name: "plain javascript", url: "http://localhost:4330/", pageSize: 12 },
] as const

/**
 * The table with everything switched on.
 *
 * Two of the examples show a bare one above it, so it is found by the search
 * box — every table has a toolbar, because the column control lives there, but
 * only a configured one has been given a search.
 */
function configured(page: Page): Table {
  return new Table(page, page.locator(".tpz").filter({ has: page.locator(".tpz-search") }).first())
}

for (const example of EXAMPLES) {
  test.describe(example.name, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(example.url)
      await expect(configured(page).rows().first()).toBeVisible()
    })

    test("sorts a column by clicking its header", async ({ page }) => {
      const table = configured(page)

      const before = await table.column("Name")
      // By its exact name: a header may also hold a "Search Name" and a
      // "Name column options".
      await table.header("Name").getByRole("button", { name: "Name", exact: true }).click()

      const after = await table.column("Name")
      expect(after).not.toEqual(before)
      expect(after).toEqual([...after].sort())
      await expect(table.header("Name")).toHaveAttribute("aria-sort", "ascending")
    })

    test("searches across every column", async ({ page }) => {
      const table = configured(page)

      await table.search().fill("ada")
      await expect(table.rows()).not.toHaveCount(example.pageSize)

      for (const row of await table.cells()) {
        expect(row.join(" ").toLowerCase()).toContain("ada")
      }
    })

    test("filters one column from its menu", async ({ page }) => {
      const table = configured(page)

      // Team holds a handful of values, so it gets a set filter: the choices
      // are the values in the data, drawn from every page rather than this one.
      const panel = await table.openMenu("Team")
      const choice = panel.locator(".tpz-filter-option").first()
      const value = (await choice.innerText()).trim()

      await choice.getByRole("checkbox").check()
      await table.closeMenus()

      const remaining = await table.column("Team")
      expect(remaining.length).toBeGreaterThan(0)
      expect([...new Set(remaining)]).toEqual([value])
    })

    test("pages without repeating itself", async ({ page }) => {
      const table = configured(page)

      // Email, because the sample data repeats names on purpose and an
      // assertion about repeats needs a column that does not.
      const first = await table.column("Email")
      await table.nextPage().click()
      const second = await table.column("Email")

      expect(second).not.toEqual(first)
      expect(first.some((email) => second.includes(email))).toBe(false)
    })

    test("selects rows, including the whole page at once, skipping the ones it cannot", async ({ page }) => {
      const table = configured(page)
      const boxes = table.rows().getByRole("checkbox")
      await expect(boxes).toHaveCount(example.pageSize)

      // Every example rules the Sales team out, so some boxes are disabled.
      const enabled = boxes.and(page.locator(":enabled"))
      const disabled = boxes.and(page.locator(":disabled"))
      expect(await disabled.count()).toBeGreaterThan(0)

      await enabled.first().check()
      await expect(enabled.first()).toBeChecked()
      await expect(table.count()).toHaveText("1 selected")

      await table.root.locator("thead").getByRole("checkbox").first().check()
      for (const box of await enabled.all()) await expect(box).toBeChecked()
      for (const box of await disabled.all()) await expect(box).not.toBeChecked()
      await expect(table.count()).toHaveText(`${String(await enabled.count())} selected`)

      // Complete, as far as this page can be — not "some of it".
      const header = table.root.locator("thead").getByRole("checkbox").first()
      await expect(header).toBeChecked()
      expect(await header.evaluate((node) => (node as HTMLInputElement).indeterminate)).toBe(false)
    })

    test("selects a range with shift held", async ({ page }) => {
      const table = configured(page)
      const enabled = table.rows().getByRole("checkbox").and(page.locator(":enabled"))
      expect(await enabled.count()).toBeGreaterThan(3)

      await enabled.nth(0).check()
      await enabled.nth(3).click({ modifiers: ["Shift"] })

      // The first four selectable rows, and nothing after them.
      const checked = await enabled.evaluateAll((nodes) => nodes.map((node) => (node as HTMLInputElement).checked))
      expect(checked.slice(0, 4)).toEqual([true, true, true, true])
      expect(checked.slice(4)).not.toContain(true)
      await expect(table.count()).toHaveText("4 selected")
    })

    test("exports what the filters left, as CSV", async ({ page }) => {
      const table = configured(page)
      await table.search().fill("ada")

      // Until every row on screen matches the whole word. Firefox has been
      // seen applying the search a letter at a time, and a count read while
      // it still said "a" is not the number the export will use.
      await expect
        .poll(async () => (await table.cells()).every((row) => row.join(" ").toLowerCase().includes("ada")))
        .toBe(true)

      // Every matching row, however many pages that is — so the number to
      // compare against is the count, not what fits on screen.
      await expect(table.count()).not.toContainText("120 rows")
      const matched = Number(/([\d,]+) rows?/.exec((await table.count().innerText()) ?? "")?.[1]?.replace(/,/g, ""))
      expect(matched).toBeGreaterThan(0)

      const csv = await downloadedText(page, async () => {
        await table.root.getByRole("button", { name: "Export" }).click()
        await page.locator(".tpz-portal").getByRole("button", { name: /Download CSV/i }).click()
      })

      const lines = csv.replace(/\r?\n$/, "").split("\r\n")
      expect(lines.length - 1).toBe(matched)
      expect(lines[0]).toContain("Name")
    })

    test("moves a column by dragging its header", async ({ page }) => {
      const table = configured(page)

      const headers = async () => table.root.locator("thead th").allInnerTexts()
      const before = (await headers()).map((text) => text.trim())

      // Team onto the left edge of Email. Both are ordinary columns — the
      // leading one is pinned in these examples, and a pinned column stays put
      // on purpose.
      const source = table.header("Team")
      const target = table.header("Email")
      await source.dragTo(target, { targetPosition: { x: 4, y: 8 } })

      const after = (await headers()).map((text) => text.trim())
      expect(after).not.toEqual(before)
      expect(after.indexOf("Team")).toBeLessThan(after.indexOf("Email"))
    })

    test("stacks into cards that ignore column widths", async ({ page }) => {
      /*
        Every example gives its actions column a width. As a column that is a
        width; as a field in a card it is nothing, and the field must run the
        full width of the card like every other.
      */
      await page.setViewportSize({ width: 375, height: 800 })
      const table = configured(page)
      await page.locator("label.switch").filter({ hasText: "Card layout" }).click()
      await expect(table.root.locator("thead")).toBeHidden()

      const row = table.rows().first()
      const rowBox = await row.boundingBox()
      if (!rowBox) throw new Error("the first row has no box")

      const cells = await row.locator("td").evaluateAll((cells) =>
        cells.map((cell) => {
          const box = cell.getBoundingClientRect()
          return { key: cell.dataset["key"], left: box.left, right: box.right }
        }),
      )
      expect(cells.map((cell) => cell.key)).toContain("actions")

      for (const cell of cells) {
        expect(cell.left, `${String(cell.key)} starts at the left edge`).toBeCloseTo(rowBox.x, 0)
        expect(cell.right, `${String(cell.key)} ends at the right edge`).toBeCloseTo(rowBox.x + rowBox.width, 0)
      }
    })

    test("hides a column from the column menu", async ({ page }) => {
      const table = configured(page)

      await table.root.getByRole("button", { name: /Columns/i }).click()
      const menu = page.locator(".tpz-portal").last()
      await menu.getByRole("checkbox", { name: "Email" }).uncheck()
      await table.closeMenus()

      expect((await table.root.locator("thead th").allInnerTexts()).map((t) => t.trim())).not.toContain("Email")
    })
  })
}
