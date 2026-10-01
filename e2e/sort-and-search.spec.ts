import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Locator, type Page } from "@playwright/test"

import { Table, downloadedText } from "./table.js"

/**
 * Sorting by several columns, and searching one column from its header.
 *
 * Both are gestures as much as features — a shift held down, a magnifier that
 * only exists while a header is hovered, a header that turns into a text box
 * under the pointer — so the parts worth testing are the ones a unit test
 * cannot reach: that nothing moves when the magnifier appears, that the box
 * keeps a person's place while the table re-renders around it, that Enter
 * closes it and does not open it again, and that a shift-click on a header
 * which is a link changes the view rather than opening a window.
 */

/* ── The examples that hold their own data ───────────────────────────────── */

type Example = {
  name: string
  url: string
  /** A text column, and something to type that some of its rows say. */
  text: { header: string; key: string; typed: string }
  /** A second column to sort within the first. */
  group: { header: string; key: string }
  /** A money column and a date column, searched by whatever their first cells happen to show. */
  money: { header: string; key: string }
  date: { header: string; key: string }
}

const PEOPLE = {
  text: { header: "Name", key: "name", typed: "ad" },
  group: { header: "Team", key: "team" },
  money: { header: "Salary", key: "salary" },
  date: { header: "Started", key: "started" },
}

const CLIENT: Example[] = [
  { name: "vue", url: "http://localhost:4310/", ...PEOPLE },
  { name: "svelte", url: "http://localhost:4320/", ...PEOPLE },
  { name: "plain javascript", url: "http://localhost:4330/", ...PEOPLE },
  {
    name: "react",
    url: "http://localhost:4330/examples/playground/dist/",
    text: { header: "Customer", key: "customer.name", typed: "ok" },
    group: { header: "Status", key: "status" },
    money: { header: "Amount", key: "amount" },
    date: { header: "Due", key: "due_date" },
  },
]

/** The table with everything switched on, which is the one with a search box. */
function configured(page: Page): Table {
  return new Table(page, page.locator(".tpz").filter({ has: page.locator(".tpz-search") }).first())
}

/** A header cell by its column, because its text changes once it is sorted. */
const headerOf = (table: Table, key: string) => table.root.locator(`thead th[data-key="${key}"]`)
const sortControl = (table: Table, key: string) => headerOf(table, key).locator(".tpz-th-button")
const magnifier = (table: Table, key: string) => headerOf(table, key).locator(".tpz-th-search")
const box = (table: Table, key: string) => headerOf(table, key).locator(".tpz-th-search-input")
const reset = (table: Table) => table.root.locator(".tpz-sort-reset")

/** One column's cells, top to bottom, by the column's key. */
async function cellsOf(table: Table, key: string): Promise<string[]> {
  return table
    .rows()
    .evaluateAll(
      (rows, column) =>
        rows.map((row) => [...row.querySelectorAll("td")].find((cell) => cell.dataset["key"] === column)?.textContent?.trim() ?? ""),
      key,
    )
}

/** Where every header cell starts and how wide it is — what a layout shift would change. */
async function headerGeometry(table: Table): Promise<string> {
  return table.root.locator("thead th").evaluateAll((cells) =>
    cells
      .map((cell) => {
        const rect = cell.getBoundingClientRect()
        return `${rect.left.toFixed(1)}:${rect.width.toFixed(1)}`
      })
      .join(" "),
  )
}

const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()

for (const example of CLIENT) {
  test.describe(example.name, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(example.url)
      await expect(configured(page).rows().first()).toBeVisible()
    })

    test("sorts by a second column when shift is held, and numbers the headers", async ({ page }) => {
      const table = configured(page)

      await sortControl(table, example.group.key).click()
      await sortControl(table, example.text.key).click({ modifiers: ["Shift"] })

      await expect(headerOf(table, example.group.key)).toHaveAttribute("aria-sort", "ascending")
      await expect(headerOf(table, example.text.key)).toHaveAttribute("aria-sort", "ascending")
      await expect(headerOf(table, example.group.key).locator(".tpz-th-order")).toHaveText("1")
      await expect(headerOf(table, example.text.key).locator(".tpz-th-order")).toHaveText("2")

      // Ordered by the first column, and by the second wherever the first ties.
      const groups = await cellsOf(table, example.group.key)
      const names = await cellsOf(table, example.text.key)
      for (let index = 1; index < groups.length; index += 1) {
        const before = fold(groups[index - 1] ?? "")
        const after = fold(groups[index] ?? "")
        expect(before.localeCompare(after)).toBeLessThanOrEqual(0)
        if (before === after) {
          expect(fold(names[index - 1] ?? "").localeCompare(fold(names[index] ?? ""))).toBeLessThanOrEqual(0)
        }
      }

      // Shift again on the first column turns it over without moving it down the order.
      await sortControl(table, example.group.key).click({ modifiers: ["Shift"] })
      await expect(headerOf(table, example.group.key)).toHaveAttribute("aria-sort", "descending")
      await expect(headerOf(table, example.group.key).locator(".tpz-th-order")).toHaveText("1")
    })

    test("shows a reset once sorted, which moves nothing and puts the rows back", async ({ page }) => {
      const table = configured(page)
      const arrived = await cellsOf(table, example.text.key)

      // Where the toolbar's search box sits within the table: the page may
      // scroll under a click, the box must not move within its toolbar.
      const searchOffset = async () => {
        const root = await table.root.boundingBox()
        const search = await table.search().boundingBox()
        return { left: (search?.x ?? 0) - (root?.x ?? 0), top: (search?.y ?? 0) - (root?.y ?? 0), width: search?.width }
      }
      const searchBefore = await searchOffset()

      await expect(reset(table)).toHaveCount(0)

      await sortControl(table, example.text.key).click()
      await sortControl(table, example.text.key).click()
      await expect(reset(table)).toBeVisible()
      await expect(reset(table)).toHaveAccessibleName("Reset sort")

      // It arrived at the near end of the toolbar's controls, so the search
      // box beside it is exactly where it was.
      expect(await searchOffset()).toEqual(searchBefore)

      await reset(table).click()

      await expect(reset(table)).toHaveCount(0)
      await expect(headerOf(table, example.text.key)).toHaveAttribute("aria-sort", "none")
      expect(await cellsOf(table, example.text.key)).toEqual(arrived)
    })

    test("keeps the keyboard's focus on a header across a sort", async ({ page, browserName }) => {
      test.skip(browserName === "webkit", "webkit does not focus a button that is clicked")
      const table = configured(page)

      const control = sortControl(table, example.text.key)
      await control.focus()
      await page.keyboard.press("Enter")
      await expect(headerOf(table, example.text.key)).toHaveAttribute("aria-sort", "ascending")
      await expect(control).toBeFocused()

      // Still there for the next press, which is the point.
      await page.keyboard.press("Enter")
      await expect(headerOf(table, example.text.key)).toHaveAttribute("aria-sort", "descending")
      await expect(control).toBeFocused()
    })

    test("shows the magnifier on hover without moving anything", async ({ page }) => {
      const table = configured(page)
      const header = headerOf(table, example.text.key)
      const glass = magnifier(table, example.text.key).locator(".tpz-th-glass")

      await page.mouse.move(0, 0)
      const atRest = await headerGeometry(table)
      await expect(glass).toHaveCSS("opacity", "0")

      await header.hover()
      await expect(glass).toHaveCSS("opacity", "1")
      expect(await headerGeometry(table)).toBe(atRest)

      // Open, the column is exactly as wide as it was: the label underneath
      // is still holding it there.
      await magnifier(table, example.text.key).click()
      await expect(box(table, example.text.key)).toBeFocused()
      expect(await headerGeometry(table)).toBe(atRest)

      // The box covers its header and nothing else.
      const cell = await header.boundingBox()
      const field = await header.locator(".tpz-th-searchbox").boundingBox()
      expect(Math.round(field?.width ?? 0)).toBeLessThanOrEqual(Math.round(cell?.width ?? 0))
      expect(Math.round(field?.height ?? 0)).toBeLessThanOrEqual(Math.round(cell?.height ?? 0))

      await page.keyboard.press("Escape")
      await expect(box(table, example.text.key)).toHaveCount(0)
      await page.mouse.move(0, 0)
      expect(await headerGeometry(table)).toBe(atRest)
    })

    test("searches one column as it is typed into, and keeps the box through every re-render", async ({ page }) => {
      const table = configured(page)
      const total = await table.count().innerText()

      await headerOf(table, example.text.key).hover()
      await magnifier(table, example.text.key).click()
      const input = box(table, example.text.key)
      await expect(input).toBeFocused()

      // Slower than the wait, so every character is applied — and the table
      // re-rendered — before the next one is typed.
      await input.pressSequentially(example.text.typed, { delay: 280 })

      await expect(input).toBeFocused()
      await expect(input).toHaveValue(example.text.typed)
      await expect(table.count()).not.toHaveText(total)

      const left = await cellsOf(table, example.text.key)
      expect(left.length).toBeGreaterThan(0)
      for (const value of left) expect(fold(value)).toContain(fold(example.text.typed))

      // It is the column's filter, so it shows as one.
      await expect(table.root.locator(".tpz-chip")).toContainText(`contains ${example.text.typed}`)
    })

    test("closes on Enter and stays closed, with the magnifier lit", async ({ page }) => {
      const table = configured(page)

      await headerOf(table, example.text.key).hover()
      await magnifier(table, example.text.key).click()
      await box(table, example.text.key).fill(example.text.typed)
      await page.keyboard.press("Enter")

      /*
        Stays closed. Focus goes back to the magnifier, which is a button, and
        Enter presses buttons — so a key that was not stopped would close the
        box and open it again in one stroke.
      */
      await expect(box(table, example.text.key)).toHaveCount(0)
      await page.waitForTimeout(250)
      await expect(box(table, example.text.key)).toHaveCount(0)

      await expect(magnifier(table, example.text.key)).toBeFocused()
      await expect(magnifier(table, example.text.key)).toHaveAttribute("data-active", "true")
      await page.mouse.move(0, 0)
      await expect(magnifier(table, example.text.key).locator(".tpz-th-glass")).toHaveCSS("opacity", "1")

      const left = await cellsOf(table, example.text.key)
      expect(left.length).toBeGreaterThan(0)
      for (const value of left) expect(fold(value)).toContain(fold(example.text.typed))

      // Opening it again shows what is being searched for.
      await magnifier(table, example.text.key).click()
      await expect(box(table, example.text.key)).toHaveValue(example.text.typed)

      // Escape empties it; Escape again closes it.
      await page.keyboard.press("Escape")
      await expect(box(table, example.text.key)).toHaveValue("")
      await expect(table.root.locator(".tpz-chip")).toHaveCount(0)
      await page.keyboard.press("Escape")
      await expect(box(table, example.text.key)).toHaveCount(0)
    })

    test("keeps what was typed when the pointer goes elsewhere", async ({ page }) => {
      const table = configured(page)

      await headerOf(table, example.text.key).hover()
      await magnifier(table, example.text.key).click()
      await box(table, example.text.key).fill(example.text.typed)

      // Straight to another header's sort control, inside the wait: the search
      // must apply, the box must close, and the click must still land.
      await sortControl(table, example.group.key).click()

      await expect(box(table, example.text.key)).toHaveCount(0)
      await expect(headerOf(table, example.group.key)).toHaveAttribute("aria-sort", "ascending")
      await expect(table.root.locator(".tpz-chip")).toContainText(`contains ${example.text.typed}`)
      for (const value of await cellsOf(table, example.text.key)) {
        expect(fold(value)).toContain(fold(example.text.typed))
      }
    })

    test("finds money and dates by what the cells show", async ({ page }) => {
      const table = configured(page)

      // The opening of the first figure on screen, symbol and all — "£94",
      // "$1," — which is in no stored number.
      const figure = ((await cellsOf(table, example.money.key))[0] ?? "").slice(0, 3)
      expect(figure).toMatch(/^\D/)

      await headerOf(table, example.money.key).hover()
      await magnifier(table, example.money.key).click()
      await box(table, example.money.key).fill(figure)
      await page.keyboard.press("Enter")

      const amounts = await cellsOf(table, example.money.key)
      expect(amounts.length).toBeGreaterThan(0)
      for (const value of amounts) expect(value).toContain(figure)

      // And the month the first of those rows shows, which is a word the
      // stored date does not contain.
      const month = /[A-Za-z]{3,}/.exec((await cellsOf(table, example.date.key))[0] ?? "")?.[0] ?? ""
      expect(month).not.toBe("")

      await headerOf(table, example.date.key).hover()
      await magnifier(table, example.date.key).click()
      await box(table, example.date.key).fill(month)
      await page.keyboard.press("Enter")

      const dates = await cellsOf(table, example.date.key)
      expect(dates.length).toBeGreaterThan(0)
      for (const value of dates) expect(value).toContain(month)

      // Both searches at once: the amounts still read as they did.
      for (const value of await cellsOf(table, example.money.key)) expect(value).toContain(figure)
      await expect(table.root.locator(".tpz-chip")).toHaveCount(2)
    })

    test("exports the searched rows in the sorted order", async ({ page }) => {
      const table = configured(page)

      await headerOf(table, example.text.key).hover()
      await magnifier(table, example.text.key).click()
      await box(table, example.text.key).fill(example.text.typed)
      await page.keyboard.press("Enter")

      await sortControl(table, example.group.key).click()
      await sortControl(table, example.text.key).click({ modifiers: ["Shift"] })
      await sortControl(table, example.text.key).click({ modifiers: ["Shift"] })
      await expect(headerOf(table, example.text.key)).toHaveAttribute("aria-sort", "descending")

      const text = await downloadedText(page, async () => {
        await table.root.getByRole("button", { name: "Export" }).click()
        await page.locator(".tpz-portal").getByRole("button", { name: /Download CSV/i }).click()
      })

      const [heading = "", ...lines] = text.replace(/^﻿/, "").trim().split("\r\n")
      const at = heading.split(",").indexOf(example.text.header)
      expect(at, `${example.text.header} in ${heading}`).toBeGreaterThanOrEqual(0)

      // Every matching row is in the file, not just the page — and each says
      // what was searched for. (Names here hold no commas, so a split is safe.)
      const total = Number((await table.count().innerText()).replace(/\D/g, ""))
      expect(lines).toHaveLength(total)
      for (const line of lines) expect(fold(line.split(",")[at] ?? "")).toContain(fold(example.text.typed))

      // And the page on screen is the top of the file, in the same order.
      const shown = await cellsOf(table, example.text.key)
      expect(lines.slice(0, shown.length).map((line) => line.split(",")[at])).toEqual(shown)
    })
  })
}

/* ── Accessibility, with the new controls on screen ──────────────────────── */

for (const theme of ["light", "dark"] as const) {
  test(`has no violations with a search box open and three sort levels, in ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme })
    await page.goto("http://localhost:4330/")
    const table = configured(page)
    await expect(table.rows().first()).toBeVisible()

    await sortControl(table, "team").click()
    await sortControl(table, "name").click({ modifiers: ["Shift"] })
    await sortControl(table, "salary").click({ modifiers: ["Shift"] })

    await headerOf(table, "email").hover()
    await magnifier(table, "email").click()
    await box(table, "email").fill("example")
    await expect(table.root.locator(".tpz-chip")).toHaveCount(1)

    const scan = () => new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()

    // Open, with the box focused…
    expect((await scan()).violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([])

    // …and closed, with the magnifier lit and the reset on screen.
    await page.keyboard.press("Enter")
    await expect(reset(table)).toBeVisible()
    expect((await scan()).violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([])
  })
}

test("reaches the magnifier, the box and the reset with the keyboard alone", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "webkit does not tab to buttons by default")

  await page.goto("http://localhost:4330/")
  const table = configured(page)
  await expect(table.rows().first()).toBeVisible()

  // The magnifier leads its header, where the type icon is.
  await magnifier(table, "email").focus()
  await expect(magnifier(table, "email").locator(".tpz-th-glass")).toHaveCSS("opacity", "1")
  await page.keyboard.press("Enter")
  await expect(box(table, "email")).toBeFocused()

  await page.keyboard.type("ada")
  await page.keyboard.press("Enter")
  await expect(magnifier(table, "email")).toBeFocused()
  for (const value of await cellsOf(table, "email")) expect(value).toContain("ada")

  // On from the magnifier to the sort control beside it, then sort.
  await page.keyboard.press("Tab")
  await expect(sortControl(table, "email")).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(headerOf(table, "email")).toHaveAttribute("aria-sort", "ascending")

  await reset(table).focus()
  await page.keyboard.press("Enter")
  await expect(headerOf(table, "email")).toHaveAttribute("aria-sort", "none")
})

/* ── The examples whose view lives in the URL ────────────────────────────── */

const LINKED = [
  { name: "sveltekit", url: "http://localhost:4340/" },
  { name: "nuxt", url: "http://localhost:4350/" },
  { name: "react-router", url: "http://localhost:4360/" },
] as const

/** Waits for the live table: a server cannot measure, so a measured offset means the script is in. */
async function hydrated(table: Table): Promise<void> {
  await expect
    .poll(() => table.root.locator('thead th[data-key="name"]').evaluate((cell) => (cell as HTMLElement).style.left))
    .toMatch(/^[1-9]\d*px$/)
}

const sortParam = (page: Page) => new URL(page.url()).searchParams.get("sort")

/** The filter parameter as written: each value in it is percent-encoded once more, so separators inside one cannot split it. */
const filterParam = (page: Page) => {
  const raw = new URL(page.url()).searchParams.get("f")
  return raw === null ? null : decodeURIComponent(raw)
}

async function link(locator: Locator): Promise<string> {
  return (await locator.getAttribute("href")) ?? ""
}

for (const example of LINKED) {
  test.describe(example.name, () => {
    test.describe("before any JavaScript", () => {
      test.use({ javaScriptEnabled: false })

      test("renders a sort of several levels, and a link that resets it", async ({ page }) => {
        await page.goto(`${example.url}?sort=team%3Aasc%2Cname%3Adesc`)
        const table = new Table(page)

        await expect(headerOf(table, "team").locator(".tpz-th-order")).toHaveText("1")
        await expect(headerOf(table, "name").locator(".tpz-th-order")).toHaveText("2")

        // Already in order when it arrived.
        const teams = await cellsOf(table, "team")
        expect(teams).toEqual([...teams].sort((a, b) => a.localeCompare(b)))

        const control = reset(table)
        await expect(control).toBeVisible()
        expect(new URL(await link(control), example.url).searchParams.get("sort")).toBeNull()

        await control.click()
        await expect(page).not.toHaveURL(/sort=/)
        await expect(reset(new Table(page))).toHaveCount(0)
        await expect(headerOf(new Table(page), "team")).toHaveAttribute("aria-sort", "none")
      })

      test("renders a search the URL carries, and the magnifiers", async ({ page }) => {
        // The month the first row shows: a word no stored date contains.
        await page.goto(example.url)
        const month = /[A-Za-z]{3,}/.exec((await cellsOf(new Table(page), "started"))[0] ?? "")?.[0] ?? ""
        expect(month).not.toBe("")

        await page.goto(`${example.url}?f=started%3Acontains%3A${month}`)
        const table = new Table(page)

        const dates = await cellsOf(table, "started")
        expect(dates.length).toBeGreaterThan(0)
        for (const value of dates) expect(value).toContain(month)

        await expect(magnifier(table, "started")).toHaveAttribute("data-active", "true")
        // The box is opened by a click; a server never sends one.
        await expect(table.root.locator(".tpz-th-searchbox")).toHaveCount(0)
        expect(await table.root.locator(".tpz-th-search").count()).toBeGreaterThan(3)
      })
    })

    test.describe("with JavaScript", () => {
      test("adds a sort level to the URL on a shift-click, without opening a window", async ({ page, context }) => {
        await page.goto(example.url)
        const table = new Table(page)
        await hydrated(table)

        await sortControl(table, "team").click()
        await expect.poll(() => sortParam(page)).toBe("team:asc")

        await sortControl(table, "name").click({ modifiers: ["Shift"] })
        await expect.poll(() => sortParam(page)).toBe("team:asc,name:asc")
        expect(context.pages()).toHaveLength(1)

        await expect(headerOf(table, "name").locator(".tpz-th-order")).toHaveText("2")

        // The reset is a link to the same view without the sort, and following it works.
        await reset(table).click()
        await expect.poll(() => sortParam(page)).toBeNull()
        await expect(reset(table)).toHaveCount(0)

        // And the back button undoes that.
        await page.goBack()
        await expect.poll(() => sortParam(page)).toBe("team:asc,name:asc")
        await expect(headerOf(new Table(page), "team").locator(".tpz-th-order")).toHaveText("1")
      })

      test("puts a header search in the URL, and keeps the box while the route changes", async ({ page }) => {
        await page.goto(example.url)
        const table = new Table(page)
        await hydrated(table)

        const month = /[A-Za-z]{3,}/.exec((await cellsOf(table, "started"))[0] ?? "")?.[0] ?? ""
        expect(month).not.toBe("")

        await headerOf(table, "started").hover()
        await magnifier(table, "started").click()
        const input = box(table, "started")
        // Slower than the wait, so the route changes between keystrokes.
        await input.pressSequentially(month, { delay: 250 })

        await expect.poll(() => filterParam(page)).toBe(`started:contains:${month}`)
        await expect(input).toBeFocused()
        await expect(input).toHaveValue(month)

        for (const value of await cellsOf(table, "started")) expect(value).toContain(month)

        // A reload lands on the same search.
        await page.reload()
        const again = new Table(page)
        await expect(magnifier(again, "started")).toHaveAttribute("data-active", "true")
        for (const value of await cellsOf(again, "started")) expect(value).toContain(month)
      })
    })
  })
}

/* ── Sorting and searching done by a server ──────────────────────────────── */

test.describe("next, with the data on a server", () => {
  const NEXT = "http://localhost:4300/"

  test.describe("before any JavaScript", () => {
    test.use({ javaScriptEnabled: false })

    test("renders the levels and a reset link, and the link resets", async ({ page }) => {
      await page.goto(`${NEXT}?sort=status%3Aasc%2Camount%3Adesc`)
      const table = new Table(page)

      await expect(headerOf(table, "status").locator(".tpz-th-order")).toHaveText("1")
      await expect(headerOf(table, "amount").locator(".tpz-th-order")).toHaveText("2")
      await expect(reset(table)).toBeVisible()

      await reset(table).click()
      await expect(page).not.toHaveURL(/sort=/)
      await expect(reset(new Table(page))).toHaveCount(0)
    })

    test("answers a header search on the server, by what the cells show", async ({ page }) => {
      // "Jan" is nowhere in a stored timestamp: only the formatted date says it.
      await page.goto(`${NEXT}?f=issued_at%3Acontains%3AJan`)
      const table = new Table(page)

      const dates = await cellsOf(table, "issued_at")
      expect(dates.length).toBeGreaterThan(0)
      for (const value of dates) expect(value).toContain("Jan")
      await expect(magnifier(table, "issued_at")).toHaveAttribute("data-active", "true")
    })
  })

  test.describe("with JavaScript", () => {
    test("asks the server for a second sort level on a shift-click", async ({ page, context }) => {
      await page.goto(NEXT)
      const table = new Table(page)
      await expect(table.rows().first()).toBeVisible()

      await sortControl(table, "status").click()
      await expect.poll(() => sortParam(page)).toBe("status:asc")

      await sortControl(table, "amount").click({ modifiers: ["Shift"] })
      await expect.poll(() => sortParam(page)).toBe("status:asc,amount:asc")
      expect(context.pages()).toHaveLength(1)

      await expect(headerOf(table, "amount").locator(".tpz-th-order")).toHaveText("2")

      // The server did the sorting: within the first status, amounts ascend.
      const statuses = await cellsOf(table, "status")
      const amounts = (await cellsOf(table, "amount")).map((value) => Number(value.replace(/[^\d.]/g, "")))
      for (let index = 1; index < statuses.length; index += 1) {
        if (statuses[index] === statuses[index - 1]) {
          expect(amounts[index]).toBeGreaterThanOrEqual(amounts[index - 1] ?? 0)
        }
      }

      await reset(table).click()
      await expect.poll(() => sortParam(page)).toBeNull()
    })

    test("asks the server for a header search, and keeps the box while it answers", async ({ page }) => {
      await page.goto(NEXT)
      const table = new Table(page)
      await expect(table.rows().first()).toBeVisible()

      await headerOf(table, "amount").hover()
      await magnifier(table, "amount").click()
      const input = box(table, "amount")
      await input.pressSequentially("$1,", { delay: 120 })

      await expect.poll(() => filterParam(page)).toBe("amount:contains:$1,")
      await expect(input).toBeFocused()
      await expect(input).toHaveValue("$1,")

      await expect
        .poll(async () => (await cellsOf(table, "amount")).every((value) => value.startsWith("$1,")))
        .toBe(true)
      expect((await cellsOf(table, "amount")).length).toBeGreaterThan(0)
    })
  })
})
