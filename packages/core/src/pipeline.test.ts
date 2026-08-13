import { describe, expect, it, vi } from "vitest"

import { resolveColumns } from "./columns.js"
import { DEFAULT_FORMAT } from "./format.js"
import { getRows, resolveRowId, searchRows, sortRows } from "./pipeline.js"
import { defaultTypeRegistry } from "./registry.js"
import { createState } from "./state.js"
import type { ColumnDef, TableState } from "./types.js"

type Person = {
  id: string
  name: string
  age: number
  joined: string
  plan: string
  active: boolean
}

const people: Person[] = [
  { id: "1", name: "Ada", age: 36, joined: "2026-01-15", plan: "pro", active: true },
  { id: "2", name: "Tom", age: 28, joined: "2026-03-02", plan: "free", active: false },
  { id: "3", name: "Zoë", age: 44, joined: "2025-11-20", plan: "pro", active: true },
  { id: "4", name: "bea", age: 31, joined: "2026-03-02", plan: "team", active: true },
]

function setup(state: Partial<TableState> = {}, columns?: ColumnDef<Person>[]) {
  const resolved = createState(state)
  const { visible } = resolveColumns<Person, unknown>({
    columns,
    rows: people,
    state: resolved,
    types: defaultTypeRegistry,
  })
  return { state: resolved, columns: visible }
}

describe("sortRows", () => {
  it("sorts text case- and accent-insensitively", () => {
    const { state, columns } = setup({ sort: [{ key: "name", direction: "asc" }] })
    expect(sortRows(people, columns, state, defaultTypeRegistry, DEFAULT_FORMAT).map((p) => p.name)).toEqual([
      "Ada",
      "bea",
      "Tom",
      "Zoë",
    ])
  })

  it("sorts numbers numerically, not as strings", () => {
    const { state, columns } = setup({ sort: [{ key: "age", direction: "desc" }] })
    expect(sortRows(people, columns, state, defaultTypeRegistry, DEFAULT_FORMAT).map((p) => p.age)).toEqual([
      44, 36, 31, 28,
    ])
  })

  it("applies a second level only where the first ties", () => {
    const { state, columns } = setup({
      sort: [
        { key: "joined", direction: "asc" },
        { key: "name", direction: "desc" },
      ],
    })
    expect(sortRows(people, columns, state, defaultTypeRegistry, DEFAULT_FORMAT).map((p) => p.name)).toEqual([
      "Zoë",
      "Ada",
      "Tom",
      "bea",
    ])
  })

  it("never mutates the rows it was given", () => {
    const { state, columns } = setup({ sort: [{ key: "age", direction: "asc" }] })
    const original = [...people]
    sortRows(people, columns, state, defaultTypeRegistry, DEFAULT_FORMAT)
    expect(people).toEqual(original)
  })

  it("puts empty values last in both directions", () => {
    const rows = [{ name: "b" }, { name: null }, { name: "a" }]
    const state = createState({ sort: [{ key: "name", direction: "asc" }] })
    const { visible } = resolveColumns<{ name: string | null }, unknown>({
      rows,
      state,
      types: defaultTypeRegistry,
    })

    expect(sortRows(rows, visible, state, defaultTypeRegistry, DEFAULT_FORMAT).map((r) => r.name)).toEqual([
      "a",
      "b",
      null,
    ])

    const descending = createState({ sort: [{ key: "name", direction: "desc" }] })
    expect(
      sortRows(rows, visible, descending, defaultTypeRegistry, DEFAULT_FORMAT).map((r) => r.name),
    ).toEqual(["b", "a", null])
  })
})

describe("searchRows", () => {
  it("matches across every searchable column", () => {
    const { columns } = setup()
    expect(searchRows(people, columns, "pro", defaultTypeRegistry, DEFAULT_FORMAT)).toHaveLength(2)
  })

  it("ignores case and accents", () => {
    const { columns } = setup()
    expect(searchRows(people, columns, "zoe", defaultTypeRegistry, DEFAULT_FORMAT)).toHaveLength(1)
  })

  it("matches the formatted text, not just the stored value", () => {
    // "Jan" appears nowhere in "2026-01-15"; it is only in what the user sees.
    const { columns } = setup(undefined, [{ key: "joined", type: "date" }])
    expect(searchRows(people, columns, "Jan", defaultTypeRegistry, DEFAULT_FORMAT)).toHaveLength(1)
  })

  it("returns everything for an empty query", () => {
    const { columns } = setup()
    expect(searchRows(people, columns, "   ", defaultTypeRegistry, DEFAULT_FORMAT)).toHaveLength(4)
  })
})

describe("getRows", () => {
  it("filters, then searches, then sorts, then pages", () => {
    const { state, columns } = setup({
      filters: [{ key: "active", operator: "eq", value: "true" }],
      sort: [{ key: "age", direction: "asc" }],
      pageSize: 2,
      page: 1,
    })

    const result = getRows({ rows: people, columns, state, types: defaultTypeRegistry, format: DEFAULT_FORMAT })

    expect(result.total).toBe(3)
    expect(result.pageCount).toBe(2)
    expect(result.rows.map((p) => p.name)).toEqual(["bea", "Ada"])
  })

  it("clamps a page past the end rather than showing nothing", () => {
    const { state, columns } = setup({ pageSize: 2, page: 99 })
    const result = getRows({ rows: people, columns, state, types: defaultTypeRegistry, format: DEFAULT_FORMAT })
    expect(result.rows).toHaveLength(2)
  })

  it("keeps every loaded page on screen when accumulating", () => {
    const { state, columns } = setup({ pageSize: 2, page: 2 })
    const result = getRows({
      rows: people,
      columns,
      state,
      types: defaultTypeRegistry,
      format: DEFAULT_FORMAT,
      accumulate: true,
    })
    expect(result.rows).toHaveLength(4)
  })

  it("applies nothing in server mode and trusts the given total", () => {
    const { state, columns } = setup({ sort: [{ key: "age", direction: "asc" }], pageSize: 2 })
    const result = getRows({
      rows: people,
      columns,
      state,
      types: defaultTypeRegistry,
      format: DEFAULT_FORMAT,
      server: true,
      total: 400,
    })

    expect(result.rows.map((p) => p.name)).toEqual(["Ada", "Tom", "Zoë", "bea"])
    expect(result.total).toBe(400)
    expect(result.pageCount).toBe(200)
  })
})

describe("resolveRowId", () => {
  it("prefers an id on the row", () => {
    expect(resolveRowId({ id: "abc" }, 3)).toBe("abc")
    expect(resolveRowId({ uuid: "u-1" }, 3)).toBe("u-1")
  })

  it("falls back to the index", () => {
    expect(resolveRowId({ name: "x" }, 3)).toBe("3")
  })

  it("uses the caller's function when given", () => {
    expect(resolveRowId({ ref: 9 }, 0, (row) => `r${String(row["ref"])}`)).toBe("r9")
  })
})

describe("server mode with append pagination", () => {
  it("warns when the caller did not accumulate, because the symptom is baffling", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { state, columns } = setup({ page: 3, pageSize: 2 })

    getRows({
      rows: people.slice(0, 2),
      columns,
      state,
      types: defaultTypeRegistry,
      format: DEFAULT_FORMAT,
      server: true,
      total: 400,
      accumulate: true,
    })

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("every page loaded so far"))
    warn.mockRestore()
  })
})

describe("searching structured values", () => {
  type Structured = {
    name: string
    home: { line1: string; city: string } | null
    file: { name: string } | null
    payload: Record<string, unknown> | null
  }

  const structured: Structured[] = [
    { name: "Ada", home: { line1: "1 Test St", city: "Sydney" }, file: { name: "report.pdf" }, payload: { secret: 1 } },
    { name: "Tom", home: null, file: null, payload: null },
  ]

  const state = createState()
  const columns = resolveColumns<Structured, unknown>({
    columns: [
      { key: "name" },
      { key: "home", type: "address" },
      { key: "file", type: "file" },
      { key: "payload", type: "json" },
    ],
    rows: structured,
    state,
    types: defaultTypeRegistry,
  }).visible

  const find = (query: string) =>
    searchRows(structured, columns, query, defaultTypeRegistry, DEFAULT_FORMAT).map((row) => row.name)

  it("looks inside what the cell shows", () => {
    expect(find("Sydney")).toEqual(["Ada"])
    expect(find("Test St")).toEqual(["Ada"])
    expect(find("report.pdf")).toEqual(["Ada"])
  })

  it("never matches the shape of the value itself", () => {
    // `String({…})` is "[object Object]", so without care a search for "object"
    // matches every row with an address, a file or a blob of JSON in it.
    expect(find("object")).toEqual([])
    expect(find("[object")).toEqual([])
  })

  it("does not leak the contents of a column that renders nothing", () => {
    // A JSON column shows "{…}" and is not searchable; the values inside it are
    // not something the reader can see.
    expect(find("secret")).toEqual([])
  })
})

describe("set filters in server mode", () => {
  type Row = { id: string; plan: string }
  const page: Row[] = [
    { id: "1", plan: "pro" },
    { id: "2", plan: "free" },
  ]

  function run(columns: ColumnDef<Row>[]) {
    const state = createState({ page: 1, pageSize: 2 })
    const resolved = resolveColumns<Row, unknown>({ columns, rows: page, state, types: defaultTypeRegistry }).visible

    return getRows<Row, unknown>({
      rows: page,
      columns: resolved,
      state,
      types: defaultTypeRegistry,
      format: DEFAULT_FORMAT,
      server: true,
      total: 500,
    })
  }

  it("warns when a set filter has no choices of its own, because it can only see one page", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    run([{ key: "plan", filter: "set" }])

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("only the values on the page"))
    warn.mockRestore()
  })

  it("says nothing when the caller supplied the full list", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    run([
      {
        key: "plan",
        filter: { kind: "set", options: [{ value: "pro" }, { value: "free" }, { value: "team" }] },
        formatOptions: { options: [{ value: "pro" }, { value: "free" }, { value: "team" }] },
      },
    ])

    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
