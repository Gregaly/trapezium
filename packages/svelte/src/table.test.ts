/**
 * @vitest-environment jsdom
 *
 * The Svelte adapter's job is reactivity and lifecycle — the markup is the DOM
 * renderer's, and is tested there. These cover the seam, through the action,
 * which is what the component is.
 */
import { afterEach, describe, expect, it, vi } from "vitest"

import { trapezium } from "./action.js"

type Person = { id: string; name: string; plan: string }

const people: Person[] = [
  { id: "1", name: "Ada", plan: "pro" },
  { id: "2", name: "Tom", plan: "free" },
]

let host: HTMLElement | undefined
let action: ReturnType<typeof trapezium<Person>> | undefined

afterEach(() => {
  action?.destroy()
  host?.remove()
  action = undefined
  host = undefined
  document.querySelectorAll(".tpz-portal").forEach((node) => node.remove())
})

function mount(options: Parameters<typeof trapezium<Person>>[1]) {
  host = document.createElement("div")
  document.body.append(host)
  action = trapezium(host, options)
  return host
}

function rows(): string[][] {
  return [...(host?.querySelectorAll("tbody tr") ?? [])].map((row) =>
    [...row.querySelectorAll("td")].map((cell) => cell.textContent?.trim() ?? ""),
  )
}

describe("the action", () => {
  it("renders a table into the node", () => {
    const node = mount({ data: people })
    expect(node.querySelector("table")).toBeTruthy()
    expect(rows()).toHaveLength(2)
  })

  it("follows new data", () => {
    mount({ data: people, columns: ["name"] })
    action?.update({ data: [...people, { id: "3", name: "Zoe", plan: "pro" }], columns: ["name"] })
    expect(rows()).toHaveLength(3)
  })

  it("keeps the arrangement when only the data changed", () => {
    const columns = ["name"]
    mount({ data: people, columns })

    host?.querySelector<HTMLButtonElement>(".tpz-th-button")?.click()
    host?.querySelector<HTMLButtonElement>(".tpz-th-button")?.click()
    expect(rows().map((row) => row[0])).toEqual(["Tom", "Ada"])

    action?.update({ data: [...people, { id: "3", name: "Zoe", plan: "pro" }], columns })
    expect(rows().map((row) => row[0])).toEqual(["Zoe", "Tom", "Ada"])
  })

  it("reports state and selection", () => {
    const onStateChange = vi.fn()
    const onSelectionChange = vi.fn()
    mount({ data: people, columns: ["name"], selection: "multiple", onStateChange, onSelectionChange })

    host?.querySelector<HTMLButtonElement>(".tpz-th-button")?.click()
    expect(onStateChange).toHaveBeenCalled()

    host?.querySelectorAll<HTMLInputElement>("tbody .tpz-select-cell input")[0]?.click()
    expect(onSelectionChange).toHaveBeenCalledWith(["1"], [people[0]])
  })

  it("cleans up after itself", () => {
    const node = mount({ data: people })
    action?.destroy()
    action = undefined
    expect(node.querySelector(".tpz")).toBeNull()
  })
})

describe("server-side data", () => {
  it("passes a server source through to the table", async () => {
    const distinct = vi.fn(() => Promise.resolve(["pro", "free", "enterprise"]))

    const node = mount({
      data: [people[0]!],
      total: 480,
      server: { distinct },
      columns: ["name", { key: "plan", filter: "set" }],
      pagination: { pageSize: 1 },
    })

    // The page holds one row and one plan; the filter must offer all three.
    node.querySelectorAll<HTMLButtonElement>(".tpz-th-menu")[1]!.click()
    const panel = document.querySelector<HTMLElement>(".tpz-portal")!
    expect(distinct).toHaveBeenCalledWith("plan", expect.objectContaining({ page: 1 }))

    await vi.waitFor(() => {
      const labels = [...panel.querySelectorAll(".tpz-filter-option-label")].map((node) => node.textContent)
      expect(labels).toEqual(["pro", "free", "enterprise"])
    })
  })
})

describe("options that change while the table is running", () => {
  it("follows page size, density and state", () => {
    const many = Array.from({ length: 30 }, (_, index) => ({
      id: String(index),
      name: `P${String(index)}`,
      plan: "pro",
    }))

    const node = mount({ data: many, columns: ["name"], pagination: { pageSize: 5 } })
    expect(node.querySelectorAll("tbody tr")).toHaveLength(5)

    action?.update({ data: many, columns: ["name"], pagination: { pageSize: 10 } })
    expect(node.querySelectorAll("tbody tr")).toHaveLength(10)

    action?.update({ data: many, columns: ["name"], pagination: { pageSize: 10 }, density: "compact" })
    expect(node.querySelector(".tpz")?.getAttribute("data-density")).toBe("compact")

    action?.update({
      data: many,
      columns: ["name"],
      pagination: { pageSize: 10 },
      state: { sort: [{ key: "name", direction: "desc" }] },
    })
    // Natural order, so P29 sorts above P9 rather than below it.
    expect(rows()[0]?.[0]).toBe("P29")
  })

  it("offers the row-height switch when asked", () => {
    const node = mount({ data: people, densityControl: true })

    node.querySelector<HTMLButtonElement>('[aria-label="Row height"]')!.click()
    const items = [...document.querySelectorAll<HTMLElement>(".tpz-portal [data-menu-item]")]
    expect(items.map((item) => item.textContent?.trim())).toEqual(["Compact", "Normal", "Relaxed"])
  })
})
