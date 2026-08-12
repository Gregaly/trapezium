import { describe, expect, it } from "vitest"

import { resolveColumns } from "./columns.js"
import { DEFAULT_FORMAT } from "./format.js"
import { filterRows, matchesFilter } from "./filter.js"
import { BUILT_IN_TYPES, defaultTypeRegistry } from "./registry.js"
import { createState } from "./state.js"
import type { ColumnFilter } from "./types.js"

const format = DEFAULT_FORMAT
const type = (name: string) => BUILT_IN_TYPES[name]!

function check(value: unknown, filter: ColumnFilter, typeName = "text"): boolean {
  return matchesFilter(value, filter, type(typeName), format)
}

describe("text operators", () => {
  it("contains ignores case and accents", () => {
    expect(check("José García", { key: "n", operator: "contains", value: "jose" })).toBe(true)
    expect(check("Ada", { key: "n", operator: "notContains", value: "z" })).toBe(true)
  })

  it("startsWith and endsWith", () => {
    expect(check("Adelaide", { key: "n", operator: "startsWith", value: "ade" })).toBe(true)
    expect(check("Adelaide", { key: "n", operator: "endsWith", value: "AIDE" })).toBe(true)
  })

  it("eq is exact but case-insensitive", () => {
    expect(check("Ada", { key: "n", operator: "eq", value: "ada" })).toBe(true)
    expect(check("Adam", { key: "n", operator: "eq", value: "ada" })).toBe(false)
  })
})

describe("presence", () => {
  it("treats null, empty string and empty array as empty, but never zero or false", () => {
    expect(check(null, { key: "n", operator: "empty" })).toBe(true)
    expect(check("", { key: "n", operator: "empty" })).toBe(true)
    expect(check([], { key: "n", operator: "empty" })).toBe(true)
    expect(check(0, { key: "n", operator: "empty" }, "number")).toBe(false)
    expect(check(false, { key: "n", operator: "empty" }, "boolean")).toBe(false)
  })

  it("an empty value satisfies no comparison", () => {
    expect(check(null, { key: "n", operator: "lt", value: "10" }, "number")).toBe(false)
  })
})

describe("numbers", () => {
  it("compares numerically, even when the filter value is text from a URL", () => {
    expect(check(100, { key: "n", operator: "gt", value: "20" }, "number")).toBe(true)
    // The string comparison this guards against: "100" < "20".
    expect(check(100, { key: "n", operator: "lt", value: "20" }, "number")).toBe(false)
  })

  it("between is inclusive", () => {
    expect(check(20, { key: "n", operator: "between", value: ["20", "30"] }, "number")).toBe(true)
    expect(check(31, { key: "n", operator: "between", value: ["20", "30"] }, "number")).toBe(false)
  })
})

describe("dates", () => {
  const stamp = "2026-08-13T22:30:00Z"

  it("a day means the whole day, not midnight", () => {
    expect(check(stamp, { key: "d", operator: "eq", value: "2026-08-13" }, "datetime")).toBe(true)
  })

  it("after a day means after all of it", () => {
    expect(check(stamp, { key: "d", operator: "gt", value: "2026-08-13" }, "datetime")).toBe(false)
    expect(check(stamp, { key: "d", operator: "gte", value: "2026-08-13" }, "datetime")).toBe(true)
    expect(check(stamp, { key: "d", operator: "lte", value: "2026-08-13" }, "datetime")).toBe(true)
    expect(check(stamp, { key: "d", operator: "lt", value: "2026-08-13" }, "datetime")).toBe(false)
  })

  it("compares two instants precisely", () => {
    expect(check(stamp, { key: "d", operator: "gt", value: "2026-08-13T10:00:00Z" }, "datetime")).toBe(true)
  })
})

describe("lists and tags", () => {
  it("in matches any member", () => {
    expect(check("pro", { key: "p", operator: "in", value: ["free", "pro"] }, "select")).toBe(true)
    expect(check("team", { key: "p", operator: "notIn", value: ["free", "pro"] }, "select")).toBe(true)
  })

  it("a tags column matches when any of its values does", () => {
    expect(check(["a", "b"], { key: "t", operator: "in", value: ["b"] }, "tags")).toBe(true)
    expect(check(["a", "b"], { key: "t", operator: "contains", value: "B" }, "tags")).toBe(true)
    expect(check(["a"], { key: "t", operator: "in", value: ["z"] }, "tags")).toBe(false)
  })
})

describe("select columns", () => {
  const options = [{ value: "pro", label: "Professional" }]
  const context = { ...format, options }

  it("matches the stored value and the label a user can see", () => {
    expect(matchesFilter("pro", { key: "p", operator: "eq", value: "pro" }, type("select"), context)).toBe(true)
    expect(
      matchesFilter("pro", { key: "p", operator: "eq", value: "Professional" }, type("select"), context),
    ).toBe(true)
  })
})

describe("filterRows", () => {
  type Row = { name: string; age: number; plan: string }
  const rows: Row[] = [
    { name: "Ada", age: 36, plan: "pro" },
    { name: "Tom", age: 28, plan: "free" },
    { name: "Zoe", age: 44, plan: "pro" },
  ]

  const columns = resolveColumns<Row, unknown>({
    rows,
    state: createState(),
    types: defaultTypeRegistry,
  }).visible

  const run = (filters: ColumnFilter[], match: "all" | "any" = "all") =>
    filterRows(rows, columns, filters, match, defaultTypeRegistry.get, format).map((row) => row.name)

  it("requires every filter by default", () => {
    expect(run([
      { key: "plan", operator: "eq", value: "pro" },
      { key: "age", operator: "gt", value: "40" },
    ])).toEqual(["Zoe"])
  })

  it("accepts any of them when asked", () => {
    expect(run(
      [
        { key: "plan", operator: "eq", value: "free" },
        { key: "age", operator: "gt", value: "40" },
      ],
      "any",
    )).toEqual(["Tom", "Zoe"])
  })

  it("ignores a filter on a column that no longer exists", () => {
    // A saved view outliving a renamed column should show more than nothing.
    expect(run([{ key: "gone", operator: "eq", value: "x" }])).toHaveLength(3)
  })

  it("ignores an incomplete filter rather than matching nothing", () => {
    expect(run([{ key: "plan", operator: "eq", value: "" }])).toHaveLength(3)
  })
})
