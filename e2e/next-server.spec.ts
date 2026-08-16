import { expect, test } from "@playwright/test"

import { Table, downloadedText } from "./table.js"

/**
 * The server-side example.
 *
 * The one that has to be true in a browser rather than a test runner: the first
 * paint is already correct, the whole view is in the URL, the back button works,
 * and none of it needs JavaScript to have arrived.
 */

test.describe("before any JavaScript", () => {
  test.use({ javaScriptEnabled: false })

  test("renders the right rows on the first paint", async ({ page }) => {
    await page.goto("/")
    const table = new Table(page)

    await expect(table.rows()).toHaveCount(25)
    await expect(table.count()).toContainText("480 rows")
  })

  test("sorts by following a link", async ({ page }) => {
    await page.goto("/")
    const table = new Table(page)

    const before = await table.column("Amount")
    await table.header("Amount").getByRole("link").first().click()

    const after = await table.column("Amount")
    expect(after).not.toEqual(before)

    // Ascending, read as the numbers they are rather than the text they show.
    const numbers = after.map((text) => Number(text.replace(/[^\d.]/g, "")))
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b))
    await expect(page).toHaveURL(/sort=amount/)
  })

  test("pages by following a link", async ({ page }) => {
    await page.goto("/")
    const table = new Table(page)

    const first = await table.column("Invoice")
    await table.root.getByRole("link", { name: "Next page" }).click()

    expect(await table.column("Invoice")).not.toEqual(first)
    await expect(page).toHaveURL(/page=2/)
  })
})

test.describe("with JavaScript", () => {
  test("puts the whole view in the URL, and the back button undoes it", async ({ page }) => {
    await page.goto("/")
    const table = new Table(page)

    await table.search().fill("Wren")

    // Debounced, then a server round-trip before the URL changes — so this one
    // waits on the application's timing rather than the default five seconds.
    await expect(page).toHaveURL(/q=Wren/, { timeout: 15_000 })
    await expect(table.count()).toContainText("31 rows")

    // Thirty-one matches, twenty-five to a page: the count is the whole answer
    // and the rows are the first page of it.
    await expect(table.rows()).toHaveCount(25)
    expect([...new Set(await table.column("Customer"))]).toEqual(["Wren Ashby"])

    await page.goBack()
    await expect(table.count()).toContainText("480 rows")
  })

  test("a set filter offers values the page never held", async ({ page }) => {
    await page.goto("/?setf=1")
    const table = new Table(page)

    // The page holds 25 of 480 invoices; the filter must know all fifteen
    // customers, which only the server does.
    const panel = await table.openMenu("Customer")
    await expect(panel.locator(".tpz-filter-option")).toHaveCount(15, { timeout: 15_000 })

    await panel.getByText("Wren Ashby", { exact: true }).click()
    await expect(table.count()).toContainText("31 rows")

    const customers = await table.column("Customer")
    expect([...new Set(customers)]).toEqual(["Wren Ashby"])
  })

  test("exports every matching row, not the page on screen", async ({ page }) => {
    await page.goto("/?setf=1")
    const table = new Table(page)

    await table.search().fill("Wren")
    await expect(table.count()).toContainText("31 rows")

    const csv = await downloadedText(page, async () => {
      await table.root.getByRole("button", { name: "Export" }).click()
      await page.locator(".tpz-portal").getByRole("button", { name: /Download CSV/i }).click()
    })

    const lines = csv.replace(/\r?\n$/, "").split("\r\n")
    expect(lines).toHaveLength(32)
    expect(lines[0]).toContain("Invoice")
    expect(lines.slice(1).every((line) => line.includes("Wren Ashby"))).toBe(true)
  })

  test("keeps the header visible while the body scrolls", async ({ page }) => {
    await page.goto("/")
    const table = new Table(page)

    const header = table.root.locator("thead th").first()
    await expect(header).toBeVisible()

    const before = await header.boundingBox()
    expect(before).not.toBeNull()

    await table.scroller().evaluate((node) => node.scrollBy(0, 400))
    expect(await table.scroller().evaluate((node) => node.scrollTop)).toBeGreaterThan(0)

    // Still exactly where it was, while the rows underneath have moved.
    await expect.poll(async () => (await header.boundingBox())?.y).toBeCloseTo(before?.y ?? -1, 0)
  })
})
