import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

import { Table } from "./table.js"

/**
 * An axe pass over every example, in a real browser.
 *
 * The unit suites check the semantics an adapter emits; this checks what a
 * browser actually computes from them — contrast against the stylesheet that
 * really loaded, names on controls that are really rendered, and the state of a
 * menu that is really open.
 */

const PAGES = [
  { name: "next (react)", url: "http://localhost:4300/", column: "Customer" },
  { name: "vue", url: "http://localhost:4310/", column: "Name" },
  { name: "svelte", url: "http://localhost:4320/", column: "Name" },
  { name: "plain javascript", url: "http://localhost:4330/", column: "Name" },
  { name: "playground (react)", url: "http://localhost:4330/examples/playground/dist/", column: "Customer" },
]

/** WCAG 2.1 A and AA, which is the promise the documentation makes. */
const scan = (page: import("@playwright/test").Page) =>
  new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])

for (const example of PAGES) {
  test.describe(example.name, () => {
    test("has no violations as it loads", async ({ page }) => {
      await page.goto(example.url)
      await expect(page.locator(".tpz tbody tr").first()).toBeVisible()

      const { violations } = await scan(page).analyze()
      expect(violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([])
    })

    test("has no violations with a column menu open", async ({ page }) => {
      await page.goto(example.url)
      const table = new Table(page, page.locator(".tpz").filter({ has: page.locator(".tpz-search") }).first())
      await expect(table.rows().first()).toBeVisible()

      // The menus are portalled to the body, so they are the part most easily
      // left out of an accessibility pass — and the part most full of controls.
      await table.openMenu(example.column)

      const { violations } = await scan(page).analyze()
      expect(violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([])
    })
  })
}

test.describe("keyboard", () => {
  test("reaches every control in the toolbar and the header", async ({ page, browserName }) => {
    /*
      Not WebKit: it only tabs to form fields unless the operating system has
      "Full Keyboard Access" switched on, so a tab order assertion there tests
      Safari's setting rather than this table's markup. Everything the test
      checks is engine-independent, and two engines check it.
    */
    test.skip(browserName === "webkit", "webkit does not tab to buttons by default")

    await page.goto("http://localhost:4330/")
    const table = new Table(page, page.locator(".tpz").filter({ has: page.locator(".tpz-search") }).first())
    await expect(table.rows().first()).toBeVisible()

    await table.search().focus()

    // Twenty tabs is well past the toolbar and into the header; nothing along
    // the way may swallow focus or leave it on the document body.
    const reached = new Set<string>()
    for (let step = 0; step < 20; step += 1) {
      await page.keyboard.press("Tab")
      reached.add(
        await page.evaluate(() => {
          const node = document.activeElement
          if (!node || node === document.body) return "body"
          return `${node.tagName.toLowerCase()}.${node.className.toString().split(" ")[0] ?? ""}`
        }),
      )
    }

    expect(reached.has("body")).toBe(false)
    expect(reached.size).toBeGreaterThan(4)
  })

  test("opens a column menu and closes it again with the keyboard alone", async ({ page }) => {
    await page.goto("http://localhost:4330/")
    const table = new Table(page, page.locator(".tpz").filter({ has: page.locator(".tpz-search") }).first())
    await expect(table.rows().first()).toBeVisible()

    const menu = table.root.getByRole("button", { name: /Name column options/i })
    await menu.focus()
    await page.keyboard.press("Enter")
    await expect(page.locator(".tpz-portal")).toHaveCount(1)

    await page.keyboard.press("Escape")
    await expect(page.locator(".tpz-portal")).toHaveCount(0)

    // Focus comes back to where it was, rather than being dropped on the body.
    await expect(menu).toBeFocused()
  })
})
