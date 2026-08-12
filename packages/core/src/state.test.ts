import { describe, expect, it } from "vitest"

import { createTableStore } from "./store.js"
import {
  clearFilters,
  createState,
  removeFilter,
  setFilter,
  setPage,
  setPageSize,
  setSearch,
  setSelected,
  toggleColumn,
  togglePin,
  toggleSelection,
  toggleSort,
} from "./state.js"

describe("toggleSort", () => {
  it("cycles ascending, descending, off", () => {
    let state = createState()
    state = toggleSort(state, "name")
    expect(state.sort).toEqual([{ key: "name", direction: "asc" }])

    state = toggleSort(state, "name")
    expect(state.sort).toEqual([{ key: "name", direction: "desc" }])

    // The way back to the order the data arrived in.
    state = toggleSort(state, "name")
    expect(state.sort).toEqual([])
  })

  it("replaces the sort by default and appends when additive", () => {
    const first = toggleSort(createState(), "name")
    expect(toggleSort(first, "age").sort).toEqual([{ key: "age", direction: "asc" }])
    expect(toggleSort(first, "age", true).sort).toEqual([
      { key: "name", direction: "asc" },
      { key: "age", direction: "asc" },
    ])
  })
})

describe("page invariants", () => {
  it("anything that changes which rows match goes back to page one", () => {
    const deep = createState({ page: 7 })

    expect(setSearch(deep, "ada").page).toBe(1)
    expect(setFilter(deep, { key: "plan", operator: "eq", value: "pro" }).page).toBe(1)
    expect(removeFilter(deep, "plan").page).toBe(1)
    expect(clearFilters(deep).page).toBe(1)
    expect(toggleSort(deep, "name").page).toBe(1)
    expect(setPageSize(deep, 50).page).toBe(1)
  })

  it("hiding a column does not, because the rows are the same", () => {
    expect(toggleColumn(createState({ page: 7 }), "notes").page).toBe(7)
  })

  it("refuses a page below one", () => {
    expect(setPage(createState(), 0).page).toBe(1)
    expect(setPage(createState(), -3).page).toBe(1)
  })
})

describe("selection", () => {
  it("adds and removes", () => {
    let state = toggleSelection(createState(), "a")
    expect(state.selection).toEqual(["a"])
    state = toggleSelection(state, "b")
    expect(state.selection).toEqual(["a", "b"])
    state = toggleSelection(state, "a")
    expect(state.selection).toEqual(["b"])
  })

  it("keeps only one when the table is single-select", () => {
    const state = toggleSelection(toggleSelection(createState(), "a", true), "b", true)
    expect(state.selection).toEqual(["b"])
  })

  it("selects a page without disturbing anything off it", () => {
    const state = setSelected(createState({ selection: ["offscreen"] }), ["a", "b"], true)
    expect(state.selection).toEqual(["offscreen", "a", "b"])
    expect(setSelected(state, ["a", "b"], false).selection).toEqual(["offscreen"])
  })
})

describe("columns", () => {
  it("toggles visibility", () => {
    const hidden = toggleColumn(createState(), "notes")
    expect(hidden.hidden).toEqual(["notes"])
    expect(toggleColumn(hidden, "notes").hidden).toEqual([])
  })

  it("toggles a pin off when it is already set that way", () => {
    const pinned = togglePin(createState(), "name", "start")
    expect(pinned.pinned).toEqual({ name: "start" })
    expect(togglePin(pinned, "name", "start").pinned).toEqual({})
    expect(togglePin(pinned, "name", "end").pinned).toEqual({ name: "end" })
  })
})

describe("createTableStore", () => {
  it("publishes changes to subscribers", () => {
    const store = createTableStore()
    let notified = 0
    store.subscribe(() => {
      notified += 1
    })

    store.apply((state) => toggleSort(state, "name"))
    expect(notified).toBe(1)
    expect(store.get().sort).toHaveLength(1)
  })

  it("says nothing when an update changes nothing", () => {
    // The contract every framework binding relies on: no publish, no re-render.
    const store = createTableStore({ page: 2 })
    let notified = 0
    store.subscribe(() => {
      notified += 1
    })

    store.patch({ page: 2 })
    expect(notified).toBe(0)
  })

  it("goes back to where it started", () => {
    const store = createTableStore({ pageSize: 10 })
    store.patch({ page: 5 })
    store.reset()
    expect(store.get()).toEqual(createState({ pageSize: 10 }))
  })
})
