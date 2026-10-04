import { describe, expect, it } from "vitest"

import { resolveColumns } from "./columns.js"
import { defaultTypeRegistry } from "./registry.js"
import { canResetSort, resolveSorting, sortLevels, sortPriority, sortsEqual } from "./sorting.js"
import { createState } from "./state.js"
import type { Sort } from "./types.js"

const byTeam: Sort = { key: "team", direction: "asc" }
const byName: Sort = { key: "name", direction: "asc" }

describe("resolveSorting", () => {
  it("is on, with several levels and a reset, when nothing is said", () => {
    expect(resolveSorting(undefined)).toEqual({ multiple: true, reset: [] })
    expect(resolveSorting(true)).toEqual({ multiple: true, reset: [] })
    expect(resolveSorting({})).toEqual({ multiple: true, reset: [] })
  })

  it("is off altogether for false", () => {
    expect(resolveSorting(false)).toBeUndefined()
  })

  it("keeps to one column when told the backend can only order by one", () => {
    expect(resolveSorting({ multiple: false })?.multiple).toBe(false)
  })

  it("has no reset control when told to leave it out", () => {
    expect(resolveSorting({ reset: false })?.reset).toBeUndefined()
  })

  it("takes an array as the sort the table rests in", () => {
    expect(resolveSorting({ reset: [byTeam] })?.reset).toEqual([byTeam])
  })

  it("hands back the same empty sort every time, so a memo has nothing to notice", () => {
    expect(resolveSorting(true)?.reset).toBe(resolveSorting({})?.reset)
  })
})

describe("sortsEqual", () => {
  it("compares the levels and their order", () => {
    expect(sortsEqual([], [])).toBe(true)
    expect(sortsEqual([byTeam, byName], [byTeam, byName])).toBe(true)
    expect(sortsEqual([byTeam, byName], [byName, byTeam])).toBe(false)
    expect(sortsEqual([byTeam], [{ key: "team", direction: "desc" }])).toBe(false)
    expect(sortsEqual([byTeam], [byTeam, byName])).toBe(false)
  })
})

describe("canResetSort", () => {
  it("is false while the table is unsorted, and true once it is not", () => {
    const sorting = resolveSorting(true)
    expect(canResetSort([], sorting)).toBe(false)
    expect(canResetSort([byTeam], sorting)).toBe(true)
  })

  it("measures against the resting sort when there is one", () => {
    const sorting = resolveSorting({ reset: [byTeam] })
    expect(canResetSort([byTeam], sorting)).toBe(false)
    // No sort at all is a departure from a table that rests sorted.
    expect(canResetSort([], sorting)).toBe(true)
    expect(canResetSort([byTeam, byName], sorting)).toBe(true)
  })

  it("is never true when the control is switched off, or sorting is", () => {
    expect(canResetSort([byTeam], resolveSorting({ reset: false }))).toBe(false)
    expect(canResetSort([byTeam], resolveSorting(false))).toBe(false)
  })
})

describe("sortLevels", () => {
  const rows = [{ team: "Eng", name: "Ada", photo: "a.png" }]
  const visible = (hidden: string[] = []) =>
    resolveColumns({
      columns: ["team", "name", { key: "photo", type: "image" }],
      rows,
      state: createState({ hidden }),
      types: defaultTypeRegistry,
    }).visible

  it("keeps the levels the rows are really ordered by, in order", () => {
    expect(sortLevels([byTeam, byName], visible())).toEqual([byTeam, byName])
  })

  it("leaves out a level on a column that is hidden", () => {
    expect(sortLevels([byTeam, byName], visible(["team"]))).toEqual([byName])
  })

  it("leaves out a level on a column that cannot be sorted, or does not exist", () => {
    const byPhoto: Sort = { key: "photo", direction: "asc" }
    const byNothing: Sort = { key: "gone", direction: "asc" }
    expect(sortLevels([byPhoto, byNothing, byName], visible())).toEqual([byName])
  })

  it("counts a column named twice once, by its first mention", () => {
    const again: Sort = { key: "team", direction: "desc" }
    expect(sortLevels([byTeam, byName, again], visible())).toEqual([byTeam, byName])
  })

  it("means a lone visible level gets no number", () => {
    expect(sortPriority(sortLevels([byTeam, byName], visible(["team"])), "name")).toBeUndefined()
  })
})

describe("sortPriority", () => {
  it("numbers the levels from one", () => {
    expect(sortPriority([byTeam, byName], "team")).toBe(1)
    expect(sortPriority([byTeam, byName], "name")).toBe(2)
  })

  it("says nothing for a column that is not sorted", () => {
    expect(sortPriority([byTeam, byName], "age")).toBeUndefined()
  })

  it("says nothing when there is only one level, because a lone 1 is noise", () => {
    expect(sortPriority([byTeam], "team")).toBeUndefined()
    expect(sortPriority([], "team")).toBeUndefined()
  })
})
