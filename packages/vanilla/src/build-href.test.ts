/**
 * @vitest-environment jsdom
 *
 * A table whose controls are links.
 *
 * With `buildHref` the header sorts and the pagination pages by navigation,
 * which is what lets a server-rendered page work before its script arrives.
 * The React adapter has always done this; the DOM renderer — and so Vue,
 * Svelte and plain JavaScript — must render the same anchors.
 */
import { createState, hideColumn, stateToQueryString } from "@trapezium/core"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { renderToString } from "./render-to-string.js"
import { createTable } from "./table.js"

const people = Array.from({ length: 30 }, (_, index) => ({
  id: String(index + 1),
  name: `Person ${String(index + 1).padStart(2, "0")}`,
  plan: index % 2 === 0 ? "pro" : "free",
}))

const href = (state: Parameters<typeof stateToQueryString>[0]) => `/people?${stateToQueryString(state)}`

let host: HTMLElement

beforeEach(() => {
  host = document.createElement("div")
  document.body.append(host)
})

afterEach(() => {
  host.remove()
  document.querySelectorAll(".tpz-portal").forEach((node) => node.remove())
})

describe("with buildHref", () => {
  it("makes each sortable header a link to the sorted view", () => {
    createTable(host, { data: people, columns: ["name", "plan"], buildHref: href })

    const link = host.querySelector<HTMLAnchorElement>("thead th a.tpz-th-button")
    expect(link?.getAttribute("href")).toBe("/people?sort=name%3Aasc")
    expect(link?.getAttribute("aria-label")).toBe("Sort by Name")
    expect(host.querySelector("thead button.tpz-th-button")).toBeNull()
  })

  it("carries the current view into every link, and cycles the sort", () => {
    createTable(host, {
      data: people,
      columns: ["name"],
      buildHref: href,
      state: { sort: [{ key: "name", direction: "asc" }], search: "per" },
    })

    expect(host.querySelector("thead a.tpz-th-button")?.getAttribute("href")).toBe("/people?sort=name%3Adesc&q=per")
  })

  it("pages by link, with the current page marked and the edges left as disabled buttons", () => {
    createTable(host, { data: people, columns: ["name"], pagination: { pageSize: 10 }, buildHref: href })

    const nav = host.querySelector(".tpz-pages")!
    const links = [...nav.querySelectorAll("a")].map((a) => [a.getAttribute("aria-label"), a.getAttribute("href")])
    // Ten a page is not the default, so every link carries the size too.
    expect(links).toEqual([
      ["Page 1", "/people?size=10"],
      ["Page 2", "/people?page=2&size=10"],
      ["Page 3", "/people?page=3&size=10"],
      ["Next page", "/people?page=2&size=10"],
    ])
    expect(nav.querySelector('[aria-current="page"]')?.getAttribute("aria-label")).toBe("Page 1")
    // There is no page before the first, so that one stays a disabled button.
    expect(nav.querySelector("button[disabled]")?.getAttribute("aria-label")).toBe("Previous page")
  })

  it("puts the sort and hide actions in the menu as links, and leaves the rest as buttons", () => {
    createTable(host, { data: people, columns: ["name", "plan"], buildHref: href })
    host.querySelector<HTMLButtonElement>(".tpz-th-menu")!.click()

    const items = [...document.querySelectorAll<HTMLElement>(".tpz-portal [data-menu-item]")].map((node) => [
      node.tagName,
      node.textContent?.trim(),
      node.getAttribute("href"),
    ])
    expect(items).toContainEqual(["A", "Sort ascending", "/people?sort=name%3Aasc"])
    expect(items).toContainEqual(["A", "Sort descending", "/people?sort=name%3Adesc"])
    expect(items).toContainEqual(["A", "Hide column", href(hideColumn(createState(), "name"))])
    expect(items).toContainEqual(["BUTTON", "Move right", null])
  })

  it("does not also sort in place: the link is the whole action", () => {
    createTable(host, { data: people, columns: ["name"], buildHref: href })
    const link = host.querySelector<HTMLAnchorElement>("thead a.tpz-th-button")!
    link.addEventListener("click", (event) => event.preventDefault())
    link.click()

    expect(host.querySelector("thead th")?.getAttribute("aria-sort")).toBe("none")
  })

  it("renders the same links on a server", () => {
    const html = renderToString({ data: people, columns: ["name"], pagination: { pageSize: 10 }, buildHref: href })
    expect(html).toContain('<a href="/people?sort=name%3Aasc&amp;size=10" class="tpz-th-button" aria-label="Sort by Name">')
    expect(html).toContain('<a href="/people?page=2&amp;size=10" class="tpz-btn tpz-page" aria-label="Next page">')
  })
})
