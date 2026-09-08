/**
 * @vitest-environment jsdom
 *
 * The vanilla adapter is also the reference for the markup every other adapter
 * produces, so these tests assert the structure as well as the behaviour.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createTable, pageWindow } from "./table.js"

type Person = { id: string; name: string; age: number; plan: string; active: boolean; joined: string }

const people: Person[] = [
  { id: "1", name: "Ada", age: 36, plan: "pro", active: true, joined: "2026-01-15" },
  { id: "2", name: "Tom", age: 28, plan: "free", active: false, joined: "2026-03-02" },
  { id: "3", name: "Zoe", age: 44, plan: "pro", active: true, joined: "2025-11-20" },
]

let host: HTMLElement

beforeEach(() => {
  host = document.createElement("div")
  document.body.append(host)
})

afterEach(() => {
  host.remove()
  document.querySelectorAll(".tpz-portal, .tpz-poof").forEach((node) => node.remove())
})

function cells(): string[][] {
  return [...host.querySelectorAll("tbody tr")].map((row) =>
    [...row.querySelectorAll("td")].map((cell) => cell.textContent?.trim() ?? ""),
  )
}

function headers(): string[] {
  return [...host.querySelectorAll("thead th")].map((cell) => cell.textContent?.trim() ?? "")
}

describe("with nothing configured", () => {
  it("renders a real table with a column per field", () => {
    createTable(host, { data: people })

    expect(host.querySelector("table")).toBeTruthy()
    expect(headers().some((header) => header.includes("Name"))).toBe(true)
    expect(cells()).toHaveLength(3)
  })

  it("uses the same class names as the other adapters", () => {
    createTable(host, { data: people })

    expect(host.querySelector(".tpz")).toBeTruthy()
    expect(host.querySelector(".tpz-frame")).toBeTruthy()
    expect(host.querySelector(".tpz-scroll")).toBeTruthy()
    expect(host.querySelector(".tpz-table")).toBeTruthy()
    expect(host.querySelector(".tpz-th")).toBeTruthy()
    expect(host.querySelector(".tpz-td")).toBeTruthy()
  })

  it("labels every cell with its header, for the card layout", () => {
    createTable(host, { data: people, columns: ["name"] })
    expect(host.querySelector("td")?.dataset["label"]).toBe("Name")
  })

  it("formats by inferred type", () => {
    createTable(host, { data: people, columns: ["joined"] })
    expect(host.textContent).toContain("Jan 15, 2026")
  })
})

describe("sorting", () => {
  it("cycles on header clicks", () => {
    createTable(host, { data: people, columns: ["name"] })
    const button = host.querySelector<HTMLButtonElement>("thead .tpz-th-button")!

    button.click()
    expect(cells().map((row) => row[0])).toEqual(["Ada", "Tom", "Zoe"])
    expect(host.querySelector("th")?.getAttribute("aria-sort")).toBe("ascending")

    host.querySelector<HTMLButtonElement>("thead .tpz-th-button")!.click()
    expect(cells().map((row) => row[0])).toEqual(["Zoe", "Tom", "Ada"])
  })

  it("sorts numbers numerically", () => {
    createTable(host, { data: people, columns: ["age"] })
    host.querySelector<HTMLButtonElement>("thead .tpz-th-button")!.click()
    expect(cells().map((row) => row[0])).toEqual(["28", "36", "44"])
  })
})

describe("search", () => {
  it("filters the rows", async () => {
    createTable(host, { data: people, search: { debounce: 0 } })
    const input = host.querySelector<HTMLInputElement>("input[type=search]")!

    input.value = "zoe"
    input.dispatchEvent(new Event("input"))

    await vi.waitFor(() => expect(cells()).toHaveLength(1))
  })
})

describe("selection", () => {
  it("reports what was selected", () => {
    const onSelectionChange = vi.fn()
    createTable(host, { data: people, selection: "multiple", onSelectionChange })

    host.querySelectorAll<HTMLInputElement>("tbody .tpz-select-cell input")[0]!.click()

    expect(onSelectionChange).toHaveBeenCalledWith(["1"], [people[0]])
  })

  it("selects the whole page from the header", () => {
    const table = createTable(host, { data: people, selection: true })
    host.querySelector<HTMLInputElement>("thead .tpz-select-cell input")!.click()
    expect(table.getSelection()).toEqual(["1", "2", "3"])
  })

  const boxes = () => [...host.querySelectorAll<HTMLInputElement>("tbody .tpz-select-cell input")]

  /** A click with shift held. The browser toggles the box and fires change itself. */
  const shiftClick = (box: HTMLInputElement) => {
    box.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, shiftKey: true }))
  }

  it("selects a range with shift held", () => {
    const table = createTable(host, { data: people, selection: true })

    boxes()[0]!.click()
    shiftClick(boxes()[2]!)

    expect(table.getSelection()).toEqual(["1", "2", "3"])
  })

  it("takes the options form, with its own onChange", () => {
    const onChange = vi.fn()
    createTable(host, { data: people, selection: { mode: "single", onChange } })

    expect(boxes()[0]?.type).toBe("radio")
    boxes()[1]!.click()
    expect(onChange).toHaveBeenCalledWith(["2"], [people[1]])
  })

  describe("rows that cannot be selected", () => {
    const inactiveLocked = { isSelectable: (person: Person) => person.active }

    it("have their checkbox disabled", () => {
      createTable(host, { data: people, selection: inactiveLocked })

      expect(boxes().map((box) => box.disabled)).toEqual([false, true, false])
    })

    it("are skipped when the header selects the page, which then reads as complete", () => {
      const table = createTable(host, { data: people, selection: inactiveLocked })

      host.querySelector<HTMLInputElement>("thead .tpz-select-cell input")!.click()

      expect(table.getSelection()).toEqual(["1", "3"])
      const header = host.querySelector<HTMLInputElement>("thead .tpz-select-cell input")!
      expect(header.checked).toBe(true)
      expect(header.indeterminate).toBe(false)
    })

    it("are stepped over by a shift-click range", () => {
      const table = createTable(host, { data: people, selection: inactiveLocked })

      boxes()[0]!.click()
      shiftClick(boxes()[2]!)

      expect(table.getSelection()).toEqual(["1", "3"])
    })
  })
})

describe("slots", () => {
  it("puts the caller's controls in the toolbar, ahead of the built-in ones", () => {
    const button = document.createElement("button")
    button.textContent = "New person"
    createTable(host, { data: people, search: true, toolbar: button })

    const end = host.querySelectorAll(".tpz-toolbar-group")[1]!
    expect(end.firstElementChild).toBe(button)
    expect(end.querySelector(".tpz-search")).toBeTruthy()
  })

  it("shows the toolbar for the caller's controls alone", () => {
    createTable(host, { data: people, columnControl: false, toolbar: "Hello" })
    expect(host.querySelector<HTMLElement>(".tpz-toolbar")?.style.display).toBe("")
  })

  it("pins a row below the last one", () => {
    createTable(host, { data: people, columns: ["name"], appendRow: "Add another" })

    const last = host.querySelector("tbody tr:last-child")!
    expect(last.textContent).toContain("Add another")
    expect(last.querySelector("td")?.getAttribute("colspan")).toBe("1")
    expect(host.querySelectorAll("tbody tr")).toHaveLength(4)
  })

  it("renders a footer between the rows and the pagination", () => {
    const table = createTable(host, { data: people, footer: "3 people" })

    const footer = host.querySelector(".tpz-footer")!
    expect(footer.textContent).toBe("3 people")
    expect(footer.nextElementSibling?.classList.contains("tpz-pagination")).toBe(true)

    table.setOptions({ footer: undefined })
    expect(host.querySelector(".tpz-footer")).toBeNull()
  })

  it("lets the caller replace the empty state", () => {
    const nothing = document.createElement("p")
    nothing.textContent = "No people yet"
    createTable(host, { data: [] as Person[], columns: ["name"], emptyState: nothing })

    expect(host.querySelector("tbody")?.textContent).toContain("No people yet")
    expect(host.querySelector(".tpz-state")).toBeNull()
  })

  it("shows a caption when given one", () => {
    const table = createTable(host, { data: people, caption: "People" })
    expect(host.querySelector("caption.tpz-caption")?.textContent).toBe("People")

    table.setOptions({ caption: undefined })
    expect(host.querySelector("caption")).toBeNull()
  })
})

describe("taking over the classes", () => {
  it("adds a class per slot on top of the default", () => {
    createTable(host, {
      data: people,
      columns: ["name"],
      selection: true,
      className: "mine",
      classNames: { frame: "rounded", headerCell: "muted", row: "hover", cell: "mono", selectCell: "tick" },
    })

    expect(host.querySelector(".tpz")?.className).toBe("tpz mine")
    expect(host.querySelector(".tpz-frame")?.className).toBe("tpz-frame rounded")
    expect(host.querySelector("thead th:not(.tpz-select-cell)")?.className).toBe("tpz-th muted")
    expect(host.querySelector("tbody tr")?.className).toBe("tpz-tr hover")
    expect(host.querySelector("tbody .tpz-select-cell")?.className).toBe("tpz-td tpz-select-cell tick")
    expect(host.querySelector("tbody td:not(.tpz-select-cell)")?.className).toBe("tpz-td mono")
  })

  it("drops the defaults when unstyled", () => {
    createTable(host, { data: people, columns: ["name"], unstyled: true, classNames: { table: "w-full" } })

    expect(host.querySelector("table")?.className).toBe("w-full")
    expect(host.querySelector("tbody td")?.className).toBe("")
  })

  it("keeps a column's own classes", () => {
    createTable(host, { data: people, columns: [{ key: "name", className: "wide", headerClassName: "loud" }] })
    expect(host.querySelector("thead th")?.classList.contains("loud")).toBe(true)
    expect(host.querySelector("tbody td")?.classList.contains("wide")).toBe(true)
  })
})

describe("what the other adapters also do", () => {
  it("marks the table while it is loading, and stops when it is not", () => {
    const table = createTable(host, { data: people, loading: true })
    expect(host.querySelector(".tpz")?.getAttribute("data-loading")).toBe("true")

    table.setOptions({ loading: false })
    expect(host.querySelector(".tpz")?.hasAttribute("data-loading")).toBe(false)
  })

  it("announces the skeleton to a screen reader", () => {
    createTable(host, { data: [] as Person[], columns: ["name"], loading: true })
    expect(host.querySelector("tbody .tpz-sr")?.textContent).toBe("Loading rows")
  })

  it("marks the frozen edge on the last pinned column", () => {
    createTable(host, { data: people, columns: [{ key: "name", pin: "start" }, { key: "plan", pin: "start" }, "age"] })

    const edges = [...host.querySelectorAll("thead th")].map((cell) => cell.getAttribute("data-pin-edge"))
    expect(edges).toEqual([null, "start", null])
    expect(host.querySelector('tbody td[data-key="plan"]')?.getAttribute("data-pin-edge")).toBe("start")
  })

  it("offers to clear a sort, once there is one", () => {
    createTable(host, { data: people, columns: ["name"] })
    const items = () => [...document.querySelectorAll<HTMLElement>(".tpz-portal [data-menu-item]")].map((node) => node.textContent?.trim())

    host.querySelector<HTMLButtonElement>(".tpz-th-menu")!.click()
    expect(items()).not.toContain("Clear sort")
    document.querySelectorAll(".tpz-portal").forEach((node) => node.remove())

    host.querySelector<HTMLButtonElement>(".tpz-th-button")!.click()
    host.querySelector<HTMLButtonElement>(".tpz-th-menu")!.click()
    expect(items()).toContain("Clear sort")
  })

  it("lets two filters be matched either way", () => {
    const table = createTable(host, {
      data: people,
      columns: ["name", "plan"],
      state: {
        filters: [
          { key: "name", operator: "eq", value: "Ada" },
          { key: "plan", operator: "eq", value: "free" },
        ],
      },
    })
    expect(host.querySelector(".tpz-count")?.textContent).toBe("0 rows")

    const toggle = [...host.querySelectorAll<HTMLButtonElement>(".tpz-chips .tpz-btn")].find((button) =>
      button.textContent?.startsWith("Match"),
    )!
    expect(toggle.textContent).toBe("Match all")

    toggle.click()
    expect(table.getState().match).toBe("any")
    expect(host.querySelector(".tpz-count")?.textContent).toBe("2 rows")
  })

  it("applies a search on Enter and clears it on Escape", () => {
    createTable(host, { data: people, columns: ["name"], search: { debounce: 10_000 } })
    const box = host.querySelector<HTMLInputElement>("input[type=search]")!

    box.value = "zoe"
    box.dispatchEvent(new Event("input", { bubbles: true }))
    box.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    expect(cells()).toHaveLength(1)

    box.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    expect(box.value).toBe("")
    expect(cells()).toHaveLength(3)
  })

  it("forgets a dragged width on a double-click", () => {
    const table = createTable(host, { data: people, columns: ["name"], state: { widths: { name: 300 } } })
    expect(host.querySelector<HTMLElement>("thead th")?.style.width).toBe("300px")

    host.querySelector<HTMLButtonElement>(".tpz-resizer")!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
    expect(table.getState().widths).toEqual({})
  })

  it("leaves the clipboard out of the export menu when asked", () => {
    createTable(host, { data: people, export: { clipboard: false } })
    host.querySelector<HTMLButtonElement>('[aria-label="Export"]')!.click()

    const items = [...document.querySelectorAll<HTMLElement>(".tpz-portal [data-menu-item]")].map((node) => node.textContent?.trim())
    expect(items).toEqual(["Download CSV"])
  })
})

describe("pagination", () => {
  const many = Array.from({ length: 55 }, (_, index) => ({ id: String(index), name: `Person ${String(index)}` }))

  it("pages and says where you are", () => {
    createTable(host, { data: many, pagination: { pageSize: 10 } })

    expect(cells()).toHaveLength(10)
    expect(host.textContent).toContain("1–10 of 55")

    host.querySelector<HTMLButtonElement>('[aria-label="Next page"]')!.click()
    expect(host.textContent).toContain("11–20 of 55")
  })

  it("appends in load-more mode", () => {
    createTable(host, { data: many, pagination: { mode: "loadMore", pageSize: 10 } })
    host.querySelector<HTMLButtonElement>(".tpz-pagination .tpz-btn")!.click()
    expect(cells()).toHaveLength(20)
  })
})

describe("the header menu", () => {
  it("opens into the document body, carrying the theme with it", () => {
    createTable(host, { data: people, columns: ["plan"], theme: "dark" })
    host.querySelector<HTMLButtonElement>(".tpz-th-menu")!.click()

    const portal = document.querySelector(".tpz-portal")
    expect(portal).toBeTruthy()
    // Without the class and the theme, none of the `--tpz-*` tokens resolve out
    // there and the menu renders as unstyled text over the table.
    expect(portal?.classList.contains("tpz")).toBe(true)
    expect(portal?.getAttribute("data-theme")).toBe("dark")
    expect(portal?.querySelector('[role="group"]')).toBeTruthy()
  })

  it("offers the values present as a set filter, and applies one", () => {
    createTable(host, { data: people, columns: [{ key: "plan", filter: "set" }] })
    host.querySelector<HTMLButtonElement>(".tpz-th-menu")!.click()

    const boxes = [...document.querySelectorAll<HTMLInputElement>(".tpz-portal .tpz-filter-option input")]
    expect(boxes).toHaveLength(2)

    boxes[0]!.click()
    expect(cells()).toHaveLength(2)
    expect(host.querySelector(".tpz-chip")?.textContent).toContain("Plan is pro")
  })
})

describe("the instance", () => {
  it("replaces the data without losing the arrangement", () => {
    const table = createTable(host, { data: people, columns: ["name"] })
    table.setState({ sort: [{ key: "name", direction: "desc" }] })
    table.setData([...people, { id: "4", name: "Bea", age: 31, plan: "free", active: true, joined: "2026-04-01" }])

    expect(cells().map((row) => row[0])).toEqual(["Zoe", "Tom", "Bea", "Ada"])
  })

  it("cleans up after itself", () => {
    const table = createTable(host, { data: people })
    table.destroy()
    expect(host.querySelector(".tpz")).toBeNull()
  })
})

describe("pageWindow", () => {
  it("shows every page when they fit", () => {
    expect(pageWindow(1, 5, 1)).toEqual([1, 2, 3, 4, 5])
  })

  it("keeps the first, the last and the current one, with gaps between", () => {
    expect(pageWindow(10, 20, 1)).toEqual([1, "gap", 9, 10, 11, "gap", 20])
    expect(pageWindow(1, 20, 1)).toEqual([1, 2, "gap", 20])
  })
})

describe("parity with the other adapters", () => {
  it("offers a rows-per-page picker when asked", () => {
    createTable(host, {
      data: Array.from({ length: 40 }, (_, index) => ({ id: String(index), name: `P${String(index)}` })),
      pagination: { pageSize: 10, pageSizeOptions: [10, 20] },
    })

    const select = host.querySelector<HTMLSelectElement>(".tpz-pagination select")!
    expect(select).toBeTruthy()

    select.value = "20"
    select.dispatchEvent(new Event("change"))
    expect(cells()).toHaveLength(20)
  })

  it("makes the whole header the drag handle", () => {
    createTable(host, { data: people, columns: ["name", "plan"] })

    const headers = [...host.querySelectorAll<HTMLElement>(".tpz-th")]
    expect(headers[0]?.dataset["draggable"]).toBe("true")
    expect((headers[0] as HTMLTableCellElement).draggable).toBe(true)
  })

  it("leaves a pinned column undraggable, as pinning already decides its place", () => {
    createTable(host, { data: people, columns: [{ key: "name", pin: "start" }, "plan"] })
    expect(host.querySelector<HTMLElement>(".tpz-th")?.dataset["draggable"]).toBeUndefined()
  })
})

/**
 * jsdom has no drag-and-drop, so these build the events by hand. That is
 * honest enough: the handlers only ever read `dataTransfer`, the pointer
 * position and the element's own rectangle, and all three are supplied here
 * exactly as a browser would.
 */
function dragEvent(type: string, dataTransfer: Partial<DataTransfer>, point: { x: number; y: number }) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: point.x, clientY: point.y })
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer })
  return event
}

function transfer(payload: Record<string, string> = {}, dropEffect: string = "move") {
  return {
    dropEffect,
    effectAllowed: "move",
    setData: (format: string, value: string) => {
      payload[format] = value
    },
    getData: (format: string) => payload[format] ?? "",
  } as unknown as DataTransfer
}

describe("reordering columns by dragging the header", () => {
  function headers() {
    return [...host.querySelectorAll<HTMLElement>(".tpz-th")]
  }

  function rect(node: HTMLElement, left: number, width: number) {
    // jsdom lays nothing out, so every rectangle is zero unless it is told.
    node.getBoundingClientRect = () =>
      ({ left, right: left + width, top: 0, bottom: 32, width, height: 32, x: left, y: 0, toJSON: () => ({}) }) as DOMRect
  }

  it("drops a column after the one it was released on", () => {
    createTable(host, { data: people, columns: ["name", "plan", "email"] })
    const [name, , email] = headers()

    const payload = {}
    name!.dispatchEvent(dragEvent("dragstart", transfer(payload), { x: 0, y: 0 }))

    rect(email!, 200, 100)
    email!.dispatchEvent(dragEvent("dragover", transfer(payload), { x: 280, y: 10 }))
    email!.dispatchEvent(dragEvent("drop", transfer(payload), { x: 280, y: 10 }))

    expect(headers().map((cell) => cell.dataset["key"])).toEqual(["plan", "email", "name"])
  })

  it("drops it before, when released on the left half", () => {
    createTable(host, { data: people, columns: ["name", "plan", "email"] })
    const [name, , email] = headers()

    const payload = {}
    name!.dispatchEvent(dragEvent("dragstart", transfer(payload), { x: 0, y: 0 }))

    rect(email!, 200, 100)
    email!.dispatchEvent(dragEvent("dragover", transfer(payload), { x: 220, y: 10 }))
    email!.dispatchEvent(dragEvent("drop", transfer(payload), { x: 220, y: 10 }))

    expect(headers().map((cell) => cell.dataset["key"])).toEqual(["plan", "name", "email"])
  })

  it("marks the edge the column will land on while it is in the air", () => {
    createTable(host, { data: people, columns: ["name", "plan"] })
    const [, plan] = headers()

    rect(plan!, 100, 100)
    plan!.dispatchEvent(dragEvent("dragover", transfer(), { x: 190, y: 10 }))
    expect(plan!.dataset["drop"]).toBe("after")

    plan!.dispatchEvent(dragEvent("dragover", transfer(), { x: 110, y: 10 }))
    expect(plan!.dataset["drop"]).toBe("before")

    plan!.dispatchEvent(new MouseEvent("dragleave", { bubbles: true }))
    expect(plan!.dataset["drop"]).toBeUndefined()
  })
})

describe("removing a column by dragging it out", () => {
  function frameRect() {
    const frame = host.querySelector<HTMLElement>(".tpz-frame")!
    frame.getBoundingClientRect = () =>
      ({ left: 0, right: 400, top: 0, bottom: 200, width: 400, height: 200, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
  }

  it("hides the column when it is released outside the table", () => {
    createTable(host, { data: people, columns: ["name", "plan"] })
    frameRect()

    const name = host.querySelector<HTMLElement>(".tpz-th")!
    name.dispatchEvent(dragEvent("dragend", transfer({}, "none"), { x: 900, y: 600 }))

    expect([...host.querySelectorAll(".tpz-th")].map((cell) => (cell as HTMLElement).dataset["key"])).toEqual(["plan"])
  })

  it("keeps it when the drop landed inside the table", () => {
    createTable(host, { data: people, columns: ["name", "plan"] })
    frameRect()

    const name = host.querySelector<HTMLElement>(".tpz-th")!
    name.dispatchEvent(dragEvent("dragend", transfer({}, "none"), { x: 120, y: 40 }))

    expect(host.querySelectorAll(".tpz-th")).toHaveLength(2)
  })

  it("refuses to remove the last column, which would leave nothing to look at", () => {
    createTable(host, { data: people, columns: ["name"] })
    frameRect()

    const name = host.querySelector<HTMLElement>(".tpz-th")!
    name.dispatchEvent(dragEvent("dragend", transfer({}, "none"), { x: 900, y: 600 }))

    expect(host.querySelectorAll(".tpz-th")).toHaveLength(1)
  })
})

describe("reordering inside the column list", () => {
  it("drags one row above another", () => {
    createTable(host, { data: people, columns: ["name", "plan", "email"] })
    host.querySelectorAll<HTMLButtonElement>(".tpz-toolbar .tpz-btn")[0]!.click()

    const rows = [...document.querySelectorAll<HTMLElement>(".tpz-portal .tpz-filter-option")]
    expect(rows.map((row) => row.textContent?.trim())).toEqual(["Name", "Plan", "Email"])

    const payload = {}
    rows[2]!.dispatchEvent(dragEvent("dragstart", transfer(payload), { x: 0, y: 0 }))

    rows[0]!.getBoundingClientRect = () =>
      ({ left: 0, right: 200, top: 0, bottom: 24, width: 200, height: 24, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
    rows[0]!.dispatchEvent(dragEvent("dragover", transfer(payload), { x: 10, y: 4 }))
    rows[0]!.dispatchEvent(dragEvent("drop", transfer(payload), { x: 10, y: 4 }))

    expect([...host.querySelectorAll(".tpz-th")].map((cell) => (cell as HTMLElement).dataset["key"])).toEqual([
      "email",
      "name",
      "plan",
    ])
  })
})

/**
 * Infinite scrolling.
 *
 * jsdom has no layout and no IntersectionObserver, so the observer is stubbed —
 * which is enough to assert the two things that were wrong: where the sentinel
 * lives, and how often it may fire.
 */
describe("infinite scrolling", () => {
  let observed: Array<{ root: unknown; fire: () => void }> = []

  beforeEach(() => {
    observed = []
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        callback: (entries: Array<{ isIntersecting: boolean }>) => void
        options: { root?: unknown }
        constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void, options = {}) {
          this.callback = callback
          this.options = options
        }
        observe() {
          observed.push({ root: this.options.root ?? null, fire: () => this.callback([{ isIntersecting: true }]) })
        }
        disconnect() {}
        unobserve() {}
        takeRecords() {
          return []
        }
      },
    )
  })

  afterEach(() => vi.unstubAllGlobals())

  const many = Array.from({ length: 200 }, (_, index) => ({ id: String(index), name: `Person ${String(index)}` }))

  it("puts the sentinel inside the scroll container, not in the pagination bar", () => {
    createTable(host, { data: many, pagination: { mode: "infinite", pageSize: 10 } })

    const sentinel = host.querySelector(".tpz-sentinel")
    expect(sentinel).toBeTruthy()
    expect(host.querySelector(".tpz-scroll")?.contains(sentinel!)).toBe(true)
    expect(host.querySelector(".tpz-pagination .tpz-sentinel")).toBeNull()
  })

  it("loads one page each time it is reached", () => {
    createTable(host, { data: many, pagination: { mode: "infinite", pageSize: 10 } })

    expect(cells()).toHaveLength(10)
    observed.at(-1)!.fire()
    expect(cells()).toHaveLength(20)
    observed.at(-1)!.fire()
    expect(cells()).toHaveLength(30)
  })

  it("stops observing once every row is loaded", () => {
    createTable(host, { data: many.slice(0, 12), pagination: { mode: "infinite", pageSize: 10 } })

    observed.at(-1)!.fire()
    expect(cells()).toHaveLength(12)

    const settled = observed.length
    observed.at(-1)!.fire()
    expect(observed.length).toBe(settled)
  })
})

describe("cleaning up after itself", () => {
  it("leaves nothing behind after many tables have come and gone", () => {
    const listeners = { added: 0, removed: 0 }
    const originalAdd = document.addEventListener.bind(document)
    const originalRemove = document.removeEventListener.bind(document)

    document.addEventListener = ((...args: Parameters<typeof originalAdd>) => {
      listeners.added += 1
      return originalAdd(...args)
    }) as typeof document.addEventListener

    document.removeEventListener = ((...args: Parameters<typeof originalRemove>) => {
      listeners.removed += 1
      return originalRemove(...args)
    }) as typeof document.removeEventListener

    for (let index = 0; index < 25; index += 1) {
      const container = document.createElement("div")
      document.body.append(container)

      const table = createTable(container, {
        data: people,
        search: true,
        selection: "multiple",
        pagination: { mode: "infinite", pageSize: 2 },
      })

      // Open a panel, which is what attaches document-level listeners.
      container.querySelector<HTMLButtonElement>(".tpz-th-menu")?.click()
      table.destroy()
      container.remove()
    }

    document.addEventListener = originalAdd
    document.removeEventListener = originalRemove

    // Every panel that opened has closed, and taken its listeners with it.
    // (The puff of smoke shown when a column is dragged out carries the root
    // class too — it needs the tokens — and removes itself on its own.)
    expect(document.querySelectorAll(".tpz-portal")).toHaveLength(0)
    expect(document.querySelectorAll(".tpz-frame")).toHaveLength(0)
    expect(listeners.removed).toBeGreaterThanOrEqual(listeners.added)
  })

  it("stops observing when it is taken apart mid-scroll", () => {
    let disconnected = 0
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        disconnect() {
          disconnected += 1
        }
        unobserve() {}
        takeRecords() {
          return []
        }
      },
    )

    const table = createTable(host, {
      data: Array.from({ length: 50 }, (_, index) => ({ id: String(index), name: `P${String(index)}` })),
      pagination: { mode: "infinite", pageSize: 10 },
    })

    table.destroy()
    expect(disconnected).toBeGreaterThan(0)
    vi.unstubAllGlobals()
  })
})

describe("set filters and pagination", () => {
  /** Three hundred rows, and one owner who appears only near the very end. */
  const many = Array.from({ length: 300 }, (_, index) => ({
    id: String(index),
    name: `Person ${String(index)}`,
    owner: index === 287 ? "Wren" : index % 3 === 0 ? "Ada" : index % 3 === 1 ? "Tom" : "Zoe",
  }))

  const openOwnerFilter = () => {
    host.querySelectorAll<HTMLButtonElement>(".tpz-th-menu")[1]!.click()
    return document.querySelector<HTMLElement>(".tpz-portal")!
  }

  it("offers a value that appears only on a much later page", () => {
    createTable(host, {
      data: many,
      columns: ["name", { key: "owner", filter: "set" }],
      pagination: { pageSize: 10 },
    })

    expect(cells().map((row) => row[1])).not.toContain("Wren")

    const panel = openOwnerFilter()
    const labels = [...panel.querySelectorAll(".tpz-filter-option-label")].map((node) => node.textContent)
    expect(labels).toContain("Wren")
    expect(labels).toHaveLength(4)
  })

  it("shows those rows the moment the value is chosen", () => {
    createTable(host, {
      data: many,
      columns: ["name", { key: "owner", filter: "set" }],
      pagination: { pageSize: 10 },
    })

    const panel = openOwnerFilter()
    const wren = [...panel.querySelectorAll<HTMLElement>(".tpz-filter-option")].find(
      (option) => option.textContent?.trim() === "Wren",
    )!
    wren.querySelector("input")!.click()

    expect(cells().map((row) => row[1])).toEqual(["Wren"])
  })

  it("finds a value beyond the ones it lists, when the user types", () => {
    const crowded = Array.from({ length: 2_000 }, (_, index) => ({
      id: String(index),
      name: `Person ${String(index)}`,
      owner: index === 1_999 ? "Solitary" : `Owner ${String(index % 250)}`,
    }))

    createTable(host, {
      data: crowded,
      columns: ["name", { key: "owner", filter: "set" }],
      pagination: { pageSize: 10 },
    })

    const panel = openOwnerFilter()
    const search = panel.querySelector<HTMLInputElement>("input[type=search]")!
    expect(search).toBeTruthy()

    // The rarest value in two thousand rows must still be reachable.
    search.value = "solitary"
    search.dispatchEvent(new Event("input"))

    const labels = [...panel.querySelectorAll(".tpz-filter-option-label")].map((node) => node.textContent)
    expect(labels).toEqual(["Solitary"])
  })

  it("says how many it is not showing", () => {
    const crowded = Array.from({ length: 1_000 }, (_, index) => ({
      id: String(index),
      owner: `Owner ${String(index)}`,
    }))

    createTable(host, { data: crowded, columns: [{ key: "owner", filter: "set" }] })
    host.querySelector<HTMLButtonElement>(".tpz-th-menu")!.click()

    const panel = document.querySelector<HTMLElement>(".tpz-portal")!
    expect(panel.querySelectorAll(".tpz-filter-option")).toHaveLength(200)
    expect(panel.textContent).toContain("800 more")
  })
})

describe("what an export contains", () => {
  const many = Array.from({ length: 120 }, (_, index) => ({
    id: String(index),
    name: `Person ${String(index).padStart(3, "0")}`,
    plan: index % 3 === 0 ? "pro" : "free",
  }))

  let downloaded: string | undefined

  beforeEach(() => {
    downloaded = undefined
    vi.stubGlobal(
      "Blob",
      class {
        constructor(parts: string[]) {
          downloaded = parts.join("")
        }
      },
    )
    vi.stubGlobal("URL", { createObjectURL: () => "blob:test", revokeObjectURL: () => {} })
  })

  afterEach(() => vi.unstubAllGlobals())

  const download = (options: Record<string, unknown> = {}) => {
    createTable(host, {
      data: many,
      columns: ["name", "plan"],
      getRowId: (row) => row.id,
      pagination: { pageSize: 10 },
      export: true,
      ...options,
    })

    host.querySelector<HTMLButtonElement>('[aria-label="Export"]')!.click()
    const item = [...document.querySelectorAll<HTMLElement>(".tpz-portal [data-menu-item]")].find((node) =>
      node.textContent?.includes("Download"),
    )!
    item.click()

    return (downloaded ?? "").trim().split("\r\n").slice(1)
  }

  it("holds every matching row, not the page on screen", () => {
    // Ten rows are visible; a hundred and twenty must be in the file.
    expect(download()).toHaveLength(120)
  })

  it("holds only what a filter leaves", () => {
    expect(download({ state: { filters: [{ key: "plan", operator: "eq", value: "pro" }] } })).toHaveLength(40)
  })

  it("holds just the page when that is what was asked for", () => {
    expect(download({ export: { scope: "page" } })).toHaveLength(10)
  })

  it("hands the job over when the caller asks to do it", () => {
    const onExport = vi.fn()
    download({ export: { onExport } })

    expect(onExport).toHaveBeenCalledTimes(1)
    expect(onExport.mock.calls[0]?.[1]).toHaveLength(120)
    expect(downloaded).toBeUndefined()
  })

  it("holds the selection when there is one", () => {
    const exported = download({ selection: true, state: { selection: ["3", "7"] } })

    expect(exported).toHaveLength(2)
    expect(downloaded).toContain("Person 003")
    expect(downloaded).toContain("Person 007")
  })

  it("hands the selection to onExport", () => {
    const onExport = vi.fn()
    download({ selection: true, state: { selection: ["3", "7"] }, export: { onExport } })

    expect(onExport.mock.calls[0]?.[1]).toHaveLength(2)
  })

  it("does not ask the caller for rows it already has", () => {
    const fetchRows = vi.fn(() => many)
    download({ server: true, total: 480, selection: true, state: { selection: ["3", "7"] }, export: { fetchRows } })

    expect(fetchRows).not.toHaveBeenCalled()
    expect(downloaded).toContain("Person 003")
  })

  it("asks for the rest when the selection reaches past the page it can see", async () => {
    // Row 3 is on the page; row 115 is not, and only the caller can supply it.
    const fetchRows = vi.fn(() => many)
    download({
      data: many.slice(0, 10),
      server: true,
      total: 480,
      selection: true,
      state: { selection: ["3", "115"] },
      export: { fetchRows },
    })

    expect(fetchRows).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(downloaded).toContain("Person 115"))
    expect((downloaded ?? "").trim().split("\r\n").slice(1)).toHaveLength(2)
  })
})

describe("server-side data, made whole", () => {
  const STATUSES = [
    { value: "draft", label: "Draft" },
    { value: "sent", label: "Sent" },
    { value: "paid", label: "Paid" },
    { value: "overdue", label: "Overdue" },
  ]

  /** One page, as a server would send it. Only two statuses appear. */
  const onePage = [
    { id: "1", reference: "INV-001", status: "draft" },
    { id: "2", reference: "INV-002", status: "sent" },
  ]

  const openStatusFilter = () => {
    host.querySelectorAll<HTMLButtonElement>(".tpz-th-menu")[1]!.click()
    return document.querySelector<HTMLElement>(".tpz-portal")!
  }

  const choices = (panel: HTMLElement) =>
    [...panel.querySelectorAll(".tpz-filter-option-label")].map((node) => node.textContent)

  it("offers the whole list when the column is given one", () => {
    createTable(host, {
      data: onePage,
      columns: ["reference", { key: "status", filter: { kind: "set", options: STATUSES } }],
      server: true,
      total: 480,
      pagination: { pageSize: 2 },
    })

    expect(choices(openStatusFilter())).toEqual(["Draft", "Sent", "Paid", "Overdue"])
  })

  it("fetches the list when the column is given a way to", async () => {
    const fetchOptions = vi.fn(() => Promise.resolve(STATUSES))

    createTable(host, {
      data: onePage,
      columns: ["reference", { key: "status", filter: { kind: "set", options: fetchOptions } }],
      server: true,
      total: 480,
      pagination: { pageSize: 2 },
    })

    const panel = openStatusFilter()
    expect(fetchOptions).toHaveBeenCalledTimes(1)
    expect(panel.textContent).toContain("Loading values…")

    await vi.waitFor(() => expect(choices(panel)).toEqual(["Draft", "Sent", "Paid", "Overdue"]))

    // Remembered, so opening it again asks nobody anything.
    document.querySelectorAll(".tpz-portal").forEach((node) => node.remove())
    expect(choices(openStatusFilter())).toHaveLength(4)
    expect(fetchOptions).toHaveBeenCalledTimes(1)
  })

  it("writes the file from whatever the caller fetches", async () => {
    let downloaded: string | undefined
    vi.stubGlobal("Blob", class {
      constructor(parts: string[]) {
        downloaded = parts.join("")
      }
    })
    vi.stubGlobal("URL", { createObjectURL: () => "blob:test", revokeObjectURL: () => {} })

    const everything = Array.from({ length: 480 }, (_, index) => ({
      id: String(index),
      reference: `INV-${String(index).padStart(3, "0")}`,
      status: "paid",
    }))

    createTable(host, {
      data: onePage,
      columns: ["reference", "status"],
      server: true,
      total: 480,
      pagination: { pageSize: 2 },
      export: { fetchRows: () => Promise.resolve(everything) },
    })

    host.querySelector<HTMLButtonElement>('[aria-label="Export"]')!.click()
    const item = [...document.querySelectorAll<HTMLElement>(".tpz-portal [data-menu-item]")].find((node) =>
      node.textContent?.includes("Download"),
    )!
    item.click()

    await vi.waitFor(() => expect(downloaded).toBeDefined())
    expect((downloaded ?? "").replace(/\r?\n$/, "").split("\r\n")).toHaveLength(481)

    vi.unstubAllGlobals()
  })
})

describe("telling the table once where the answers come from", () => {
  const STATUSES = ["draft", "sent", "paid", "overdue"]

  const onePage = [
    { id: "1", reference: "INV-001", status: "draft" },
    { id: "2", reference: "INV-002", status: "sent" },
  ]

  const everything = Array.from({ length: 480 }, (_, index) => ({
    id: String(index),
    reference: `INV-${String(index).padStart(3, "0")}`,
    status: STATUSES[index % 4]!,
  }))

  const openStatusFilter = () => {
    host.querySelectorAll<HTMLButtonElement>(".tpz-th-menu")[1]!.click()
    return document.querySelector<HTMLElement>(".tpz-portal")!
  }

  const choices = (panel: HTMLElement) =>
    [...panel.querySelectorAll(".tpz-filter-option-label")].map((node) => node.textContent)

  /** One object, and every set-filter column and the export use it. */
  const source = () => ({
    distinct: vi.fn((columnKey: string) =>
      Promise.resolve([...new Set(everything.map((row) => row[columnKey as "status"]))]),
    ),
    all: vi.fn(() => Promise.resolve(everything)),
  })

  it("fetches a set filter's values without the column being told to", async () => {
    const server = source()

    createTable(host, {
      data: onePage,
      columns: ["reference", { key: "status", filter: "set" }],
      server,
      total: 480,
      pagination: { pageSize: 2 },
    })

    const panel = openStatusFilter()
    expect(server.distinct).toHaveBeenCalledWith("status", expect.objectContaining({ page: 1 }))

    await vi.waitFor(() => expect(choices(panel)).toEqual(STATUSES))

    // Remembered per column, so reopening it asks nobody anything.
    document.querySelectorAll(".tpz-portal").forEach((node) => node.remove())
    expect(choices(openStatusFilter())).toHaveLength(4)
    expect(server.distinct).toHaveBeenCalledTimes(1)
  })

  it("still lets a column overrule it", () => {
    const server = source()

    createTable(host, {
      data: onePage,
      columns: ["reference", { key: "status", filter: { kind: "set", options: ["only", "these"] } }],
      server,
      total: 480,
      pagination: { pageSize: 2 },
    })

    expect(choices(openStatusFilter())).toEqual(["only", "these"])
    expect(server.distinct).not.toHaveBeenCalled()
  })

  it("exports everything without the export being told to", async () => {
    let downloaded: string | undefined
    vi.stubGlobal("Blob", class {
      constructor(parts: string[]) {
        downloaded = parts.join("")
      }
    })
    vi.stubGlobal("URL", { createObjectURL: () => "blob:test", revokeObjectURL: () => {} })

    const server = source()

    createTable(host, {
      data: onePage,
      columns: ["reference", "status"],
      server,
      total: 480,
      pagination: { pageSize: 2 },
      export: true,
    })

    host.querySelector<HTMLButtonElement>('[aria-label="Export"]')!.click()
    const item = [...document.querySelectorAll<HTMLElement>(".tpz-portal [data-menu-item]")].find((node) =>
      node.textContent?.includes("Download"),
    )!
    item.click()

    await vi.waitFor(() => expect(downloaded).toBeDefined())
    expect((downloaded ?? "").replace(/\r?\n$/, "").split("\r\n")).toHaveLength(481)
    expect(server.all).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 2 }))

    vi.unstubAllGlobals()
  })
})

describe("row height", () => {
  it("takes the density it is given, and follows a change to it", () => {
    const table = createTable(host, { data: people, density: "compact" })
    expect(host.querySelector(".tpz")?.getAttribute("data-density")).toBe("compact")

    table.setOptions({ density: "relaxed" })
    expect(host.querySelector(".tpz")?.getAttribute("data-density")).toBe("relaxed")
  })

  it("offers the switch when asked, and changes the rows with it", () => {
    createTable(host, { data: people, densityControl: true })

    host.querySelector<HTMLButtonElement>('[aria-label="Row height"]')!.click()
    const items = [...document.querySelectorAll<HTMLElement>(".tpz-portal [data-menu-item]")]
    expect(items.map((item) => item.textContent?.trim())).toEqual(["Compact", "Normal", "Relaxed"])

    items[0]!.click()
    expect(host.querySelector(".tpz")?.getAttribute("data-density")).toBe("compact")
  })

  it("has no switch unless one was asked for", () => {
    createTable(host, { data: people })
    expect(host.querySelector('[aria-label="Row height"]')).toBeNull()
  })
})

describe("options that change while the table is running", () => {
  it("follows a new page size, and starts again from the first page", () => {
    const many = Array.from({ length: 30 }, (_, index) => ({ id: String(index), name: `P${String(index)}` }))
    const table = createTable(host, { data: many, columns: ["name"], pagination: { pageSize: 5 } })

    host.querySelector<HTMLButtonElement>('[aria-label="Next page"]')!.click()
    expect(cells()[0]?.[0]).toBe("P5")

    table.setOptions({ pagination: { pageSize: 10 } })
    expect(host.querySelectorAll("tbody tr")).toHaveLength(10)
    expect(cells()[0]?.[0]).toBe("P0")
  })

  it("starts from defaultState and never reads it again", () => {
    const table = createTable(host, {
      data: people,
      columns: ["name"],
      defaultState: { sort: [{ key: "name", direction: "desc" }] },
    })
    expect(cells().map((row) => row[0])).toEqual(["Zoe", "Tom", "Ada"])

    // The person changes the sort; a new defaultState from the caller is not a
    // new instruction, the way a new `state` would be.
    host.querySelector<HTMLButtonElement>(".tpz-th-button")!.click()
    table.setOptions({ defaultState: { sort: [{ key: "name", direction: "desc" }] } })
    expect(cells().map((row) => row[0])).not.toEqual(["Zoe", "Tom", "Ada"])
  })

  it("follows a new state, and leaves the rest of the arrangement alone", () => {
    const table = createTable(host, { data: people, columns: ["name", "plan"] })

    table.setOptions({ state: { sort: [{ key: "name", direction: "desc" }] } })
    expect(cells().map((row) => row[0])).toEqual(["Zoe", "Tom", "Ada"])

    // Something else changing must not undo it.
    table.setOptions({ search: true })
    expect(cells().map((row) => row[0])).toEqual(["Zoe", "Tom", "Ada"])
  })
})

/**
 * Row height, and what it costs to add a page.
 *
 * jsdom has no layout, so how tall a row ends up is not observable here — the
 * stylesheet decides that, and the e2e suite measures it in a real browser.
 * What is observable, and what actually goes wrong, is how much of the table a
 * render throws away. These assert on element identity: a `<tr>` that is still
 * the same object was not rebuilt.
 */
describe("row height", () => {
  const many = Array.from({ length: 100 }, (_, index) => ({
    id: String(index),
    name: `P${String(index)}`,
  }))

  function rows() {
    return [...host.querySelectorAll("tbody tr")]
  }

  /**
   * Element identity, not structure. `toEqual` compares DOM nodes with
   * `isEqualNode`, which a rebuilt row passes — so it cannot tell a row that
   * was kept from one that was thrown away and built again the same.
   */
  function sameNodes(a: Element[], b: Element[]): boolean {
    return a.length === b.length && a.every((node, index) => node === b[index])
  }

  it("says nothing by default, so the fixed-height stylesheet applies", () => {
    createTable(host, { data: people })
    expect(host.querySelector<HTMLElement>(".tpz")!.dataset["rowHeight"]).toBeUndefined()
  })

  it("marks the table when rows size themselves", () => {
    createTable(host, { data: people, rowHeight: "auto" })
    expect(host.querySelector<HTMLElement>(".tpz")!.dataset["rowHeight"]).toBe("auto")
  })

  it("sets the height token and marks the table exact when given a number", () => {
    const table = createTable(host, { data: people, rowHeight: 56 })
    const root = host.querySelector<HTMLElement>(".tpz")!

    expect(root.style.getPropertyValue("--tpz-row-height")).toBe("56px")
    expect(root.dataset["rowHeight"]).toBe("exact")

    // And gives both back when the caller changes their mind.
    table.setOptions({ rowHeight: "fixed" })
    expect(root.style.getPropertyValue("--tpz-row-height")).toBe("")
    expect(root.dataset["rowHeight"]).toBeUndefined()
  })

  it("marks a column told to wrap, one told not to, and clamps one given a count", () => {
    createTable(host, {
      data: people,
      rowHeight: "auto",
      columns: [{ key: "name", wrap: false }, { key: "plan", wrap: true }, { key: "joined", wrap: 3 }],
    })

    const [name, plan, joined] = [...host.querySelectorAll("tbody tr:first-child td")]
    expect(name?.getAttribute("data-wrap")).toBe("false")
    expect(plan?.getAttribute("data-wrap")).toBe("true")
    expect(joined?.getAttribute("data-wrap")).toBe("true")

    const clamp = joined?.querySelector<HTMLElement>(".tpz-clamp")
    expect(clamp?.style.getPropertyValue("--tpz-cell-lines")).toBe("3")
    expect(clamp?.textContent?.trim()).not.toBe("")
  })

  /*
    The bug this whole path exists for: an infinite list holds every page
    loaded so far, and reaching the sentinel used to rebuild all of them.
  */
  it("adds an appended page without rebuilding the rows already on screen", () => {
    const table = createTable(host, {
      data: many,
      getRowId: (row) => row.id,
      pagination: { mode: "loadMore", pageSize: 10 },
    })

    const first = rows()
    expect(first).toHaveLength(10)

    table.setState({ page: 2 })

    const second = rows()
    expect(second).toHaveLength(20)
    // The same ten elements, in the same places, untouched.
    expect(sameNodes(second.slice(0, 10), first)).toBe(true)
    expect(second[10]?.textContent).toContain("P10")
  })

  it("keeps the header alive across an append, so focus survives it", () => {
    const table = createTable(host, {
      data: many,
      getRowId: (row) => row.id,
      pagination: { mode: "loadMore", pageSize: 10 },
    })

    const header = host.querySelector("thead tr")
    table.setState({ page: 2 })
    expect(host.querySelector("thead tr")).toBe(header)
  })

  it("selects every row loaded so far, not the page the header was built with", () => {
    const table = createTable(host, {
      data: many,
      getRowId: (row) => row.id,
      selection: "multiple",
      pagination: { mode: "loadMore", pageSize: 10 },
    })

    table.setState({ page: 3 })
    expect(rows()).toHaveLength(30)

    host.querySelector<HTMLInputElement>("thead .tpz-checkbox")!.click()
    expect(host.querySelectorAll("tbody tr[data-selected]")).toHaveLength(30)
  })

  it("marks a selected row without rebuilding the table around it", () => {
    createTable(host, {
      data: many,
      getRowId: (row) => row.id,
      selection: "multiple",
      pagination: { mode: "loadMore", pageSize: 10 },
    })

    const before = rows()
    before[4]!.querySelector<HTMLInputElement>(".tpz-checkbox")!.click()

    expect(sameNodes(rows(), before)).toBe(true)
    expect((before[4] as HTMLElement).dataset["selected"]).toBe("true")
    expect(host.querySelectorAll("tbody tr[data-selected]")).toHaveLength(1)

    // And clears it again, still without a rebuild.
    before[4]!.querySelector<HTMLInputElement>(".tpz-checkbox")!.click()
    expect(sameNodes(rows(), before)).toBe(true)
    expect((before[4] as HTMLElement).dataset["selected"]).toBeUndefined()
  })

  it("rebuilds when the rows themselves changed rather than grew", () => {
    const table = createTable(host, { data: people, columns: ["name", "plan"] })
    const before = rows()

    // Sorting is not an append, whatever the ids say.
    table.setState({ sort: [{ key: "name", direction: "desc" }] })
    expect(cells().map((row) => row[0])).toEqual(["Zoe", "Tom", "Ada"])
    expect(rows()[0]).not.toBe(before[0])
  })

  it("rebuilds when a row is replaced but keeps its id", () => {
    const table = createTable(host, { data: people, getRowId: (row) => row.id, columns: ["name"] })

    table.setData([{ ...people[0]!, name: "Ada Lovelace" }, ...people.slice(1)])
    expect(cells()[0]?.[0]).toBe("Ada Lovelace")
  })

  it("marks the right row when an error is sitting above them", () => {
    /*
      An error renders a row of its own, above the data. Anything that finds a
      row by counting the body's children is off by one from there down — so
      the rows are held onto directly instead.
    */
    createTable(host, {
      data: many,
      getRowId: (row) => row.id,
      selection: "multiple",
      error: "Could not reach the server",
      pagination: { mode: "loadMore", pageSize: 10 },
    })

    const dataRows = [...host.querySelectorAll("tbody tr")].filter((row) =>
      row.querySelector(".tpz-checkbox"),
    )
    expect(dataRows).toHaveLength(10)

    dataRows[4]!.querySelector<HTMLInputElement>(".tpz-checkbox")!.click()
    expect((dataRows[4] as HTMLElement).dataset["selected"]).toBe("true")
    expect(host.querySelectorAll("tbody tr[data-selected]")).toHaveLength(1)
  })

  it("keeps the rows on screen while loading is toggled around an appended page", () => {
    /*
      How a server-side "load more" goes: loading on, fetch, rows appended,
      loading off. Every step but the append comes through `setOptions`, and
      for a while any call to it rebuilt the body — which made the cheap path
      unreachable from the Vue and Svelte adapters, where `loading` is a prop.
    */
    const table = createTable(host, {
      data: many.slice(0, 10),
      getRowId: (row) => row.id,
      pagination: { mode: "loadMore", pageSize: 10 },
    })
    const first = rows()

    table.setOptions({ loading: true })
    expect(host.querySelector<HTMLElement>(".tpz")!.dataset["loading"]).toBe("true")
    expect(sameNodes(rows(), first)).toBe(true)

    table.setOptions({ loading: false, data: many.slice(0, 20) })
    table.setState({ page: 2 })
    expect(host.querySelector<HTMLElement>(".tpz")!.dataset["loading"]).toBeUndefined()

    const second = rows()
    expect(second).toHaveLength(20)
    expect(sameNodes(second.slice(0, 10), first)).toBe(true)
  })

  it("puts an appended page above the caller's appended row", () => {
    const appendRow = document.createElement("span")
    appendRow.textContent = "New row"
    const table = createTable(host, {
      data: many,
      getRowId: (row) => row.id,
      pagination: { mode: "loadMore", pageSize: 10 },
      appendRow,
    })

    table.setState({ page: 2 })

    const all = [...host.querySelectorAll("tbody tr")]
    expect(all).toHaveLength(21)
    expect(all[19]?.textContent).toContain("P19")
    expect(all[20]?.textContent).toBe("New row")
  })

  it("rebuilds when the columns change", () => {
    const table = createTable(host, { data: people, columns: ["name"] })
    expect(headers()).toHaveLength(1)

    table.setOptions({ columns: ["name", "plan"] })
    expect(headers()).toHaveLength(2)
    expect(cells()[0]).toHaveLength(2)
  })
})
