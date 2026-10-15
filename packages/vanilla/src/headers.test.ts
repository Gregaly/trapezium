/**
 * @vitest-environment jsdom
 *
 * Header renderers and column descriptions in the DOM renderer.
 */
import axe from "axe-core"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { el } from "./dom.js"
import { renderToString } from "./render-to-string.js"
import { createTable, type TableOptions } from "./table.js"

type Item = { id: string; name: string; amount: number }
const items: Item[] = [
  { id: "a", name: "Anvil", amount: 30 },
  { id: "b", name: "Bucket", amount: 10 },
]

let host: HTMLElement
beforeEach(() => {
  host = document.createElement("div")
  document.body.append(host)
})
afterEach(() => {
  host.remove()
  document.querySelectorAll(".tpz-portal").forEach((node) => node.remove())
})

describe("renderHeader", () => {
  it("draws the header's text, follows the sort, and keeps the controls around it", () => {
    const table = createTable(host, {
      data: items,
      columns: [
        "name",
        {
          key: "amount",
          renderHeader: ({ column, sort }) =>
            el("span", { class: "custom", text: `${column.header} AUD${sort ? ` (${sort.direction})` : ""}` }),
        },
      ],
    })
    expect(host.querySelector('th[data-key="amount"] .custom')?.textContent).toBe("Amount AUD")
    const button = host.querySelector<HTMLButtonElement>('th[data-key="amount"] .tpz-th-button')
    expect(button?.getAttribute("aria-label")).toBe("Amount")

    button?.click()
    expect(host.querySelector('th[data-key="amount"]')?.getAttribute("aria-sort")).toBe("ascending")
    expect(host.querySelector('th[data-key="amount"] .custom')?.textContent).toBe("Amount AUD (asc)")
    // The same button: the header was patched, not rebuilt.
    expect(host.querySelector('th[data-key="amount"] .tpz-th-button')).toBe(button)
    expect(host.querySelector('th[data-key="amount"] .tpz-th-menu')).toBeTruthy()
    void table
  })

  it("is written by a server, as the client writes it", () => {
    const options: TableOptions<Item> = {
      data: items,
      columns: [{ key: "amount", renderHeader: () => el("b", { class: "custom", text: "Amount (AUD)" }) }],
    }
    const html = renderToString(options)
    expect(html).toContain('<b class="custom">Amount (AUD)</b>')
    const table = createTable(host, options)
    expect(host.innerHTML).toBe(html)
    table.destroy()
  })
})

describe("description", () => {
  it("is linked to the header, and shown as a tooltip while the header has the keyboard", async () => {
    createTable(host, { data: items, id: "items", columns: [{ key: "amount", description: "Excludes tax" }] })
    const button = host.querySelector<HTMLElement>('th[data-key="amount"] .tpz-th-button')
    expect(button?.getAttribute("aria-describedby")).toBe("items-desc-amount")
    expect(document.getElementById("items-desc-amount")?.textContent).toBe("Excludes tax")
    expect(host.querySelector('th[data-key="amount"]')?.getAttribute("data-described")).toBe("true")

    button?.focus()
    await vi.waitFor(() => expect(document.querySelector(".tpz-tooltip")?.textContent).toBe("Excludes tax"))
    button?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    expect(document.querySelector(".tpz-tooltip")).toBeNull()
  })

  it("passes the automated accessibility checks", async () => {
    createTable(host, { data: items, columns: [{ key: "amount", description: "Excludes tax" }, "name"] })
    const results = await axe.run(host, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } })
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })
})

describe("renderHeaderControls", () => {
  const header = (key: string) => host.querySelector<HTMLTableCellElement>(`th[data-key="${key}"]`)

  it("draws controls beside the text, outside the sort control and before the menu", () => {
    createTable(host, {
      data: items,
      columns: [{ key: "name", renderHeaderControls: () => el("button", { type: "button", text: "Pick" }) }, "amount"],
    })
    const cell = header("name")
    const controls = cell?.querySelector(".tpz-th-controls")
    expect(controls?.textContent).toBe("Pick")
    expect(cell?.querySelector(".tpz-th-button")?.contains(controls ?? null)).toBe(false)
    const order = [...(cell?.querySelector(".tpz-th-inner")?.children ?? [])].map((child) => child.className)
    expect(order.indexOf("tpz-th-controls")).toBeGreaterThan(order.indexOf("tpz-th-button"))
    expect(order.indexOf("tpz-th-controls")).toBeLessThan(order.indexOf("tpz-th-menu"))
    expect(cell?.dataset["controls"]).toBe("true")
    expect(header("amount")?.dataset["controls"]).toBeUndefined()
  })

  it("never sorts the column from a click in them", () => {
    createTable(host, {
      data: items,
      columns: [{ key: "name", renderHeaderControls: () => el("button", { type: "button", text: "Pick" }) }],
    })
    header("name")?.querySelector<HTMLButtonElement>(".tpz-th-controls button")?.click()
    expect(header("name")?.getAttribute("aria-sort")).toBe("none")
  })

  it("keeps a node it is given back — with its focus — while the table changes around it", () => {
    const input = el("input", { "aria-label": "Search names" }) as HTMLInputElement
    const table = createTable(host, {
      data: items,
      columns: [{ key: "name", renderHeaderControls: () => input }, "amount"],
    })
    input.focus()
    input.value = "buc"
    // A change of state: a sort on another column, then a search.
    header("amount")?.querySelector<HTMLButtonElement>(".tpz-th-button")?.click()
    table.setState({ search: "buc" })

    expect(header("name")?.querySelector(".tpz-th-controls input")).toBe(input)
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe("buc")
  })

  it("replaces what it drew when the renderer hands back something new, and follows the sort", () => {
    createTable(host, {
      data: items,
      columns: [{ key: "name", renderHeaderControls: ({ sort }) => el("span", { text: sort ? sort.direction : "none" }) }],
    })
    expect(header("name")?.querySelector(".tpz-th-controls")?.textContent).toBe("none")
    header("name")?.querySelector<HTMLButtonElement>(".tpz-th-button")?.click()
    expect(header("name")?.querySelector(".tpz-th-controls")?.textContent).toBe("asc")
  })

  it("stops the header being a handle while a control is pressed, so text can be selected", () => {
    createTable(host, { data: items, columns: [{ key: "name", renderHeaderControls: () => el("input", {}) }] })
    expect(header("name")?.draggable).toBe(true)
    header("name")?.querySelector(".tpz-th-controls input")?.dispatchEvent(new Event("pointerdown", { bubbles: true }))
    expect(header("name")?.draggable).toBe(false)
    window.dispatchEvent(new Event("pointerup"))
    expect(header("name")?.draggable).toBe(true)
  })

  it("hides the slot when there is nothing to draw", () => {
    createTable(host, { data: items, columns: [{ key: "name", renderHeaderControls: () => "" }] })
    expect(header("name")?.querySelector(".tpz-th-controls")?.hasAttribute("hidden")).toBe(true)
    expect(header("name")?.dataset["controls"]).toBeUndefined()
  })

  it("is written by a server, as the client writes it", () => {
    const options: TableOptions<Item> = {
      data: items,
      columns: [{ key: "name", renderHeaderControls: () => el("button", { type: "button", text: "Pick" }) }],
    }
    const html = renderToString(options)
    expect(html).toContain('<button type="button">Pick</button>')
    const table = createTable(host, options)
    expect(host.innerHTML).toBe(html)
    table.destroy()
  })

  it("passes the automated accessibility checks", async () => {
    createTable(host, {
      data: items,
      columns: [{ key: "name", renderHeaderControls: () => el("input", { "aria-label": "Search names" }) }, "amount"],
    })
    const results = await axe.run(host, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } })
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })
})
