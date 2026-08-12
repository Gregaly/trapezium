import { describe, expect, it } from "vitest"

import { moveColumn, pruneState, reorderColumn, resolveColumns } from "./columns.js"
import { createTypeRegistry, defaultTypeRegistry, defineType } from "./registry.js"
import { createState } from "./state.js"
import type { ColumnDef } from "./types.js"

type Row = { id: string; full_name: string; total_cents: number; created_at: string; notes: string }

const rows: Row[] = [
  { id: "1", full_name: "Ada", total_cents: 1250, created_at: "2026-08-13T10:00:00Z", notes: "" },
  { id: "2", full_name: "Tom", total_cents: 990, created_at: "2026-08-12T10:00:00Z", notes: "hi" },
]

function resolve(columns?: (ColumnDef<Row> | string)[], state = createState()) {
  return resolveColumns<Row, unknown>({ columns, rows, state, types: defaultTypeRegistry })
}

describe("defaults", () => {
  it("builds a column per key when none are given", () => {
    expect(resolve().visible.map((column) => column.key)).toEqual([
      "id",
      "full_name",
      "total_cents",
      "created_at",
      "notes",
    ])
  })

  it("accepts bare keys as a shorthand, and orders by them", () => {
    expect(resolve(["notes", "id"]).visible.map((column) => column.key)).toEqual(["notes", "id"])
  })

  it("humanises the header", () => {
    const [id, name] = resolve(["id", "full_name"]).visible
    expect(id?.header).toBe("ID")
    expect(name?.header).toBe("Full name")
  })

  it("infers the type, and takes the alignment and icon from it", () => {
    const [total] = resolve(["total_cents"]).visible
    expect(total?.type).toBe("currency")
    expect(total?.align).toBe("end")
    expect(total?.icon).toBe("currency")
  })

  it("reads a dotted path", () => {
    const nested = [{ org: { name: "Acme" } }]
    const { visible } = resolveColumns<{ org: { name: string } }, unknown>({
      columns: [{ key: "org.name" }],
      rows: nested,
      state: createState(),
      types: defaultTypeRegistry,
    })
    expect(visible[0]?.accessor(nested[0]!)).toBe("Acme")
    expect(visible[0]?.header).toBe("Name")
  })

  it("lets an explicit type win over inference", () => {
    expect(resolve([{ key: "total_cents", type: "number" }]).visible[0]?.type).toBe("number")
  })

  it("resolves an aliased type name", () => {
    expect(resolve([{ key: "notes", type: "long_text" }]).visible[0]?.type).toBe("longText")
  })

  it("uses a custom type as if it were built in", () => {
    const types = createTypeRegistry({
      rating: defineType({ name: "rating", align: "end", format: (value) => `${String(value)}/5` }),
    })
    const { visible } = resolveColumns<Row, unknown>({
      columns: [{ key: "total_cents", type: "rating" }],
      rows,
      state: createState(),
      types,
    })
    expect(visible[0]?.align).toBe("end")
  })
})

describe("arrangement", () => {
  it("puts ordered columns first and keeps the rest after them", () => {
    // A column added to the data after somebody arranged their view must still
    // appear, rather than vanishing because it was not in the saved list.
    const state = createState({ order: ["notes", "id"] })
    expect(resolve(undefined, state).visible.map((column) => column.key)).toEqual([
      "notes",
      "id",
      "full_name",
      "total_cents",
      "created_at",
    ])
  })

  it("hides what the state hides, and offers it back", () => {
    const state = createState({ hidden: ["notes"] })
    const { visible, hidden } = resolve(undefined, state)
    expect(visible.some((column) => column.key === "notes")).toBe(false)
    expect(hidden.map((column) => column.key)).toEqual(["notes"])
  })

  it("floats pinned columns to the edges", () => {
    const state = createState({ pinned: { created_at: "start", id: "end" } })
    const keys = resolve(undefined, state).visible.map((column) => column.key)
    expect(keys[0]).toBe("created_at")
    expect(keys[keys.length - 1]).toBe("id")
  })

  it("numbers the visible columns in the order they render", () => {
    expect(resolve(["notes", "id"]).visible.map((column) => column.index)).toEqual([0, 1])
  })
})

describe("moveColumn and reorderColumn", () => {
  const keys = ["a", "b", "c"]

  it("moves one place at a time", () => {
    expect(moveColumn(keys, "c", "left")).toEqual(["a", "c", "b"])
    expect(moveColumn(keys, "a", "right")).toEqual(["b", "a", "c"])
  })

  it("refuses to move past either end", () => {
    expect(moveColumn(keys, "a", "left")).toEqual(keys)
    expect(moveColumn(keys, "c", "right")).toEqual(keys)
  })

  it("drops a column at an explicit index", () => {
    expect(reorderColumn(keys, "a", 2)).toEqual(["b", "c", "a"])
    expect(reorderColumn(keys, "c", 0)).toEqual(["c", "a", "b"])
  })

  it("ignores a key it does not know", () => {
    expect(reorderColumn(keys, "z", 0)).toEqual(keys)
  })
})

describe("pruneState", () => {
  it("forgets everything about columns that no longer exist", () => {
    const state = createState({
      order: ["a", "gone"],
      hidden: ["gone"],
      filters: [{ key: "gone", operator: "eq", value: "x" }],
      sort: [{ key: "gone", direction: "asc" }],
      widths: { gone: 100, a: 80 },
      pinned: { gone: "start" },
    })

    const pruned = pruneState(state, ["a"])

    expect(pruned.order).toEqual(["a"])
    expect(pruned.hidden).toEqual([])
    expect(pruned.filters).toEqual([])
    expect(pruned.sort).toEqual([])
    expect(pruned.widths).toEqual({ a: 80 })
    expect(pruned.pinned).toEqual({})
  })
})
