/**
 * @vitest-environment jsdom
 *
 * Sorting by several columns and searching a column from its header, through
 * the Svelte action.
 *
 * The behaviour is the DOM renderer's and is tested there. These cover the
 * seam: the options arrive, an update that drops one takes it away again, and
 * a search box somebody is typing into comes through every kind of update the
 * action makes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { TableState } from "@trapezium/core"

import { trapezium } from "./action.js"

type Person = { id: string; name: string; team: string }

const staff: Person[] = [
  { id: "1", name: "Ada", team: "Eng" },
  { id: "2", name: "Bea", team: "Ops" },
  { id: "3", name: "Cy", team: "Eng" },
  { id: "4", name: "Abe", team: "Ops" },
]

let host: HTMLElement | undefined
let action: ReturnType<typeof trapezium<Person>> | undefined

beforeEach(() => {
  // jsdom never reports its document as focused; a browser does.
  vi.spyOn(document, "hasFocus").mockReturnValue(true)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  action?.destroy()
  host?.remove()
  action = undefined
  host = undefined
  document.querySelectorAll(".tpz-portal").forEach((node) => node.remove())
})

function mount(options: Parameters<typeof trapezium<Person>>[1]): HTMLElement {
  const node = document.createElement("div")
  document.body.append(node)
  host = node
  action = trapezium(node, options)
  return node
}

const names = (node: HTMLElement) =>
  [...node.querySelectorAll("tbody tr")].map((row) => row.querySelector("td")?.textContent?.trim() ?? "")

function header(node: HTMLElement, key: string): HTMLElement {
  const cell = node.querySelector<HTMLElement>(`thead th[data-key="${key}"]`)
  if (!cell) throw new Error(`no ${key} header`)
  return cell
}

function sortControl(node: HTMLElement, key: string): HTMLElement {
  const control = header(node, key).querySelector<HTMLElement>(".tpz-th-button")
  if (!control) throw new Error(`no sort control in ${key}`)
  return control
}

const click = (element: Element, init: MouseEventInit = {}) =>
  element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...init }))

function openSearch(node: HTMLElement, key: string): HTMLInputElement {
  header(node, key).querySelector<HTMLElement>(".tpz-th-search")?.click()
  const input = header(node, key).querySelector<HTMLInputElement>(".tpz-th-search-input")
  if (!input) throw new Error(`the ${key} search did not open`)
  return input
}

function type(input: HTMLInputElement, text: string) {
  input.value = text
  input.dispatchEvent(new Event("input", { bubbles: true }))
}

const columns = ["name", "team"]

describe("sorting by several columns", () => {
  it("adds a level on a shift-click, numbers the headers and reports the sort", () => {
    const onStateChange = vi.fn<(state: TableState) => void>()
    const node = mount({ data: staff, columns, pagination: false, onStateChange })

    click(sortControl(node, "team"))
    click(sortControl(node, "name"), { shiftKey: true })

    expect(names(node)).toEqual(["Ada", "Cy", "Abe", "Bea"])
    expect(header(node, "name").querySelector(".tpz-th-order")?.textContent).toBe("2")
    expect(onStateChange.mock.calls.at(-1)?.[0].sort).toHaveLength(2)
  })

  it("offers the reset, and takes it away again when the option is dropped", () => {
    const node = mount({ data: staff, columns, pagination: false })

    click(sortControl(node, "name"))
    expect(node.querySelector(".tpz-sort-reset")).not.toBeNull()

    action?.update({ data: staff, columns, pagination: false, sortable: { reset: false } })
    expect(node.querySelector(".tpz-sort-reset")).toBeNull()

    // A prop the component stopped receiving goes back to its default.
    action?.update({ data: staff, columns, pagination: false })
    expect(node.querySelector(".tpz-sort-reset")).not.toBeNull()
  })

  it("keeps to one column when told to", () => {
    const node = mount({ data: staff, columns, pagination: false, sortable: { multiple: false } })

    click(sortControl(node, "team"))
    click(sortControl(node, "name"), { shiftKey: true })

    expect(header(node, "team").getAttribute("aria-sort")).toBe("none")
  })
})

describe("searching a column from its header", () => {
  it("is off until asked for, and goes away when the option is dropped", () => {
    const node = mount({ data: staff, columns })
    expect(node.querySelector(".tpz-th-search")).toBeNull()

    action?.update({ data: staff, columns, headerSearch: true })
    expect(node.querySelectorAll(".tpz-th-search")).toHaveLength(2)

    action?.update({ data: staff, columns })
    expect(node.querySelector(".tpz-th-search")).toBeNull()
  })

  it("filters, and tells the page", () => {
    vi.useFakeTimers()
    const onStateChange = vi.fn<(state: TableState) => void>()
    const node = mount({ data: staff, columns, pagination: false, headerSearch: { debounce: 120 }, onStateChange })

    type(openSearch(node, "team"), "ops")
    vi.advanceTimersByTime(119)
    expect(onStateChange).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2)

    expect(names(node)).toEqual(["Bea", "Abe"])
    expect(onStateChange.mock.calls.at(-1)?.[0].filters).toEqual([{ key: "team", operator: "contains", value: "ops" }])
  })

  it("keeps the box through new rows arriving", () => {
    const options = { data: staff, columns, pagination: false as const, headerSearch: true }
    const node = mount(options)

    const input = openSearch(node, "name")
    type(input, "z")

    // Only the data differs, so the action replaces the rows and nothing else.
    action?.update({ ...options, data: [...staff, { id: "5", name: "Zed", team: "Eng" }] })

    expect(header(node, "name").querySelector(".tpz-th-search-input")).toBe(input)
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe("z")
  })

  it("keeps the box through an update that changes the options as well", () => {
    vi.useFakeTimers()
    const node = mount({ data: staff, columns, pagination: false, headerSearch: { debounce: 0 } })

    const input = openSearch(node, "name")
    type(input, "a")
    vi.runAllTimers()

    // New option objects all round: the page re-rendered with literals.
    action?.update({
      data: [...staff],
      columns: [...columns],
      pagination: false,
      headerSearch: { debounce: 0 },
      loading: true,
    })

    expect(header(node, "name").querySelector(".tpz-th-search-input")).toBe(input)
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe("a")
    expect(names(node)).toEqual(["Ada", "Bea", "Abe"])
  })

  it("leaves nothing running when the node goes away", () => {
    vi.useFakeTimers()
    const onStateChange = vi.fn()
    const node = mount({ data: staff, columns, headerSearch: { debounce: 100 }, onStateChange })

    type(openSearch(node, "name"), "ada")
    action?.destroy()
    action = undefined
    vi.runAllTimers()

    expect(onStateChange).not.toHaveBeenCalled()
  })
})
