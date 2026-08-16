import { expect, test } from "@playwright/test"

import { Table } from "./table.js"

/**
 * The React playground.
 *
 * Everything that only means something with real layout: scrolling that loads
 * more rows, a table that becomes cards when its container is narrow, dragging
 * a column out of the table to remove it, and the states that have no rows to
 * lay out at all.
 */

const PLAYGROUND = "http://localhost:4330/examples/playground/dist/"

/** The second table on the page — the one with every feature switched on. */
function configured(page: import("@playwright/test").Page): Table {
  return new Table(page, page.locator(".tpz").filter({ has: page.locator(".tpz-search") }).first())
}

test.beforeEach(async ({ page }) => {
  await page.goto(PLAYGROUND)
  await expect(configured(page).rows().first()).toBeVisible()
})

test("loads the next page onto the end when asked", async ({ page }) => {
  const table = configured(page)

  await page.getByRole("button", { name: "Load more", exact: true }).click()
  const before = await table.rows().count()

  await table.root.getByRole("button", { name: /Load more/i }).click()
  await expect(table.rows()).toHaveCount(before * 2)

  // Appended, not replaced: every row is a row that was not there before.
  const references = await table.column("Invoice")
  expect(new Set(references).size).toBe(references.length)
})

test("loads more as the rows are scrolled", async ({ page }) => {
  const table = configured(page)

  await page.getByRole("button", { name: "Infinite", exact: true }).click()
  const before = await table.rows().count()

  await table.scroller().evaluate((node) => node.scrollTo(0, node.scrollHeight))
  await expect(table.rows()).not.toHaveCount(before)

  // It ends, rather than fetching for ever: scrolling on eventually arrives at
  // every row there is and then stops asking.
  const total = Number(/([\d,]+) rows?/.exec(await table.count().innerText())?.[1]?.replace(/,/g, ""))
  expect(total).toBeGreaterThan(before)

  // One page arrives per pass, so reaching the end of a few hundred rows takes
  // a few hundred passes' worth of patience on a busy machine.
  await expect(async () => {
    await table.scroller().evaluate((node) => node.scrollTo(0, node.scrollHeight))
    expect(await table.rows().count()).toBe(total)
  }).toPass({ timeout: 60_000, intervals: [100] })
})

test("becomes cards when the table is narrow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  const table = configured(page)

  // The example's own switch hides its checkbox under a track, so it is
  // clicked the way a person clicks it: on the label.
  await page.locator("label.switch").filter({ hasText: "Card layout" }).click()

  // Every data cell carries its own header once the rows are stacked, because
  // there is no header row left to read them against. The selection cell is the
  // exception, and rightly: a checkbox needs no label repeated beside it.
  const cell = table.rows().first().locator('td[data-key="reference"]')
  await expect(cell).toHaveAttribute("data-label", /\w/)
  await expect(table.root.locator("thead")).toBeHidden()
})

test("removes a column by dragging it out of the table", async ({ page, browserName }) => {
  /*
    Chromium only, and not because the feature is: Playwright can only synthesise
    HTML5 drag-and-drop in Chromium, so elsewhere this would be testing the test
    harness. Dragging is exercised without the native events in the unit suites.
  */
  test.skip(browserName !== "chromium", "only chromium can synthesise a native drag")

  const table = configured(page)

  const before = (await table.root.locator("thead th").allInnerTexts()).map((text) => text.trim())
  expect(before).toContain("Email")

  const header = table.header("Email")
  const box = await header.boundingBox()
  expect(box).not.toBeNull()

  // Dropped on nothing, which is what "remove" means here. The poof is the
  // feedback that it worked.
  await header.hover()
  await page.mouse.down()
  await page.mouse.move((box?.x ?? 0) + 40, (box?.y ?? 0) + 320, { steps: 12 })
  await page.mouse.up()

  const after = (await table.root.locator("thead th").allInnerTexts()).map((text) => text.trim())
  expect(after).not.toContain("Email")
})

test("says so when there is nothing, when it is loading, and when it broke", async ({ page }) => {
  const section = page.locator("section").filter({ hasText: "Empty, loading, and error" })

  await expect(section.getByText("Nothing to show")).toBeVisible()
  await expect(section.locator(".tpz-skeleton, [aria-busy='true']").first()).toBeVisible()
  await expect(section.getByText("Could not reach the server")).toBeVisible()
})

test("changes row height without changing anything else", async ({ page }) => {
  const table = configured(page)
  const rows = await table.rows().count()

  /*
    Measured on the header, not a body row: a cell that has been told to wrap —
    the notes column here — is as tall as its content, which is the point of
    asking for it, and it would swallow the difference.
  */
  const header = table.root.locator("thead th").first()
  const normal = (await header.boundingBox())?.height ?? 0

  await page.getByRole("button", { name: "Compact", exact: true }).click()
  await expect(table.root).toHaveAttribute("data-density", "compact")
  expect((await header.boundingBox())?.height ?? 0).toBeLessThan(normal)

  await page.getByRole("button", { name: "Relaxed", exact: true }).click()
  expect((await header.boundingBox())?.height ?? 0).toBeGreaterThan(normal)

  // Nothing else moved: the same rows, still there.
  expect(await table.rows().count()).toBe(rows)
})
