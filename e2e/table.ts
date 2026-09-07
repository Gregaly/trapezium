import { readFile } from "node:fs/promises"

import { expect, type Locator, type Page } from "@playwright/test"

/**
 * A table, as a test talks to it.
 *
 * Every adapter renders the same markup and the same class names, so one helper
 * drives all four examples — which is also the point: if this file needs a
 * special case for one framework, that framework has drifted.
 */
export class Table {
  readonly root: Locator

  constructor(
    readonly page: Page,
    root?: Locator,
  ) {
    this.root = root ?? page.locator(".tpz").first()
  }

  /** The nth table on a page that has several. */
  static nth(page: Page, index: number): Table {
    return new Table(page, page.locator(".tpz").nth(index))
  }

  rows(): Locator {
    return this.root.locator("tbody tr:not([aria-hidden='true'])")
  }

  /** The text of every cell, row by row. */
  async cells(): Promise<string[][]> {
    return this.rows().evaluateAll((rows) =>
      rows.map((row) => [...row.querySelectorAll("td")].map((cell) => cell.textContent?.trim() ?? "")),
    )
  }

  /** One column's text, top to bottom, by its header name. */
  async column(header: string): Promise<string[]> {
    const index = await this.columnIndex(header)
    return this.rows().evaluateAll(
      (rows, at) => rows.map((row) => row.querySelectorAll("td")[at]?.textContent?.trim() ?? ""),
      index,
    )
  }

  async columnIndex(header: string): Promise<number> {
    return this.root.locator("thead th").evaluateAll(
      (cells, name) => cells.findIndex((cell) => cell.textContent?.trim() === name),
      header,
    )
  }

  header(name: string): Locator {
    return this.root.locator("thead th").filter({ hasText: name }).first()
  }

  /**
   * Opens a column's menu and returns the panel, which is portalled to the body.
   *
   * Retried, because on a server-rendered page the button is on screen before
   * the script that makes it work has arrived, and a click before then does
   * nothing.
   */
  async openMenu(column: string): Promise<Locator> {
    const trigger = this.root.getByRole("button", { name: new RegExp(`${column} column options`, "i") })
    const panel = this.page.locator(".tpz-portal").last()
    await expect(async () => {
      await trigger.click()
      await expect(panel).toBeVisible({ timeout: 1_000 })
    }).toPass({ timeout: 30_000 })
    return panel
  }

  async closeMenus(): Promise<void> {
    await this.page.keyboard.press("Escape")
    await this.page.locator(".tpz-portal").waitFor({ state: "detached" }).catch(() => {})
  }

  search(): Locator {
    return this.root.getByRole("searchbox").first()
  }

  count(): Locator {
    return this.root.locator(".tpz-count").first()
  }

  nextPage(): Locator {
    return this.root.getByRole("button", { name: "Next page" })
  }

  /** The scrolling viewport around the table. */
  scroller(): Locator {
    return this.root.locator(".tpz-scroll").first()
  }
}

/**
 * Reads a downloaded file as text, whichever way the browser delivered it.
 *
 * Through the finished file rather than a stream: Firefox has handed the
 * stream over while it was still writing, and a test then read one line of a
 * forty-line export.
 */
export async function downloadedText(page: Page, trigger: () => Promise<void>): Promise<string> {
  const [download] = await Promise.all([page.waitForEvent("download"), trigger()])
  const path = await download.path()
  return readFile(path, "utf8")
}
