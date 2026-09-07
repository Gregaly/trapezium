import { expect, test } from "@playwright/test"

import { Table } from "./table.js"

/**
 * Row height, where it is actually decided.
 *
 * A unit test can assert which attribute is on the table; only a browser can
 * say how tall the row ended up, and that is the whole feature. Everything
 * here measures rendered boxes.
 *
 * The claim being tested is that auto height needs no measuring pass at all —
 * a real `<table>` in normal flow sizes a row to its tallest cell, whatever a
 * cell renderer put in it — and that appending a page to a list of rows of
 * differing heights does not disturb the rows already on screen.
 */

const PLAYGROUND = "http://localhost:4330/examples/playground/dist/"

/** The second table on the page — the one with every feature switched on. */
function configured(page: import("@playwright/test").Page): Table {
  return new Table(page, page.locator(".tpz").filter({ has: page.locator(".tpz-search") }).first())
}

/** The table in the section that is set to auto height. */
function sizing(page: import("@playwright/test").Page): Table {
  return new Table(page, page.locator('.tpz[data-row-height="auto"]').first())
}

async function heights(table: Table): Promise<number[]> {
  return table.rows().evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height))
}

test.beforeEach(async ({ page }) => {
  await page.goto(PLAYGROUND)
  await expect(configured(page).rows().first()).toBeVisible()
})

test("a fixed table gives every row the same height", async ({ page }) => {
  // The first table on the page: nothing configured, so no column has been
  // told to wrap and the fixed height is the only thing deciding.
  const table = Table.nth(page, 0)
  const measured = await heights(table)

  expect(measured.length).toBeGreaterThan(1)
  expect(new Set(measured.map((height) => Math.round(height))).size).toBe(1)
})

test("an auto table sizes each row to its own content", async ({ page }) => {
  const table = sizing(page)
  await expect(table.rows().first()).toBeVisible()

  const measured = await heights(table)
  expect(measured.length).toBeGreaterThan(1)

  // Rows differ from one another, and all of them clear the fixed height a
  // row would otherwise have had.
  expect(new Set(measured.map((height) => Math.round(height))).size).toBeGreaterThan(1)
  expect(Math.min(...measured)).toBeGreaterThan(32)
})

test("a cell renderer is what makes its row tall", async ({ page }) => {
  const table = sizing(page)
  const index = await table.columnIndex("Rendered")

  const [cell, row] = await table
    .rows()
    .first()
    .evaluate(
      (node, at) => [
        node.querySelectorAll("td")[at]!.getBoundingClientRect().height,
        node.getBoundingClientRect().height,
      ],
      index,
    )

  // Three stacked lines from the renderer, and the row grew to hold them —
  // nothing measured it, the browser simply laid it out.
  expect(cell).toBeGreaterThan(40)
  expect(row).toBeGreaterThanOrEqual(cell)
})

test("a column that opted out stays on one line while its neighbours wrap", async ({ page }) => {
  const table = sizing(page)
  const invoice = await table.columnIndex("Invoice")
  const notes = await table.columnIndex("Notes")

  const measured = await table.rows().evaluateAll(
    (rows, at) => {
      const lineCount = (node: Element) => {
        const range = document.createRange()
        range.selectNodeContents(node)
        return range.getClientRects().length
      }

      const read = (row: Element, index: number) => {
        const cell = row.querySelectorAll("td")[index]!
        const style = getComputedStyle(cell)
        return {
          wrap: cell.getAttribute("data-wrap"),
          whiteSpace: style.whiteSpace,
          /*
            The number of line boxes the text really occupies. Measuring the
            cell instead would say nothing: every cell in a row is as tall as
            the row, so a one-line cell beside a four-line one is four lines
            tall and still has one line of text in it.
          */
          lines: lineCount(cell),
        }
      }
      return rows.map((row) => ({ opted: read(row, at.invoice), wrapping: read(row, at.notes) }))
    },
    { invoice, notes },
  )

  // Every invoice reference is on one line, however long the reference is.
  for (const row of measured) {
    expect(row.opted.wrap).toBe("false")
    expect(row.opted.whiteSpace).toBe("nowrap")
    expect(row.opted.lines).toBe(1)
  }

  // And the prose beside it is doing the opposite, in at least some of the
  // rows — which is the whole point of one column opting out of the other's
  // behaviour.
  expect(measured.every((row) => row.wrapping.whiteSpace === "normal")).toBe(true)
  expect(measured.some((row) => row.wrapping.lines > 1)).toBe(true)
})

test("a number sets the height of every row exactly", async ({ page }) => {
  const table = configured(page)
  await page.getByRole("button", { name: "64px", exact: true }).click()

  const measured = await heights(table)
  // A border on each row is the one pixel of slack.
  for (const height of measured) expect(Math.round(height)).toBeGreaterThanOrEqual(64)
  // Exact means exact: content too tall for the row is clipped rather than
  // being allowed to push past the height that was asked for.
  expect(Math.max(...measured)).toBeLessThan(67)
})

test("an exact height fills itself rather than truncating to one line", async ({ page }) => {
  /*
    The bug this guards is what a number used to do: rows twice the usual
    height, and one truncated line adrift in the middle of them. Asking for
    taller rows means wanting the text to use them.
  */
  const table = configured(page)
  await page.getByRole("button", { name: "64px", exact: true }).click()

  const notes = await table.columnIndex("Notes")
  const measured = await table.rows().evaluateAll(
    (rows, at) => {
      const lineCount = (node: Element) => {
        const range = document.createRange()
        range.selectNodeContents(node)
        return range.getClientRects().length
      }
      return rows.map((row) => {
        const cell = row.querySelectorAll("td")[at]!
        return { whiteSpace: getComputedStyle(cell).whiteSpace, lines: lineCount(cell) }
      })
    },
    notes,
  )

  expect(measured.every((row) => row.whiteSpace === "normal")).toBe(true)
  // Some row is using the height it was given for more than one line of text.
  expect(measured.some((row) => row.lines > 1)).toBe(true)
})

test("an exact height shrinks rows past their content, ending them in an ellipsis", async ({ page }) => {
  /*
    The bug this guards: `height` on a table cell is a minimum, so for a while
    this mode could grow a row but never shrink one — the slider moved and the
    rows sat there at the size of their text. A row height that cannot shrink a
    row is not a row height.
  */
  const table = configured(page)
  await page.getByRole("button", { name: "Auto", exact: true }).click()
  const grown = Math.max(...(await heights(table)))

  // Smaller than the content needs, which is the case that used to be
  // impossible: the rows simply refused to go below the size of their text.
  await page.getByRole("button", { name: "28px", exact: true }).click()
  const capped = await heights(table)

  expect(grown).toBeGreaterThan(34)
  for (const height of capped) expect(Math.round(height)).toBeLessThan(31)

  // And what will not fit ends in an ellipsis rather than a raw cut, on however
  // many lines the row turned out to have room for.
  const marked = await table.root.evaluate((root) => {
    // A column that opted out of wrapping finishes on one line the ordinary
    // way, so the wrapping ones are what this is about.
    const fits = [...root.querySelectorAll<HTMLElement>(".tpz-fit")].filter(
      (fit) => fit.closest("td")?.getAttribute("data-wrap") !== "false",
    )
    const truncated = fits.filter((fit) => fit.scrollHeight > fit.clientHeight + 1)
    const style = truncated[0] ? getComputedStyle(truncated[0]) : undefined
    return { truncated: truncated.length, lineClamp: style?.webkitLineClamp }
  })

  expect(marked.truncated).toBeGreaterThan(0)
  // A real count, worked out from the height in CSS — never "none".
  expect(Number(marked.lineClamp)).toBeGreaterThanOrEqual(1)
})

test("only the cells that overflow are marked, not the ones that merely fill", async ({ page }) => {
  /*
    The trap this guards. A cell whose content stops exactly at the cap is not
    truncated, and must not be given an ellipsis — but its box is the same
    height as one that overflows, so anything reasoning from height alone marks
    both. Counting lines is what tells them apart, and `-webkit-line-clamp`
    only draws the mark when there is a further line to draw it for.
  */
  const table = configured(page)
  await page.getByRole("button", { name: "64px", exact: true }).click()

  const marked = await table.root.evaluate((root) =>
    [...root.querySelectorAll<HTMLElement>(".tpz-fit")].filter(
      (fit) => fit.scrollHeight > fit.clientHeight + 1,
    ).length,
  )

  // Three lines is more than this data needs, so nothing should be cut at all.
  expect(marked).toBe(0)
})

test("wrapped rows hang from the top; fixed and exact ones stay centred", async ({ page }) => {
  const table = configured(page)
  const align = () =>
    table.rows().first().evaluate((row) => getComputedStyle(row.querySelector("td")!).verticalAlign)

  await page.getByRole("button", { name: "Fixed", exact: true }).click()
  expect(await align()).toBe("middle")

  await page.getByRole("button", { name: "Auto", exact: true }).click()
  expect(await align()).toBe("top")

  // An exact row keeps the library's usual centring: its content is bounded,
  // so it can never be taller than the cell and centring is always safe.
  await page.getByRole("button", { name: "64px", exact: true }).click()
  expect(await align()).toBe("middle")
})

test("the header keeps its own height, whatever the rows are doing", async ({ page }) => {
  /*
    `rowHeight` sets the row token, and the header used to read the same one —
    so a table of 64px rows got a 64px header, and a short one got a header too
    small for the sort and menu controls. Density still moves both, because
    that is what density is.
  */
  const table = configured(page)
  const header = () =>
    table.root.locator("thead tr").evaluate((row) => Math.round(row.getBoundingClientRect().height))

  const resting = await header()

  for (const label of ["Auto", "28px", "64px"]) {
    await page.getByRole("button", { name: label, exact: true }).click()
    expect(await header()).toBe(resting)
  }

  // The controls inside it are still the height of the header, not the row.
  await page.getByRole("button", { name: "28px", exact: true }).click()
  const inner = await table.root
    .locator("thead .tpz-th-button")
    .first()
    .evaluate((node) => Math.round(node.getBoundingClientRect().height))
  expect(inner).toBeGreaterThan(20)

  // Density is the knob that does move it.
  await page.getByRole("button", { name: "Relaxed", exact: true }).click()
  expect(await header()).toBeGreaterThan(resting)
})

test("density still means something under auto height", async ({ page }) => {
  const table = configured(page)
  await page.getByRole("button", { name: "Auto", exact: true }).click()

  await page.getByRole("button", { name: "Relaxed", exact: true }).click()
  const relaxed = Math.min(...(await heights(table)))

  await page.getByRole("button", { name: "Compact", exact: true }).click()
  const compact = Math.min(...(await heights(table)))

  // The token is the floor, not the height, so the shortest row still follows
  // the density while a tall one is free to be tall.
  expect(relaxed).toBeGreaterThan(compact)
})

/**
 * The reason any of this is affordable.
 *
 * Rows of differing heights being appended, page after page, is the case that
 * makes a virtualised grid stutter: it has to render, measure and place every
 * one. Here the rows already on screen are not touched at all, so the only
 * thing that moves is the bottom of the list.
 */
test("appending a page leaves the rows above it exactly where they were", async ({ page }) => {
  const table = configured(page)

  await page.getByRole("button", { name: "Auto", exact: true }).click()
  await page.getByRole("button", { name: "Load more", exact: true }).click()

  /*
    Measured against the first row rather than the viewport: clicking the
    button scrolls the page, and where the table sits on screen is not what
    this is about. What it is about is whether the rows above the new ones
    moved relative to one another — which is what a rebuild would do, and what
    a reader scrolling through them would feel.
  */
  const offsets = () =>
    table.rows().evaluateAll((rows) => {
      const top = rows[0]!.getBoundingClientRect().top
      return rows.map((row) => Math.round(row.getBoundingClientRect().top - top))
    })

  const before = await offsets()

  await table.root.getByRole("button", { name: /Load more/i }).click()
  await expect(table.rows()).toHaveCount(before.length * 2)

  expect((await offsets()).slice(0, before.length)).toEqual(before)
})

/**
 * The guarantee, counted rather than inferred.
 *
 * The tests above show that nothing *moved*. This one shows that nothing was
 * *built*: a `MutationObserver` on the tbody counts every row element that goes
 * in and every one that comes out while the list is scrolled through page after
 * page. A renderer that rebuilt the body would show a discard for every row it
 * replaced, and a built count that grows with the square of the pages.
 *
 * This is the property the whole append path exists for, so it is asserted
 * directly instead of being implied by a scroll position.
 */
test("builds each row once across a long infinite scroll, and discards none", async ({ page }) => {
  const table = configured(page)

  await page.getByRole("button", { name: "Auto", exact: true }).click()
  await page.getByRole("button", { name: "Infinite", exact: true }).click()
  await expect(table.rows().first()).toBeVisible()

  await table.root.locator("tbody").evaluate((body) => {
    const meter = { built: body.querySelectorAll("tr").length, discarded: 0 }
    ;(window as unknown as { __rowMeter: typeof meter }).__rowMeter = meter

    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) if (node.nodeName === "TR") meter.built += 1
        for (const node of record.removedNodes) if (node.nodeName === "TR") meter.discarded += 1
      }
    }).observe(body, { childList: true })
  })

  const scroller = table.scroller()
  for (let pass = 0; pass < 8; pass += 1) {
    await scroller.evaluate((node) => { node.scrollTo(0, node.scrollHeight) })
    await page.waitForTimeout(150)
  }

  const onScreen = await table.rows().count()
  const meter = await page.evaluate(
    () => (window as unknown as { __rowMeter: { built: number; discarded: number } }).__rowMeter,
  )

  // Several pages actually arrived, or the rest of this proves nothing.
  expect(onScreen).toBeGreaterThan(50)

  // One element per row, ever. Not one per row per render.
  expect(meter.built).toBe(onScreen)
  expect(meter.discarded).toBe(0)

  // And they really were different heights while it happened.
  const heights = await table.rows().evaluateAll((rows) =>
    rows.map((row) => Math.round(row.getBoundingClientRect().height)),
  )
  expect(new Set(heights).size).toBeGreaterThan(1)
})

test("scrolling to load more does not throw away the scroll position", async ({ page }) => {
  const table = configured(page)

  await page.getByRole("button", { name: "Auto", exact: true }).click()
  await page.getByRole("button", { name: "Infinite", exact: true }).click()

  const before = await table.rows().count()
  await table.scroller().evaluate((node) => node.scrollTo(0, node.scrollHeight))
  await expect(table.rows()).not.toHaveCount(before)

  // Still down among the rows it was reading, not thrown back to the top by a
  // table that rebuilt itself underneath.
  const top = await table.scroller().evaluate((node) => node.scrollTop)
  expect(top).toBeGreaterThan(0)
})
