/**
 * @vitest-environment jsdom
 *
 * Searching a column from its header — in the DOM renderer, which is also
 * Vue's and Svelte's.
 *
 * The behaviour is the React adapter's, and is tested the same way. What is
 * particular to this renderer is that it rebuilds on every change of state,
 * and a search box is the one thing on a table that cannot survive that: the
 * tests under "the box survives the table re-rendering" are the ones that
 * would fail first if a person's typing were ever thrown away mid-word.
 */
import { stateFromUrl, type TableState } from "@trapezium/core"
import { columns as fullColumns, customTypes, makeRows, type Row } from "@trapezium/core/testing"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { renderToString } from "./render-to-string.js"
import { createTable, type TableOptions, type VanillaColumn } from "./table.js"

type Person = { id: string; name: string; team: string; salary: number; joined: string; remote: boolean }

const staff: Person[] = [
  { id: "1", name: "Ada Lovelace", team: "Eng", salary: 120_000, joined: "2024-03-01", remote: true },
  { id: "2", name: "Tom Kerrigan", team: "Sales", salary: 80_000, joined: "2023-06-15", remote: false },
  { id: "3", name: "Zoë Marchetti", team: "Eng", salary: 118_500, joined: "2022-01-10", remote: true },
  { id: "4", name: "Bea Whitlock", team: "Ops", salary: 95_000, joined: "2024-03-22", remote: false },
]

const columns: VanillaColumn<Person>[] = [
  { key: "name" },
  { key: "team", filter: "set" },
  { key: "salary", type: "currency" },
  { key: "joined", type: "date" },
  { key: "remote", type: "boolean" },
]

let host: HTMLElement

beforeEach(() => {
  host = document.createElement("div")
  document.body.append(host)
  // jsdom never reports its document as focused; a browser does, which is how
  // the box tells a click elsewhere from the window going away.
  vi.spyOn(document, "hasFocus").mockReturnValue(true)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  host.remove()
  document.querySelectorAll(".tpz-portal").forEach((node) => node.remove())
})

const base: TableOptions<Person> = {
  data: staff,
  columns,
  getRowId: (person) => person.id,
  pagination: false,
  // No wait, so a test reads the result of typing as soon as the timer runs.
  headerSearch: { debounce: 0 },
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

const trigger = (key: string) => header(key).querySelector<HTMLElement>(".tpz-th-search")
const box = (key: string) => header(key).querySelector<HTMLInputElement>(".tpz-th-search-input")

/** Opens a column's box and returns its input. */
function open(key: string): HTMLInputElement {
  trigger(key)?.click()
  const input = box(key)
  if (!input) throw new Error(`the ${key} search did not open`)
  return input
}

/** Types into a box the way a browser reports it: the value, then an input event. */
function type(input: HTMLInputElement, text: string) {
  input.value = text
  input.dispatchEvent(new Event("input", { bubbles: true }))
}

function press(input: HTMLElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
  input.dispatchEvent(event)
  return event
}

/** Types and lets the wait run out. */
function search(key: string, text: string): HTMLInputElement {
  vi.useFakeTimers()
  const input = open(key)
  type(input, text)
  vi.runAllTimers()
  vi.useRealTimers()
  return input
}

describe("who gets a magnifier", () => {
  it("nobody, until it is asked for", () => {
    setup({ headerSearch: undefined })
    expect(host.querySelector(".tpz-th-search")).toBeNull()
  })

  it("every column that can be filtered, when the table asks", () => {
    setup()
    expect(host.querySelectorAll(".tpz-th-search")).toHaveLength(5)
    expect(trigger("name")?.getAttribute("aria-label")).toBe("Search Name")
    expect(trigger("name")?.getAttribute("title")).toBe("Search Name")
    expect(trigger("name")?.getAttribute("type")).toBe("button")
  })

  it("only the columns that ask, when the table does not", () => {
    setup({ headerSearch: undefined, columns: [{ key: "name", headerSearch: true }, { key: "team" }] })

    expect(trigger("name")).not.toBeNull()
    expect(trigger("team")).toBeNull()
  })

  it("not a column that opted out, or one with its filter off", () => {
    setup({ columns: [{ key: "name", headerSearch: false }, { key: "team", filter: false }, { key: "salary" }] })

    expect(trigger("name")).toBeNull()
    expect(trigger("team")).toBeNull()
    expect(trigger("salary")).not.toBeNull()
  })

  it("nobody at all when the table's filters are switched off, because a search is one", () => {
    setup({ filters: false })
    expect(host.querySelector(".tpz-th-search")).toBeNull()
  })

  it("sits between the sort control and the menu, where the stylesheet expects it", () => {
    setup()
    const order = [...(header("name").querySelector(".tpz-th-inner")?.children ?? [])].map((child) => child.className)
    expect(order).toEqual(["tpz-th-icon", "tpz-th-button", "tpz-th-search", "tpz-th-menu", "tpz-resizer"])
  })

  it("follows the option being switched on and off while the table is running", () => {
    const table = setup({ headerSearch: undefined })
    expect(host.querySelector(".tpz-th-search")).toBeNull()

    table.setOptions({ headerSearch: true })
    expect(host.querySelectorAll(".tpz-th-search")).toHaveLength(5)

    table.setOptions({ headerSearch: false })
    expect(host.querySelector(".tpz-th-search")).toBeNull()
  })
})

describe("the box", () => {
  it("opens over the header, focused, with the column's name where it was", () => {
    setup()
    const input = open("name")

    expect(document.activeElement).toBe(input)
    expect(input.getAttribute("placeholder")).toBe("Name")
    expect(input.getAttribute("aria-label")).toBe("Search Name")
    expect(input.getAttribute("role")).toBe("searchbox")
    expect(header("name").dataset["searching"]).toBe("true")

    // Laid over the header, not put in place of it: the label underneath is
    // what keeps the column the width it was.
    expect(header("name").querySelector(".tpz-th-inner .tpz-th-label")?.textContent).toBe("Name")
    expect(input.closest(".tpz-th-searchbox")?.parentElement).toBe(header("name"))
  })

  it("does not sort the column on the way in", () => {
    setup()
    open("name")
    expect(header("name").getAttribute("aria-sort")).toBe("none")
  })

  it("filters once the typing stops", () => {
    vi.useFakeTimers()
    const onStateChange = vi.fn<(state: TableState) => void>()
    setup({ headerSearch: { debounce: 200 }, onStateChange })

    const input = open("name")
    for (const text of ["l", "lo", "lov"]) {
      type(input, text)
      vi.advanceTimersByTime(150)
    }
    expect(onStateChange).not.toHaveBeenCalled()

    vi.advanceTimersByTime(60)
    expect(onStateChange).toHaveBeenCalledTimes(1)
    expect(names()).toEqual(["Ada Lovelace"])
  })

  it("waits 150 milliseconds unless told otherwise", () => {
    vi.useFakeTimers()
    const onStateChange = vi.fn()
    setup({ headerSearch: true, onStateChange })

    type(open("name"), "ada")
    vi.advanceTimersByTime(149)
    expect(onStateChange).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2)
    expect(onStateChange).toHaveBeenCalledTimes(1)
  })

  it("ignores case and accents", () => {
    setup()
    search("name", "ZOE")
    expect(names()).toEqual(["Zoë Marchetti"])
  })

  it("applies at once on Enter, closes, and hands focus back to the magnifier", () => {
    setup({ headerSearch: { debounce: 60_000 } })

    const input = open("name")
    type(input, "tom")
    expect(names()).toHaveLength(4)

    press(input, "Enter")

    expect(names()).toEqual(["Tom Kerrigan"])
    expect(box("name")).toBeNull()
    expect(header("name").dataset["searching"]).toBeUndefined()
    expect(document.activeElement).toBe(trigger("name"))
  })

  it("keeps what was typed when focus moves away, and closes", () => {
    setup({ headerSearch: { debounce: 60_000 }, search: true })

    const input = open("name")
    type(input, "bea")

    const elsewhere = host.querySelector<HTMLInputElement>(".tpz-search .tpz-input")
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: elsewhere }))

    expect(box("name")).toBeNull()
    expect(names()).toEqual(["Bea Whitlock"])
  })

  it("stays open while focus moves between its own two controls", () => {
    setup()
    const input = open("name")
    const clear = header("name").querySelector<HTMLElement>(".tpz-th-search-clear")

    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: clear }))
    expect(box("name")).toBe(input)
  })

  it("stays open when the window loses focus rather than the box", () => {
    setup()
    const input = open("name")

    vi.mocked(document.hasFocus).mockReturnValue(false)
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: null }))

    expect(box("name")).toBe(input)
  })

  it("closes with nothing applied when nothing was typed", () => {
    const onStateChange = vi.fn()
    setup({ onStateChange })

    press(open("name"), "Escape")

    expect(box("name")).toBeNull()
    expect(document.activeElement).toBe(trigger("name"))
    expect(onStateChange).not.toHaveBeenCalled()
  })

  it("empties on Escape, and closes on the Escape after that", () => {
    setup()
    const input = search("name", "ada")
    expect(names()).toHaveLength(1)

    press(input, "Escape")
    expect(box("name")).toBe(input)
    expect(input.value).toBe("")
    expect(names()).toHaveLength(4)

    press(input, "Escape")
    expect(box("name")).toBeNull()
  })

  it("does not let its Escape reach whatever the table is inside", () => {
    const outer = vi.fn()
    document.body.addEventListener("keydown", outer)
    setup()

    press(open("name"), "Escape")

    document.body.removeEventListener("keydown", outer)
    expect(outer).not.toHaveBeenCalled()
  })

  it("clears and closes from its own button", () => {
    setup()
    search("name", "ada")

    header("name").querySelector<HTMLElement>(".tpz-th-search-clear")?.click()

    expect(names()).toHaveLength(4)
    expect(box("name")).toBeNull()
    expect(document.activeElement).toBe(trigger("name"))
  })

  it("empties when the last character is deleted and the box is closed before the wait is up", () => {
    setup({
      headerSearch: { debounce: 60_000 },
      state: { filters: [{ key: "name", operator: "contains", value: "a" }] },
    })

    const input = open("name")
    type(input, "")
    press(input, "Escape")

    expect(names()).toHaveLength(4)
  })

  it("opens on what the column is already being searched for, with the caret at the end", () => {
    setup({ state: { filters: [{ key: "name", operator: "contains", value: "ada" }] } })

    const input = open("name")
    expect(input.value).toBe("ada")
    expect(input.selectionStart).toBe(3)
  })

  it("opens empty over a filter that was not a search, and leaves it alone", () => {
    const onStateChange = vi.fn()
    setup({ state: { filters: [{ key: "team", operator: "in", value: ["Eng", "Ops"] }] }, onStateChange })

    const input = open("team")
    expect(input.value).toBe("")

    press(input, "Escape")
    expect(onStateChange).not.toHaveBeenCalled()
    expect(names()).toHaveLength(3)
  })

  it("stops the header being dragged while it is a text box, and lets it be again after", () => {
    setup()
    expect(header("name").draggable).toBe(true)

    const input = open("name")
    expect(header("name").draggable).toBe(false)

    press(input, "Escape")
    expect(header("name").draggable).toBe(true)
  })

  it("is only ever open over one column", () => {
    setup()
    open("name")
    // Focus moving to the next magnifier closes the first box on its way.
    box("name")?.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: trigger("team") }))
    open("team")

    expect(host.querySelectorAll(".tpz-th-searchbox")).toHaveLength(1)
    expect(box("team")).not.toBeNull()
  })
})

describe("the box survives the table re-rendering", () => {
  it("is the same element, still focused, with the caret where it was, after its own search applies", () => {
    setup()
    const input = search("name", "ad")

    // The search applied, the body was rebuilt — and the box was not.
    expect(names()).toEqual(["Ada Lovelace"])
    expect(box("name")).toBe(input)
    expect(input.isConnected).toBe(true)
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe("ad")
    expect(input.selectionStart).toBe(2)
  })

  it("keeps typing through several applied searches", () => {
    vi.useFakeTimers()
    setup({ headerSearch: { debounce: 100 } })
    const input = open("name")

    type(input, "a")
    vi.advanceTimersByTime(100)
    expect(names()).toHaveLength(4)

    type(input, "ad")
    vi.advanceTimersByTime(100)
    type(input, "ada")
    vi.advanceTimersByTime(100)

    expect(names()).toEqual(["Ada Lovelace"])
    expect(box("name")).toBe(input)
    expect(document.activeElement).toBe(input)
  })

  it("survives the data being replaced under it", () => {
    const table = setup()
    const input = open("name")
    type(input, "ze")

    table.setData([...staff, { id: "5", name: "Zed Novak", team: "Eng", salary: 1, joined: "2020-01-01", remote: true }])

    expect(box("name")).toBe(input)
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe("ze")
  })

  it("survives a wrapper handing over fresh options on every change", () => {
    // What a Vue template with an inline object prop does: every re-render of
    // the parent is a new `pagination`, a new `columns`, and so a full rebuild.
    const table = setup()
    const input = search("name", "ad")

    table.setOptions({ columns: [...columns], classNames: { cell: "wider" } })
    table.setOptions({ columns: [...columns], loading: true })

    expect(box("name")).toBe(input)
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe("ad")
    expect(header("name").dataset["searching"]).toBe("true")
  })

  it("survives another column being sorted, filtered or hidden", () => {
    const table = setup()
    const input = open("name")
    type(input, "a")

    table.setState({ sort: [{ key: "salary", direction: "desc" }] })
    table.setState({ hidden: ["joined"] })
    table.setState({ filters: [{ key: "team", operator: "eq", value: "Eng" }] })

    expect(box("name")).toBe(input)
    expect(document.activeElement).toBe(input)
    expect(header("salary").getAttribute("aria-sort")).toBe("descending")
  })

  it("still says its column is filtered, though the cell was never rebuilt", () => {
    setup()
    search("name", "ada")

    expect(header("name").dataset["filtered"]).toBe("true")
    expect(header("name").dataset["searching"]).toBe("true")
  })

  it("follows its chip being removed while it is open", () => {
    setup()
    const input = search("name", "ada")
    expect(names()).toHaveLength(1)

    host.querySelector<HTMLElement>(".tpz-chip-remove")?.click()

    expect(names()).toHaveLength(4)
    expect(box("name")).toBe(input)
    expect(input.value).toBe("")
  })

  it("is put away when its column is hidden", () => {
    const table = setup()
    const input = open("name")
    type(input, "a")

    table.setState({ hidden: ["name"] })

    expect(input.isConnected).toBe(false)
    expect(host.querySelector(".tpz-th-searchbox")).toBeNull()

    // And no wait left running tries to apply a search to a column that is gone.
    table.setState({ hidden: [] })
    expect(table.getState().filters).toEqual([])
  })

  it("leaves a fresh, ordinary header behind when it closes", () => {
    setup()
    const input = search("name", "ada")
    const before = header("name")

    press(input, "Enter")

    const after = header("name")
    expect(after).not.toBe(before)
    expect(after.querySelector(".tpz-th-searchbox")).toBeNull()
    expect(after.dataset["filtered"]).toBe("true")
    expect(trigger("name")?.dataset["active"]).toBe("true")
    expect(trigger("name")?.getAttribute("aria-label")).toBe("Search Name, searching for ada")
  })

  it("stops its timer when the table is destroyed", () => {
    vi.useFakeTimers()
    const onStateChange = vi.fn()
    const table = setup({ headerSearch: { debounce: 100 }, onStateChange })

    type(open("name"), "ada")
    table.destroy()
    vi.runAllTimers()

    expect(onStateChange).not.toHaveBeenCalled()
  })
})

describe("it is the column's filter", () => {
  it("shows as a chip that reads as a sentence", () => {
    setup()
    search("name", "ada")
    expect(host.querySelector(".tpz-chip")?.textContent).toBe("Name contains ada")
  })

  it("replaces whatever filter the column had", () => {
    const table = setup({ state: { filters: [{ key: "team", operator: "in", value: ["Eng", "Ops"] }] } })

    search("team", "sal")

    expect(names()).toEqual(["Tom Kerrigan"])
    expect(table.getState().filters).toEqual([{ key: "team", operator: "contains", value: "sal" }])
  })

  it("does not tick a choice in a set filter, and is replaced when one is ticked", () => {
    const table = setup({ state: { filters: [{ key: "team", operator: "contains", value: "s" }] } })
    expect(names()).toEqual(["Tom Kerrigan", "Bea Whitlock"])

    header("team").querySelector<HTMLElement>(".tpz-th-menu")?.click()
    const boxes = [...document.querySelectorAll<HTMLInputElement>(".tpz-portal .tpz-filter-option input")]
    expect(boxes.length).toBeGreaterThan(0)
    expect(boxes.every((checkbox) => !checkbox.checked)).toBe(true)

    const eng = [...document.querySelectorAll<HTMLElement>(".tpz-portal .tpz-filter-option")]
      .find((option) => option.textContent === "Eng")
      ?.querySelector<HTMLInputElement>("input")
    eng?.click()

    // The choice alone — the searched-for "s" is not carried into the list.
    expect(table.getState().filters).toEqual([{ key: "team", operator: "eq", value: "Eng" }])
  })

  it("does not read as a yes or a no in a checkbox column's menu", () => {
    setup({ state: { filters: [{ key: "remote", operator: "contains", value: "yes" }] } })
    expect(names()).toEqual(["Ada Lovelace", "Zoë Marchetti"])

    header("remote").querySelector<HTMLElement>(".tpz-th-menu")?.click()
    expect(document.querySelector<HTMLSelectElement>(".tpz-portal .tpz-filter select")?.value).toBe("")
  })

  it("works alongside searches in other columns, the toolbar's search and a sort", () => {
    setup({ search: true, state: { sort: [{ key: "name", direction: "desc" }] } })

    press(search("team", "eng"), "Enter")
    expect(names()).toEqual(["Zoë Marchetti", "Ada Lovelace"])

    press(search("salary", "$120"), "Enter")
    expect(names()).toEqual(["Ada Lovelace"])
  })
})

describe("the column's menu, for the same filter", () => {
  function panel(key: string) {
    header(key).querySelector<HTMLElement>(".tpz-th-menu")?.click()
    const filter = document.querySelector<HTMLElement>(".tpz-portal .tpz-filter")
    if (!filter) throw new Error(`no filter panel for ${key}`)

    return {
      filter,
      operators: filter.querySelector<HTMLSelectElement>("select"),
      inputs: () => [...filter.querySelectorAll<HTMLInputElement>("input")],
      apply: () =>
        [...filter.querySelectorAll<HTMLElement>("button")].find((button) => button.textContent === "Apply")?.click(),
    }
  }

  function choose(select: HTMLSelectElement | null, operator: string) {
    if (!select) throw new Error("no operator list")
    select.value = operator
    select.dispatchEvent(new Event("change", { bubbles: true }))
  }

  it("shows the search, operator and all, in a plain text box", () => {
    setup({ state: { filters: [{ key: "joined", operator: "contains", value: "mar" }] } })
    expect(names()).toEqual(["Ada Lovelace", "Bea Whitlock"])

    const { operators, inputs } = panel("joined")
    expect(operators?.value).toBe("contains")
    // A date picker could not hold "mar".
    expect(inputs()[0]?.getAttribute("type")).toBe("text")
    expect(inputs()[0]?.value).toBe("mar")
  })

  it("goes back to the type's own input for the type's own operators", () => {
    setup()
    const { operators, inputs } = panel("joined")

    expect(inputs()[0]?.getAttribute("type")).toBe("date")
    choose(operators, "contains")
    expect(inputs()[0]?.getAttribute("type")).toBe("text")
    choose(operators, "gte")
    expect(inputs()[0]?.getAttribute("type")).toBe("date")
  })

  it("does not offer contains on a column that is not searched from its header", () => {
    setup({ headerSearch: undefined })
    const { operators } = panel("joined")
    expect([...(operators?.options ?? [])].map((option) => option.value)).not.toContain("contains")
  })

  it("still shows an operator the column does not list, when that is the one in force", () => {
    setup({ headerSearch: undefined, state: { filters: [{ key: "joined", operator: "contains", value: "mar" }] } })
    const { operators } = panel("joined")

    expect(operators?.value).toBe("contains")
    expect(names()).toEqual(["Ada Lovelace", "Bea Whitlock"])
  })

  it("asks for two values for a range, and applies both", () => {
    const table = setup()
    const { operators, inputs, apply } = panel("salary")

    choose(operators, "between")
    expect(inputs()).toHaveLength(2)

    const [low, high] = inputs()
    if (!low || !high) throw new Error("no bounds")
    low.value = "90000"
    high.value = "119000"
    apply()

    expect(table.getState().filters).toEqual([{ key: "salary", operator: "between", value: ["90000", "119000"] }])
    expect(names()).toEqual(["Zoë Marchetti", "Bea Whitlock"])
  })

  it("reopens a range with both of its bounds", () => {
    setup({ state: { filters: [{ key: "salary", operator: "between", value: ["90000", "119000"] }] } })
    const { inputs } = panel("salary")

    expect(inputs().map((input) => input.value)).toEqual(["90000", "119000"])
  })

  it("asks for nothing when the question is only whether there is a value", () => {
    const table = setup()
    const { operators, inputs, apply } = panel("salary")

    choose(operators, "notEmpty")
    expect(inputs()).toHaveLength(0)
    apply()

    expect(table.getState().filters).toEqual([{ key: "salary", operator: "notEmpty" }])
  })

  it("takes a list as comma-separated values", () => {
    const table = setup({ columns: [{ key: "name" }, { key: "id", type: "id" }] })
    const { operators, inputs, apply } = panel("id")

    choose(operators, "in")
    const [value] = inputs()
    if (!value) throw new Error("no value box")
    expect(value.getAttribute("placeholder")).toBe("Separate with commas")
    value.value = "1, 3 ,"
    apply()

    expect(table.getState().filters).toEqual([{ key: "id", operator: "in", value: ["1", "3"] }])
    expect(names()).toEqual(["Ada Lovelace", "Zoë Marchetti"])
  })

  it("offers to clear a filter that is there, and not one that is not", () => {
    const table = setup({ state: { filters: [{ key: "salary", operator: "gt", value: "100000" }] } })

    const clear = [...panel("salary").filter.querySelectorAll<HTMLElement>("button")].find(
      (button) => button.textContent === "Clear",
    )
    expect(clear).toBeDefined()
    clear?.click()
    expect(table.getState().filters).toEqual([])

    document.querySelectorAll(".tpz-portal").forEach((node) => node.remove())
    expect(
      [...panel("joined").filter.querySelectorAll("button")].some((button) => button.textContent === "Clear"),
    ).toBe(false)
  })
})

describe("every type, by the words on the screen", () => {
  it("money, by the formatted figure", () => {
    setup()
    search("salary", "$118,5")
    expect(names()).toEqual(["Zoë Marchetti"])
  })

  it("a date, by its month", () => {
    setup()
    search("joined", "mar")
    expect(names()).toEqual(["Ada Lovelace", "Bea Whitlock"])
  })

  it("a checkbox, by the word it is read as", () => {
    setup()
    search("remote", "no")
    expect(names()).toEqual(["Tom Kerrigan", "Bea Whitlock"])
  })

  /*
    The full spectrum: one column of every built-in type and two custom ones,
    over data built to be awkward. For each column that can be searched, the
    text of a real cell is typed into its header, and the row it came from has
    to still be there — with every row left showing that text too.
  */
  describe("across the whole dataset", () => {
    const NOW = new Date("2026-08-13T12:00:00.000Z")
    const rows = makeRows(60, 21)
    const everyColumn = fullColumns as VanillaColumn<Row>[]
    const searchable = everyColumn.filter((column) => !["image", "json"].includes(column.type ?? ""))

    function mount() {
      return createTable(host, {
        data: rows,
        columns: everyColumn,
        types: customTypes,
        getRowId: (row) => row.id,
        format: { now: NOW, currency: "AUD" },
        pagination: false,
        headerSearch: { debounce: 0 },
      })
    }

    function cellsOf(key: string): Array<{ id: string; cell: HTMLElement }> {
      return [...host.querySelectorAll<HTMLElement>("tbody tr")].flatMap((row) => {
        const cell = row.querySelector<HTMLElement>(`td[data-key="${key}"]`)
        const id = row.querySelector<HTMLElement>('td[data-key="id"]')?.textContent?.trim() ?? ""
        return cell ? [{ id, cell }] : []
      })
    }

    /** What a person would read in a cell and type: one tag of several, or the cell's text. */
    function wordsIn(cell: HTMLElement): string {
      const tag = cell.querySelector(".tpz-tags .tpz-badge")
      return (tag ?? cell).textContent?.trim() ?? ""
    }

    it("leaves the two types that show no text without a magnifier", () => {
      mount()
      expect(trigger("avatar")).toBeNull()
      expect(trigger("payload")).toBeNull()
      expect(host.querySelectorAll(".tpz-th-search")).toHaveLength(searchable.length)
    })

    for (const column of searchable) {
      const key = String(column.key)

      it(`${key} (${column.type ?? "inferred"})`, () => {
        const table = mount()

        const source = cellsOf(key).find(({ cell }) => !cell.querySelector(".tpz-empty-value"))
        expect(source, `a row with a value in ${key}`).toBeDefined()
        if (!source) return

        const typed = wordsIn(source.cell)
        expect(typed).not.toBe("")

        search(key, typed)
        expect(table.getState().filters).toEqual([{ key, operator: "contains", value: typed }])

        const left = cellsOf(key)
        expect(left.length).toBeGreaterThan(0)
        expect(left.map((entry) => entry.id)).toContain(source.id)

        const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
        for (const { cell, id } of left) {
          expect(fold(cell.textContent ?? ""), `${key} in ${id}`).toContain(fold(typed))
        }
      })
    }
  })
})

describe("with the filtering done on a server", () => {
  it("asks for the search and leaves the rows as they were given", () => {
    const onStateChange = vi.fn<(state: TableState) => void>()
    setup({ server: true, total: 4, onStateChange })

    search("joined", "mar")

    expect(onStateChange.mock.calls.at(-1)?.[0]).toMatchObject({
      filters: [{ key: "joined", operator: "contains", value: "mar" }],
      page: 1,
    })
    expect(names()).toHaveLength(4)
  })
})

describe("a link to a search", () => {
  it("opens on the search it carries", () => {
    setup({ state: stateFromUrl("f=name:contains:tom") })

    expect(names()).toEqual(["Tom Kerrigan"])
    expect(trigger("name")?.dataset["active"]).toBe("true")
  })
})

describe("on a server", () => {
  const options: TableOptions<Person> = {
    ...base,
    headerSearch: true,
    state: { filters: [{ key: "joined", operator: "contains", value: "2024" }] },
  }

  it("writes the magnifiers, the rows already searched, and never the box", () => {
    const html = renderToString(options)

    expect(html.match(/class="tpz-th-search"/g)).toHaveLength(5)
    expect(html).not.toContain("tpz-th-searchbox")
    expect(html).toContain('aria-label="Search Joined, searching for 2024"')
    expect(html).toContain('data-active="true"')
    expect(html).toContain("Ada Lovelace")
    expect(html).not.toContain("Tom Kerrigan")
  })

  it("writes exactly what the browser then draws", () => {
    createTable(host, options)
    expect(renderToString(options)).toBe(host.innerHTML)
  })

  it("writes exactly what the browser draws for every type, searched and sorted", () => {
    const everything: TableOptions<Row> = {
      data: makeRows(30, 4),
      columns: fullColumns as VanillaColumn<Row>[],
      types: customTypes,
      getRowId: (row) => row.id,
      format: { now: new Date("2026-08-13T12:00:00.000Z") },
      headerSearch: true,
      search: true,
      state: {
        filters: [
          { key: "seenAt", operator: "contains", value: "2026" },
          { key: "plan", operator: "contains", value: "e" },
        ],
        sort: [
          { key: "plan", direction: "asc" },
          { key: "name", direction: "desc" },
        ],
      },
    }

    createTable(host, everything)
    expect(renderToString(everything)).toBe(host.innerHTML)
  })
})
