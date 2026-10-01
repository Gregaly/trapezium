import { describe, expect, it } from "vitest"

import { createTableStore } from "./store.js"
import {
  addSort,
  clearFilters,
  columnSearchText,
  createState,
  removeFilter,
  removeSort,
  resetSort,
  setColumnSearch,
  setFilter,
  setPage,
  setPageSize,
  setSearch,
  selectRange,
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

describe("sorting by several columns", () => {
  const two = createState({
    sort: [
      { key: "team", direction: "asc" },
      { key: "name", direction: "asc" },
    ],
  })

  it("adds each new column after the ones already there", () => {
    expect(toggleSort(two, "age", true).sort).toEqual([
      { key: "team", direction: "asc" },
      { key: "name", direction: "asc" },
      { key: "age", direction: "asc" },
    ])
  })

  it("turns a level over where it is, rather than sending it to the back", () => {
    // Reversing the primary sort must not demote it: the user asked for the
    // same order upside down, not for a different order.
    expect(toggleSort(two, "team", true).sort).toEqual([
      { key: "team", direction: "desc" },
      { key: "name", direction: "asc" },
    ])
  })

  it("drops a level on its third click and keeps the rest in order", () => {
    const reversed = toggleSort(two, "team", true)
    expect(toggleSort(reversed, "team", true).sort).toEqual([{ key: "name", direction: "asc" }])
  })

  it("starts again from one column on a plain click, wherever it was in the order", () => {
    // Not additive: this column alone, at the next step of its own cycle.
    expect(toggleSort(two, "name").sort).toEqual([{ key: "name", direction: "desc" }])
    expect(toggleSort(two, "age").sort).toEqual([{ key: "age", direction: "asc" }])
  })

  it("never lists a column twice", () => {
    let state = createState()
    for (const key of ["a", "b", "a", "c", "b", "a"]) state = toggleSort(state, key, true)
    const keys = state.sort.map((level) => level.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("adds a level in a named direction, or redirects one in place", () => {
    expect(addSort(two, "age", "desc").sort).toEqual([
      { key: "team", direction: "asc" },
      { key: "name", direction: "asc" },
      { key: "age", direction: "desc" },
    ])
    expect(addSort(two, "team", "desc").sort).toEqual([
      { key: "team", direction: "desc" },
      { key: "name", direction: "asc" },
    ])
  })

  it("removes one level and leaves the others", () => {
    expect(removeSort(two, "team").sort).toEqual([{ key: "name", direction: "asc" }])
    expect(removeSort(two, "nothing").sort).toEqual(two.sort)
  })

  it("resets to no sort, or to the one the table rests in", () => {
    expect(resetSort(two).sort).toEqual([])

    const resting = [{ key: "joined", direction: "desc" }] as const
    const reset = resetSort(two, resting)
    expect(reset.sort).toEqual(resting)
    // A copy, so nothing that later edits the state can reach the caller's array.
    expect(reset.sort).not.toBe(resting)
    expect(reset.sort[0]).not.toBe(resting[0])
  })

  it("goes back to page one whenever the order changes", () => {
    const deep = { ...two, page: 7 }
    expect(toggleSort(deep, "age", true).page).toBe(1)
    expect(addSort(deep, "age", "asc").page).toBe(1)
    expect(removeSort(deep, "team").page).toBe(1)
    expect(resetSort(deep).page).toBe(1)
  })
})

describe("searching a column from its header", () => {
  it("is a contains filter on that column", () => {
    const state = setColumnSearch(createState({ page: 4 }), "name", "ada")
    expect(state.filters).toEqual([{ key: "name", operator: "contains", value: "ada" }])
    expect(state.page).toBe(1)
    expect(columnSearchText(state, "name")).toBe("ada")
  })

  it("trims what was typed, and keeps the spaces inside it", () => {
    const state = setColumnSearch(createState(), "name", "  ada  lovelace ")
    expect(columnSearchText(state, "name")).toBe("ada  lovelace")
  })

  it("replaces the column's other filter, because a column shows one", () => {
    const chosen = setFilter(createState(), { key: "plan", operator: "in", value: ["pro", "team"] })
    expect(setColumnSearch(chosen, "plan", "pro").filters).toEqual([
      { key: "plan", operator: "contains", value: "pro" },
    ])
  })

  it("leaves every other column's filter alone", () => {
    const filtered = setFilter(createState(), { key: "plan", operator: "eq", value: "pro" })
    expect(setColumnSearch(filtered, "name", "ada").filters).toEqual([
      { key: "plan", operator: "eq", value: "pro" },
      { key: "name", operator: "contains", value: "ada" },
    ])
  })

  it("removes the search when the box is emptied", () => {
    const searched = setColumnSearch(createState(), "name", "ada")
    expect(setColumnSearch(searched, "name", "").filters).toEqual([])
    expect(setColumnSearch(searched, "name", "   ").filters).toEqual([])
  })

  it("does not remove a filter it did not make", () => {
    // An empty box closed over a column filtered some other way must leave
    // that filter exactly where it was.
    const ranged = setFilter(createState(), { key: "age", operator: "gt", value: "30" })
    expect(setColumnSearch(ranged, "age", "")).toBe(ranged)
    expect(columnSearchText(ranged, "age")).toBe("")
  })

  it("returns the same state when nothing would change, so nothing is told to", () => {
    const searched = setColumnSearch(createState(), "name", "ada")
    expect(setColumnSearch(searched, "name", "ada")).toBe(searched)
    expect(setColumnSearch(searched, "name", " ada ")).toBe(searched)

    const untouched = createState()
    expect(setColumnSearch(untouched, "name", "")).toBe(untouched)
  })

  it("reads nothing back from a column that is not being searched", () => {
    expect(columnSearchText(createState(), "name")).toBe("")
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

  describe("a range", () => {
    const ids = ["a", "b", "c", "d", "e"]

    it("runs from the anchor to the target, inclusive, in either direction", () => {
      expect(selectRange(createState(), ids, "b", "d", true).selection).toEqual(["b", "c", "d"])
      expect(selectRange(createState(), ids, "d", "b", true).selection).toEqual(["b", "c", "d"])
    })

    it("clears the same stretch when asked to", () => {
      const all = createState({ selection: ids })
      expect(selectRange(all, ids, "b", "d", false).selection).toEqual(["a", "e"])
    })

    it("walks only the ids it is given, so a row left out is stepped over", () => {
      const selectable = ["a", "c", "e"]
      expect(selectRange(createState(), selectable, "a", "e", true).selection).toEqual(["a", "c", "e"])
    })

    it("falls back to the target alone when the anchor is not on the list", () => {
      expect(selectRange(createState(), ids, "gone", "c", true).selection).toEqual(["c"])
      expect(selectRange(createState(), ids, undefined, "c", true).selection).toEqual(["c"])
    })

    it("does nothing for a target it does not know", () => {
      const state = createState({ selection: ["a"] })
      expect(selectRange(state, ids, "a", "zz", true)).toBe(state)
    })
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
