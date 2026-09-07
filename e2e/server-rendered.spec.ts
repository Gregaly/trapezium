import { expect, test, type Page } from "@playwright/test"

import { Table } from "./table.js"

/**
 * The meta-framework examples: the table on a server, in Svelte, Vue and React
 * Router.
 *
 * The Next example proves this for React on its own. These prove it for the
 * rest — the first paint is already the right table, every control is a link
 * that works before any script has arrived, and once the script has arrived
 * the live table takes over without moving anything.
 */

const EXAMPLES = [
  { name: "sveltekit", url: "http://localhost:4340/" },
  { name: "nuxt", url: "http://localhost:4350/" },
  { name: "react-router", url: "http://localhost:4360/" },
] as const

/** The server's markup for a URL, as the browser would parse it. */
async function serverMarkup(page: Page, url: string): Promise<string> {
  const html = await (await page.request.get(url)).text()
  return page.evaluate((source) => {
    const parsed = new DOMParser().parseFromString(source, "text/html")
    return parsed.querySelector(".tpz")?.outerHTML ?? ""
  }, html)
}

/**
 * Waits until the live table has replaced the server markup.
 *
 * The two are the same bytes, so there is nothing to look for in the markup
 * itself — except that a server cannot measure, and the live table can. The
 * second frozen column sits at the width of the first once the browser has
 * measured it, and at zero until then.
 */
async function hydrated(table: Table): Promise<void> {
  await expect
    .poll(() => table.root.locator('thead th[data-key="name"]').evaluate((cell) => cell.style.left))
    .not.toBe("0px")
}

/**
 * Markup with the measured offsets taken out, which are the one thing a server
 * cannot write. React writes none at all until it has measured, so an offset
 * that is the whole of a style attribute goes too.
 */
const unmeasured = (html: string) => html.replace(/ style="left: \d+px;"/g, "").replace(/left: \d+px;/g, "left: 0px;")

for (const example of EXAMPLES) {
  test.describe(example.name, () => {
    test.describe("before any JavaScript", () => {
      test.use({ javaScriptEnabled: false })

      test("renders the right rows on the first paint", async ({ page }) => {
        await page.goto(example.url)
        const table = new Table(page)

        await expect(table.rows()).toHaveCount(15)
        await expect(table.count()).toContainText("120 rows")
      })

      test("sorts by following a link", async ({ page }) => {
        await page.goto(example.url)
        const table = new Table(page)

        const before = await table.column("Name")
        await table.header("Name").getByRole("link").first().click()

        const after = await table.column("Name")
        expect(after).not.toEqual(before)
        expect(after).toEqual([...after].sort())
        await expect(table.header("Name")).toHaveAttribute("aria-sort", "ascending")
        await expect(page).toHaveURL(/sort=name/)
      })

      test("pages by following a link", async ({ page }) => {
        await page.goto(example.url)
        const table = new Table(page)

        const first = await table.column("Email")
        await table.root.getByRole("link", { name: "Next page" }).click()

        expect(await table.column("Email")).not.toEqual(first)
        await expect(page).toHaveURL(/page=2/)
      })

      test("renders the view the URL describes", async ({ page }) => {
        await page.goto(`${example.url}?sort=name%3Adesc&page=2`)
        const table = new Table(page)

        const names = await table.column("Name")
        expect(names).toEqual([...names].sort().reverse())
        await expect(table.root.getByRole("link", { name: "Page 2", exact: true })).toHaveAttribute("aria-current", "page")
      })
    })

    test.describe("with JavaScript", () => {
      test("hydrates into the same markup the server sent", async ({ page }) => {
        const complaints: string[] = []
        page.on("console", (message) => {
          if (["warning", "error"].includes(message.type())) complaints.push(message.text())
        })

        await page.goto(example.url)
        const table = new Table(page)
        await expect(table.rows()).toHaveCount(15)
        await hydrated(table)

        const server = await serverMarkup(page, example.url)
        const client = await table.root.evaluate((node) => node.outerHTML)
        expect(unmeasured(client)).toBe(unmeasured(server))

        expect(complaints.filter((text) => /hydrat|mismatch/i.test(text))).toEqual([])
      })

      test("sorts, pages and searches once the script has arrived", async ({ page }) => {
        await page.goto(example.url)
        const table = new Table(page)
        await hydrated(table)

        await table.header("Name").getByRole("link").first().click()
        await expect(page).toHaveURL(/sort=name/)
        // The URL changes first; the rows follow once the router has loaded.
        await expect(table.header("Name")).toHaveAttribute("aria-sort", "ascending")
        const names = await table.column("Name")
        expect(names).toEqual([...names].sort())

        await table.search().fill("ada")
        await expect(page).toHaveURL(/q=ada/, { timeout: 15_000 })
        await expect(table.rows()).not.toHaveCount(15)
        for (const row of await table.cells()) expect(row.join(" ").toLowerCase()).toContain("ada")
      })

      test("keeps a selection while the URL changes", async ({ page }) => {
        await page.goto(example.url)
        const table = new Table(page)
        await hydrated(table)

        const enabled = table.rows().getByRole("checkbox").and(page.locator(":enabled"))
        await enabled.first().check()
        await expect(table.count()).toHaveText("1 selected")

        await table.header("Name").getByRole("link").first().click()
        await expect(page).toHaveURL(/sort=name/)
        await expect(table.count()).toHaveText("1 selected")
      })
    })
  })
}
