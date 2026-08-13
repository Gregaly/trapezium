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
  document.querySelectorAll(".tpz-portal").forEach((node) => node.remove())
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

  it("makes the header icon a drag handle for reordering", () => {
    createTable(host, { data: people, columns: ["name", "plan"] })

    const handles = [...host.querySelectorAll<HTMLElement>(".tpz-th-icon")]
    expect(handles[0]?.dataset["draggable"]).toBe("true")
    expect(handles[0]?.getAttribute("draggable")).toBe("true")
  })

  it("leaves a pinned column undraggable, as pinning already decides its place", () => {
    createTable(host, { data: people, columns: [{ key: "name", pin: "start" }, "plan"] })
    expect(host.querySelector<HTMLElement>(".tpz-th-icon")?.dataset["draggable"]).toBeUndefined()
  })
})
