/**
 * @vitest-environment jsdom
 *
 * Sorting by several columns, and getting back — in the DOM renderer, which is
 * also Vue's and Svelte's.
 *
 * A shift-click adds a level; the headers say which level each one is; a
 * reset in the toolbar returns the table to the order it rests in. And because
 * this renderer rebuilds its body on every change, it also has to prove the
 * thing React gets for nothing: that the header a person is working stays put
 * underneath them.
 */
import { applyStateToUrl, stateFromUrl, type TableState } from "@trapezium/core"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { renderToString } from "./render-to-string.js"
import { createTable, type TableOptions } from "./table.js"

type Person = { id: string; name: string; team: string; level: number }

const staff: Person[] = [
  { id: "1", name: "Ada", team: "Eng", level: 2 },
  { id: "2", name: "Bea", team: "Ops", level: 1 },
  { id: "3", name: "Cy", team: "Eng", level: 3 },
  { id: "4", name: "Dee", team: "Eng", level: 2 },
  { id: "5", name: "Abe", team: "Ops", level: 1 },
  { id: "6", name: "Bo", team: "Eng", level: 3 },
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

const base: TableOptions<Person> = {
  data: staff,
  columns: ["name", "team", "level"],
  getRowId: (person) => person.id,
  pagination: false,
}

function setup(options: Partial<TableOptions<Person>> = {}) {
  return createTable(host, { ...base, ...options })
}

const names = () => [...host.querySelectorAll("tbody tr")].map((row) => row.querySelector("td")?.textContent?.trim() ?? "")

function header(key: string): HTMLElement {
  const cell = host.querySelector<HTMLElement>(`thead th[data-key="${key}"]`)
  if (!cell) throw new Error(`no ${key} header`)
  return cell
}

function sortControl(key: string): HTMLElement {
  const control = header(key).querySelector<HTMLElement>(".tpz-th-button")
  if (!control) throw new Error(`no sort control in ${key}`)
  return control
}

/** A click, with or without the shift key held. Returns false if it was prevented. */
function click(element: Element, init: MouseEventInit = {}): boolean {
  return element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...init }))
}

const order = (key: string) => header(key).querySelector(".tpz-th-order")?.textContent ?? null
const sorted = (key: string) => header(key).getAttribute("aria-sort")
const reset = () => host.querySelector<HTMLElement>(".tpz-sort-reset")

function openMenu(key: string): HTMLElement {
  const trigger = header(key).querySelector<HTMLElement>(".tpz-th-menu")
  if (!trigger) throw new Error(`no menu in ${key}`)
  trigger.click()
  const panel = document.querySelector<HTMLElement>(".tpz-portal .tpz-menu")
  if (!panel) throw new Error("the menu did not open")
  return panel
}

const menuItem = (panel: HTMLElement, text: string) =>
  [...panel.querySelectorAll<HTMLElement>(".tpz-menu-item")].find((item) => item.textContent === text)

describe("a shift-click adds a level", () => {
  it("sorts by the first column, then by the second within it", () => {
    setup()

    click(sortControl("team"))
    click(sortControl("name"), { shiftKey: true })

    expect(names()).toEqual(["Ada", "Bo", "Cy", "Dee", "Abe", "Bea"])
    expect([sorted("team"), sorted("name"), sorted("level")]).toEqual(["ascending", "ascending", "none"])
  })

  it("numbers the headers in the order they were added, and not when there is only one", () => {
    setup()

    click(sortControl("team"))
    expect(order("team")).toBeNull()

    click(sortControl("level"), { shiftKey: true })
    click(sortControl("name"), { shiftKey: true })

    expect([order("team"), order("level"), order("name")]).toEqual(["1", "2", "3"])
  })

  it("says the level to a screen reader, where the numeral is hidden from one", () => {
    setup({ state: { sort: [{ key: "team", direction: "asc" }, { key: "name", direction: "asc" }] } })

    expect(header("name").querySelector(".tpz-th-order")?.getAttribute("aria-hidden")).toBe("true")
    expect(sortControl("name").querySelector(".tpz-sr")?.textContent).toBe(", sort level 2")
  })

  it("turns a level over where it is", () => {
    setup({ state: { sort: [{ key: "team", direction: "asc" }, { key: "name", direction: "asc" }] } })

    click(sortControl("team"), { shiftKey: true })

    expect(names()).toEqual(["Abe", "Bea", "Ada", "Bo", "Cy", "Dee"])
    expect([order("team"), order("name")]).toEqual(["1", "2"])
    expect(sorted("team")).toBe("descending")
  })

  it("drops a level on its third click and keeps the others", () => {
    setup({ state: { sort: [{ key: "team", direction: "desc" }, { key: "name", direction: "desc" }] } })

    click(sortControl("team"), { shiftKey: true })

    expect([sorted("team"), sorted("name")]).toEqual(["none", "descending"])
    expect(names()).toEqual(["Dee", "Cy", "Bo", "Bea", "Ada", "Abe"])
    expect(order("name")).toBeNull()
  })

  it("is replaced by a plain click", () => {
    setup({ state: { sort: [{ key: "team", direction: "asc" }, { key: "name", direction: "asc" }] } })

    click(sortControl("level"))

    expect([sorted("team"), sorted("name"), sorted("level")]).toEqual(["none", "none", "ascending"])
  })

  it("leaves a shift-click with another modifier alone", () => {
    const table = setup({ state: { sort: [{ key: "team", direction: "asc" }] } })

    // Not "add a level": this is a plain click as far as the sort goes.
    click(sortControl("name"), { shiftKey: true, metaKey: true })
    expect(table.getState().sort).toEqual([{ key: "name", direction: "asc" }])
  })

  it("does not stretch the page's text selection to the header", () => {
    setup()

    const plain = new MouseEvent("mousedown", { bubbles: true, cancelable: true })
    sortControl("name").dispatchEvent(plain)
    expect(plain.defaultPrevented).toBe(false)

    const shifted = new MouseEvent("mousedown", { bubbles: true, cancelable: true, shiftKey: true })
    sortControl("name").dispatchEvent(shifted)
    expect(shifted.defaultPrevented).toBe(true)
  })

  it("tells the caller the whole sort, in order", () => {
    const onStateChange = vi.fn<(state: TableState) => void>()
    setup({ onStateChange })

    click(sortControl("team"))
    click(sortControl("level"), { shiftKey: true })

    expect(onStateChange.mock.calls.at(-1)?.[0].sort).toEqual([
      { key: "team", direction: "asc" },
      { key: "level", direction: "asc" },
    ])
  })
})

describe("a table that sorts by one column only", () => {
  it("treats a shift-click as a click", () => {
    setup({ sortable: { multiple: false } })

    click(sortControl("team"))
    click(sortControl("name"), { shiftKey: true })

    expect([sorted("team"), sorted("name")]).toEqual(["none", "ascending"])
  })

  it("does not offer to add a level from the menu", () => {
    setup({ sortable: { multiple: false }, state: { sort: [{ key: "team", direction: "asc" }] } })
    expect(menuItem(openMenu("name"), "Then sort ascending")).toBeUndefined()
  })
})

describe("with sorting switched off", () => {
  it("has no sort controls, no levels in the menu and no reset", () => {
    setup({ sortable: false, state: { sort: [{ key: "name", direction: "asc" }] } })

    expect(header("name").querySelector("button.tpz-th-button")).toBeNull()
    expect(header("name").querySelector("span.tpz-th-button")).not.toBeNull()
    expect(reset()).toBeNull()
    expect(menuItem(openMenu("name"), "Sort ascending")).toBeUndefined()
  })
})

describe("adding a level without a shift key", () => {
  it("offers nothing to follow until another column is sorted", () => {
    setup()
    const panel = openMenu("name")

    expect(menuItem(panel, "Sort ascending")).toBeDefined()
    expect(menuItem(panel, "Then sort ascending")).toBeUndefined()
  })

  it("adds one from the column's menu, in either direction", () => {
    setup({ state: { sort: [{ key: "team", direction: "asc" }] } })

    menuItem(openMenu("name"), "Then sort descending")?.click()

    expect(names()).toEqual(["Dee", "Cy", "Bo", "Ada", "Bea", "Abe"])
    expect([order("team"), order("name")]).toEqual(["1", "2"])
    expect(document.querySelector(".tpz-portal")).toBeNull()
  })

  it("clears one column's level from its menu and leaves the rest", () => {
    setup({ state: { sort: [{ key: "team", direction: "asc" }, { key: "name", direction: "desc" }] } })

    menuItem(openMenu("team"), "Clear sort")?.click()

    expect([sorted("team"), sorted("name")]).toEqual(["none", "descending"])
  })

  it("uses the columns as they are now, not as they were when the header was drawn", () => {
    const table = setup()

    // The header cells stay on screen across this change of order…
    table.setState({ order: ["level", "name", "team"] })

    // …so "Move left" has to know that Level now leads.
    const first = menuItem(openMenu("level"), "Move left")
    expect(first?.hasAttribute("disabled")).toBe(true)
  })
})

describe("the reset", () => {
  it("is not there until something is sorted", () => {
    setup()
    expect(reset()).toBeNull()
  })

  it("appears with a sort, puts the rows back as they arrived, and goes", () => {
    setup()
    const arrived = names()

    click(sortControl("name"), {})
    click(sortControl("name"), {})
    expect(names()).not.toEqual(arrived)

    const control = reset()
    expect(control?.tagName).toBe("BUTTON")
    expect(control?.getAttribute("aria-label")).toBe("Reset sort")
    control?.click()

    expect(names()).toEqual(arrived)
    expect(sorted("name")).toBe("none")
    expect(reset()).toBeNull()
  })

  it("clears every level at once and goes back to page one", () => {
    const table = setup({
      pagination: { pageSize: 2 },
      state: {
        page: 2,
        sort: [
          { key: "team", direction: "asc" },
          { key: "level", direction: "desc" },
        ],
      },
    })

    reset()?.click()
    expect(table.getState()).toMatchObject({ sort: [], page: 1 })
  })

  it("leads the toolbar's controls, so that arriving it moves none of them", () => {
    setup({ search: true, export: true })
    click(sortControl("name"))

    const groups = host.querySelectorAll(".tpz-toolbar-group")
    expect(groups[groups.length - 1]?.firstElementChild).toBe(reset())
  })

  it("is one control across renders, not a new one each time", () => {
    setup({ search: true })

    click(sortControl("name"))
    const first = reset()
    click(sortControl("team"), { shiftKey: true })

    expect(reset()).toBe(first)
    expect(host.querySelectorAll(".tpz-sort-reset")).toHaveLength(1)
  })

  it("survives the toolbar being rebuilt", () => {
    const table = setup({ search: true })
    click(sortControl("name"))

    table.setOptions({ export: true })

    expect(host.querySelectorAll(".tpz-sort-reset")).toHaveLength(1)
    const groups = host.querySelectorAll(".tpz-toolbar-group")
    expect(groups[groups.length - 1]?.firstElementChild).toBe(reset())
  })

  it("is left out when asked, and with sorting itself", () => {
    setup({ sortable: { reset: false } })
    click(sortControl("name"))
    expect(reset()).toBeNull()
  })

  it("does not conjure up a toolbar to live in", () => {
    setup({ columnControl: false })
    click(sortControl("name"))

    // A toolbar arriving on the click that sorted would push the header out
    // from under the pointer.
    expect(host.querySelector<HTMLElement>(".tpz-toolbar")?.style.display).toBe("none")
    expect(reset()).toBeNull()
    expect(sorted("name")).toBe("ascending")
  })

  describe("for a table that rests in an order of its own", () => {
    const resting = [{ key: "level", direction: "desc" }] as const

    it("is hidden while the table is in that order", () => {
      setup({ sortable: { reset: resting }, state: { sort: [...resting] } })
      expect(reset()).toBeNull()
    })

    it("returns to that order, not to none", () => {
      const table = setup({ sortable: { reset: resting }, state: { sort: [...resting] } })

      click(sortControl("name"))
      reset()?.click()

      expect(table.getState().sort).toEqual(resting)
      expect(reset()).toBeNull()
    })

    it("counts no sort at all as somewhere to come back from", () => {
      setup({ sortable: { reset: resting }, state: { sort: [...resting] } })

      click(sortControl("level"))
      expect(sorted("level")).toBe("none")
      expect(reset()).not.toBeNull()
    })
  })
})

describe("a toolbar that has only filters to show", () => {
  it("appears for the chips even though it holds no controls", () => {
    const table = setup({ columnControl: false })
    const toolbar = host.querySelector<HTMLElement>(".tpz-toolbar")
    expect(toolbar?.style.display).toBe("none")

    table.setState({ filters: [{ key: "team", operator: "eq", value: "Eng" }] })
    expect(toolbar?.style.display).toBe("")
    expect(host.querySelector(".tpz-chip")?.textContent).toContain("Team is Eng")

    table.setState({ filters: [] })
    expect(toolbar?.style.display).toBe("none")
  })
})

describe("when the controls are links", () => {
  const href = (state: TableState) => applyStateToUrl("/staff", state)

  it("draws the reset as a link to the unsorted view", () => {
    setup({ buildHref: href, state: { sort: [{ key: "name", direction: "desc" }] } })

    expect(reset()?.tagName).toBe("A")
    expect(reset()?.getAttribute("href")).toBe("/staff")
  })

  it("keeps the reset's address in step with the rest of the state", () => {
    const table = setup({ buildHref: href, search: true, state: { sort: [{ key: "name", direction: "desc" }] } })
    const link = reset()

    table.setState({ search: "a" })

    expect(reset()).toBe(link)
    expect(stateFromUrl((link?.getAttribute("href") ?? "").split("?")[1] ?? "")).toMatchObject({ sort: [], search: "a" })
  })

  it("links the reset to the resting sort when there is one", () => {
    setup({
      buildHref: href,
      sortable: { reset: [{ key: "level", direction: "desc" }] },
      state: { sort: [{ key: "name", direction: "asc" }] },
    })

    expect(reset()?.getAttribute("href")).toBe("/staff?sort=level%3Adesc")
  })

  it("hands a plain click on the reset to the router", () => {
    const onNavigate = vi.fn()
    setup({ buildHref: href, onNavigate, state: { sort: [{ key: "name", direction: "desc" }] } })

    const link = reset()
    if (!link) throw new Error("no reset")
    expect(click(link)).toBe(false)
    expect(onNavigate.mock.calls[0]?.[0]).toBe("/staff")
  })

  it("swaps the button for a link when the table starts building addresses", () => {
    const table = setup({ state: { sort: [{ key: "name", direction: "desc" }] } })
    expect(reset()?.tagName).toBe("BUTTON")

    table.setOptions({ buildHref: href })
    expect(reset()?.tagName).toBe("A")
    expect(host.querySelectorAll(".tpz-sort-reset")).toHaveLength(1)
  })

  it("names the level in each header link, and keeps each link's address current", () => {
    const table = setup({
      buildHref: href,
      state: { sort: [{ key: "team", direction: "asc" }, { key: "name", direction: "desc" }] },
    })

    expect(sortControl("team").getAttribute("aria-label")).toBe("Sort by Team, sort level 1")
    expect(sortControl("name").getAttribute("aria-label")).toBe("Sort by Name, sort level 2")
    expect(sortControl("level").getAttribute("aria-label")).toBe("Sort by Level")

    // A click on Level replaces the sort; with a search in force the address says so.
    table.setState({ search: "a" })
    expect(sortControl("level").getAttribute("href")).toBe("/staff?sort=level%3Aasc&q=a")
  })

  it("turns a shift-click on a header link into a change of state, not a new window", () => {
    const onStateChange = vi.fn<(state: TableState) => void>()
    const onNavigate = vi.fn()
    setup({ buildHref: href, onNavigate, onStateChange, state: { sort: [{ key: "team", direction: "asc" }] } })

    const allowed = click(sortControl("name"), { shiftKey: true })

    expect(allowed).toBe(false)
    expect(onNavigate).not.toHaveBeenCalled()
    expect(onStateChange.mock.calls.at(-1)?.[0].sort).toEqual([
      { key: "team", direction: "asc" },
      { key: "name", direction: "asc" },
    ])
  })

  it("still hands a plain click on a header link to the router, and changes nothing itself", () => {
    const onStateChange = vi.fn()
    const onNavigate = vi.fn()
    setup({ buildHref: href, onNavigate, onStateChange })

    expect(click(sortControl("name"))).toBe(false)
    expect(onNavigate.mock.calls[0]?.[0]).toBe("/staff?sort=name%3Aasc")
    expect(onStateChange).not.toHaveBeenCalled()
  })

  it("leaves a shift-click to the browser when the table sorts by one column", () => {
    const onStateChange = vi.fn()
    setup({ buildHref: href, onStateChange, onNavigate: vi.fn(), sortable: { multiple: false } })

    expect(click(sortControl("name"), { shiftKey: true })).toBe(true)
    expect(onStateChange).not.toHaveBeenCalled()
  })

  it("links the menu's levels too", () => {
    setup({ buildHref: href, state: { sort: [{ key: "team", direction: "asc" }] } })

    const then = menuItem(openMenu("name"), "Then sort descending")
    expect(then?.tagName).toBe("A")
    expect(stateFromUrl((then?.getAttribute("href") ?? "").split("?")[1] ?? "").sort).toEqual([
      { key: "team", direction: "asc" },
      { key: "name", direction: "desc" },
    ])
  })
})

describe("with the sorting done on a server", () => {
  it("asks for the levels and leaves the rows as they were given", () => {
    const onStateChange = vi.fn<(state: TableState) => void>()
    setup({ server: true, total: 6, onStateChange })
    const given = names()

    click(sortControl("team"))
    click(sortControl("name"), { shiftKey: true })

    expect(onStateChange.mock.calls.at(-1)?.[0].sort).toHaveLength(2)
    expect(names()).toEqual(given)
    expect([order("team"), order("name")]).toEqual(["1", "2"])
  })
})

describe("the header stays put under the person using it", () => {
  it("keeps the same cells when the sort changes", () => {
    setup()
    const before = [header("name"), header("team"), header("level")]

    click(sortControl("name"))
    click(sortControl("team"), { shiftKey: true })

    expect([header("name"), header("team"), header("level")]).toEqual(before)
    expect(before.every((cell) => cell.isConnected)).toBe(true)
  })

  it("keeps the keyboard's focus on the header that was just sorted", () => {
    setup()
    const control = sortControl("name")
    control.focus()

    click(control)
    click(control)

    // The same control, still focused, ready for the next press of Enter.
    expect(sortControl("name")).toBe(control)
    expect(document.activeElement).toBe(control)
    expect(sorted("name")).toBe("descending")
  })

  it("keeps the label a person is pressing on, and replaces only what follows it", () => {
    setup()
    const label = sortControl("name").querySelector(".tpz-th-label")

    click(sortControl("name"))
    click(sortControl("team"), { shiftKey: true })

    expect(sortControl("name").querySelector(".tpz-th-label")).toBe(label)
    expect(sortControl("name").querySelectorAll(".tpz-th-marker")).toHaveLength(1)
    expect(sortControl("name").querySelectorAll(".tpz-th-order")).toHaveLength(1)

    reset()?.click()
    expect(sortControl("name").children).toHaveLength(1)
  })

  it("keeps them when the rows are filtered, searched or paged", () => {
    const table = setup({ search: true, pagination: { pageSize: 2 } })
    const cell = header("name")

    table.setState({ search: "a" })
    table.setState({ filters: [{ key: "team", operator: "eq", value: "Eng" }] })
    table.setState({ page: 2 })

    expect(header("name")).toBe(cell)
    expect(header("team").dataset["filtered"]).toBe("true")
  })

  it("keeps the header checkbox, and its state, across a sort", () => {
    setup({ selection: true })
    const box = host.querySelector<HTMLInputElement>('thead [data-key="__select"] input')

    box?.click()
    click(sortControl("name"))

    expect(host.querySelector('thead [data-key="__select"] input')).toBe(box)
    expect(box?.checked).toBe(true)
  })

  it("rebuilds a cell when something about its column really has changed", () => {
    const table = setup()
    const cell = header("name")

    table.setOptions({ columns: [{ key: "name", header: "Full name" }, "team", "level"] })

    expect(header("name")).not.toBe(cell)
    expect(header("name").querySelector(".tpz-th-label")?.textContent).toBe("Full name")
  })

  it("rebuilds the cells that changed width or pin, and no others", () => {
    const table = setup()
    const name = header("name")
    const team = header("team")

    table.setState({ widths: { name: 240 } })

    expect(header("name")).not.toBe(name)
    expect(header("name").style.width).toBe("240px")
    expect(header("team")).toBe(team)
  })

  it("puts the cells in their new order when the columns are rearranged", () => {
    const table = setup()
    table.setState({ order: ["level", "name", "team"] })

    expect([...host.querySelectorAll("thead th")].map((cell) => cell.getAttribute("data-key"))).toEqual([
      "level",
      "name",
      "team",
    ])
    expect(names()).toEqual(["2", "1", "3", "2", "1", "3"])
  })

  it("drops the cell of a column that is hidden, and builds it again when it is shown", () => {
    const table = setup()
    const team = header("team")

    table.setState({ hidden: ["team"] })
    expect(team.isConnected).toBe(false)

    table.setState({ hidden: [] })
    expect(header("team").isConnected).toBe(true)
  })
})

describe("on a server", () => {
  const options: TableOptions<Person> = {
    ...base,
    search: true,
    buildHref: (state) => applyStateToUrl("/staff", state),
    state: {
      sort: [
        { key: "team", direction: "asc" },
        { key: "level", direction: "desc" },
      ],
    },
  }

  it("writes the levels, the order and the reset into the HTML", () => {
    const html = renderToString(options)

    expect(html).toContain('<span class="tpz-th-order" aria-hidden="true">1</span>')
    expect(html).toContain('<span class="tpz-th-order" aria-hidden="true">2</span>')
    expect(html).toContain('aria-label="Sort by Team, sort level 1"')
    expect(html).toContain('<a href="/staff" class="tpz-btn tpz-btn-icon tpz-sort-reset" aria-label="Reset sort" title="Reset sort">')
    // Sorted before it left the server.
    expect(html.indexOf(">Bo<")).toBeLessThan(html.indexOf(">Ada<"))
  })

  it("writes exactly what the browser then draws", () => {
    createTable(host, options)
    expect(renderToString(options)).toBe(host.innerHTML)
  })

  it("writes no reset for a table in its resting order", () => {
    expect(renderToString({ ...options, state: {} })).not.toContain("tpz-sort-reset")
  })
})
