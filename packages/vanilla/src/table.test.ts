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
