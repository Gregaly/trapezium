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

  test("selects rows without leaving the page, and keeps them across a fetch", async ({ page }) => {
    await page.goto("/")
    const table = new Table(page)
    const url = page.url()

    // Paid invoices cannot be picked, so the page has a mix of both.
    const boxes = table.rows().getByRole("checkbox")
    const enabled = boxes.and(page.locator(":enabled"))
    expect(await boxes.and(page.locator(":disabled")).count()).toBeGreaterThan(0)

    await enabled.first().check()
    await expect(enabled.first()).toBeChecked()
    await expect(table.count()).toHaveText("1 selected")

    // A selection is not part of the URL, so nothing was fetched for it.
    expect(page.url()).toBe(url)

    // A change that does go through the server leaves the selection alone.
    await table.header("Amount").getByRole("link").first().click()
    await expect(page).toHaveURL(/sort=amount/)
    await expect(table.count()).toHaveText("1 selected")
  })

  test("moves a column by dragging its header, even though the header is a link", async ({ page, browserName }) => {
    /*
      Chromium only, because only Chromium can synthesise a native drag. The
      point of doing it here rather than in the playground: with `buildHref`
      each header is a link, and a link is natively draggable — so without
      care the drag that starts is the browser's drag of a URL, the drop
      indicator moves as if a column were coming, and the drop opens the URL.
    */
    test.skip(browserName !== "chromium", "only chromium can synthesise a native drag")

    await page.goto("/")
    const table = new Table(page)
    await expect(table.header("Amount").getByRole("link")).toBeVisible()

    const headers = async () => (await table.root.locator("thead th").allInnerTexts()).map((text) => text.trim())
    const before = await headers()

    await table.header("Amount").dragTo(table.header("Customer"), { targetPosition: { x: 4, y: 8 } })

    // The example keeps column order in the URL, so the new order arrives with
    // the next render rather than on the drop itself.
    await expect.poll(headers).not.toEqual(before)
    const after = await headers()
    expect(after.indexOf("Amount")).toBeLessThan(after.indexOf("Customer"))
    // The column moved; no link was followed.
    await expect(page).not.toHaveURL(/sort=/)
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

  /*
    The claim the row-height work rests on, checked against a real server
    rather than a simulated one: a row sizes itself with no measuring pass, so
    the finished markup can be produced by a machine with no layout at all.

    This reads the HTML off the wire, before any JavaScript has run.
  */
  test("sizes its rows in the server's own markup, with nothing left to correct", async ({ request, page }) => {
    const html = await (await request.get("/")).text()

    // The mode is in the document itself, not applied by an effect after paint.
    expect(html).toContain('data-row-height="auto"')
    expect(html).toContain("<table")

    // And the browser agrees with it once the page is live.
    await page.goto("/")
    const table = page.locator(".tpz").first()
    await expect(table.locator("tbody tr").first()).toBeVisible()
    expect(await table.getAttribute("data-row-height")).toBe("auto")

    /*
      And the mode is really in force, not merely named. This example's columns
      all hold short values, so nothing here has to wrap — what it proves is
      that a table which arrived from a server is in the wrapping mode and free
      to grow, which is the part a server cannot work out by measuring.
    */
    const cell = await table
      .locator("tbody td")
      .first()
      .evaluate((node) => {
        const style = getComputedStyle(node)
        return { whiteSpace: style.whiteSpace, verticalAlign: style.verticalAlign }
      })

    expect(cell.whiteSpace).toBe("normal")
    expect(cell.verticalAlign).toBe("top")
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
