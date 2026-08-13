import { describe, expect, it } from "vitest"

import { resolveColumns } from "./columns.js"
import { DEFAULT_FORMAT } from "./format.js"
import { filterRows, matchesFilter } from "./filter.js"
import { getRows, resolveRowId, searchRows, sortRows } from "./pipeline.js"
import { BUILT_IN_TYPES, createTypeRegistry, defaultTypeRegistry } from "./registry.js"
import { createState } from "./state.js"
import { stateFromUrl, stateToQueryString } from "./url.js"
import { toCsv } from "./csv.js"
import type { AnyRow, TableState } from "./types.js"

/**
 * Hostile inputs.
 *
 * Everything a table is handed in the real world and never in a demo: no rows
 * at all, a column that is entirely empty, ids that repeat, numbers that are
 * not numbers, dates before the epoch, a page past the end, a filter on a
 * column somebody deleted last week, a URL somebody edited by hand.
 *
 * The bar is not "handles it gracefully" in the abstract. It is that nothing
 * throws, nothing loses a row, and nothing shows a person something untrue.
 */

const types = defaultTypeRegistry
const format = DEFAULT_FORMAT

function table<TRow extends AnyRow>(rows: TRow[], state: Partial<TableState> = {}, columns?: unknown) {
  const resolved = createState(state)
  const visible = resolveColumns<TRow, unknown>({
    columns: columns as never,
    rows,
    state: resolved,
    types,
  }).visible

  return { columns: visible, state: resolved, result: getRows<TRow, unknown>({ rows, columns: visible, state: resolved, types, format }) }
}

describe("nothing to show", () => {
  it("survives an empty dataset", () => {
    const { result } = table([] as AnyRow[])
    expect(result.rows).toEqual([])
    expect(result.total).toBe(0)
    expect(result.pageCount).toBe(1)
    expect(result.filtered).toBe(false)
  })

  it("survives an empty dataset with columns declared", () => {
    const { result, columns } = table([] as AnyRow[], {}, [{ key: "name" }, { key: "amount", type: "currency" }])
    expect(columns).toHaveLength(2)
    expect(result.rows).toEqual([])
  })

  it("survives a single row", () => {
    const { result } = table([{ id: "1", name: "Ada" }])
    expect(result.rows).toHaveLength(1)
    expect(result.pageCount).toBe(1)
  })

  it("infers text for a column that is empty all the way down", () => {
    const { columns } = table([{ whatever: null }, { whatever: null }, { whatever: undefined }])
    expect(columns[0]?.type).toBe("text")
  })

  it("still takes the key's word for it when the column is empty", () => {
    // A column called "notes" with nothing in it yet is still a notes column,
    // and will be prose the moment somebody types something.
    const { columns } = table([{ notes: null }, { notes: null }])
    expect(columns[0]?.type).toBe("longText")
  })
})

describe("rows that are not what they should be", () => {
  it("ignores a null in the middle of the data when working out columns", () => {
    const rows = [{ a: 1 }, null, { b: 2 }] as unknown as AnyRow[]
    const { columns } = table(rows)
    expect(columns.map((column) => column.key)).toEqual(["a", "b"])
  })

  it("renders a row missing the column entirely as empty", () => {
    const rows = [{ a: 1 }, {}] as AnyRow[]
    const { columns } = table(rows)
    expect(columns[0]?.accessor(rows[1]!)).toBeUndefined()
  })

  it("reads a dotted path through a missing link without throwing", () => {
    const rows = [{ org: { name: "Acme" } }, { org: null }, {}] as AnyRow[]
    const { columns } = table(rows, {}, [{ key: "org.name" }])
    expect(rows.map((row) => columns[0]?.accessor(row))).toEqual(["Acme", undefined, undefined])
  })

  it("keeps rows with duplicate ids apart", () => {
    // Identity is the caller's to get right, but a duplicate must not make a
    // row vanish from the table.
    const rows = [{ id: "same", n: 1 }, { id: "same", n: 2 }]
    const { result } = table(rows)
    expect(result.rows).toHaveLength(2)
    expect(resolveRowId(rows[0]!, 0)).toBe(resolveRowId(rows[1]!, 1))
  })
})

describe("numbers that are not numbers", () => {
  const rows = [
    { n: 0 },
    { n: -0 },
    { n: Number.NaN },
    { n: Number.POSITIVE_INFINITY },
    { n: Number.NEGATIVE_INFINITY },
    { n: Number.MAX_SAFE_INTEGER },
    { n: "1,240.50" },
    { n: "not a number" },
    { n: null },
  ] as AnyRow[]

  it("sorts them without throwing, and puts the unreadable ones last", () => {
    const { columns, state } = table(rows, { sort: [{ key: "n", direction: "asc" }] }, [{ key: "n", type: "number" }])
    const sorted = sortRows(rows, columns, state, types, format)

    expect(sorted).toHaveLength(rows.length)

    const values = sorted.map((row) => row["n"])
    const unreadable = (value: unknown) =>
      value === null || (typeof value === "number" && Number.isNaN(value)) || value === "not a number"

    // Infinity is a number and sorts at the extreme.
    expect(values[0]).toBe(Number.NEGATIVE_INFINITY)
    expect(values[values.length - 4]).toBe(Number.POSITIVE_INFINITY)

    // The three that cannot be read as numbers are together at the end,
    // whatever they are individually.
    expect(values.slice(-3).every(unreadable)).toBe(true)
    expect(values.slice(0, -3).some(unreadable)).toBe(false)
  })

  it("treats zero as a value and NaN as a blank", () => {
    const type = BUILT_IN_TYPES["number"]!
    expect(matchesFilter(0, { key: "n", operator: "empty" }, type, format)).toBe(false)
    expect(matchesFilter(Number.NaN, { key: "n", operator: "empty" }, type, format)).toBe(true)
  })

  it("reads a number out of a formatted string", () => {
    const type = BUILT_IN_TYPES["number"]!
    expect(matchesFilter("1,240.50", { key: "n", operator: "gt", value: "1000" }, type, format)).toBe(true)
    expect(matchesFilter("not a number", { key: "n", operator: "gt", value: "0" }, type, format)).toBe(false)
  })
})

describe("dates that are not dates", () => {
  const rows = [
    { d: "2026-08-13" },
    { d: "1969-07-20" },
    { d: "not a date" },
    { d: new Date("nonsense") },
    { d: 0 },
    { d: null },
    { d: "0000-01-01" },
  ] as AnyRow[]

  it("sorts them, including before the epoch, without throwing", () => {
    const { columns, state } = table(rows, { sort: [{ key: "d", direction: "asc" }] }, [{ key: "d", type: "date" }])
    const sorted = sortRows(rows, columns, state, types, format)
    expect(sorted).toHaveLength(rows.length)
    expect(String(sorted[0]?.["d"])).toContain("0000")
  })

  it("shows an unreadable date as it was given rather than as Invalid Date", () => {
    const type = BUILT_IN_TYPES["date"]!
    expect(type.format?.("not a date", format)).toBe("not a date")
    expect(type.format?.(new Date("nonsense"), format)).toContain("Invalid")
  })

  it("treats epoch zero as a real instant, not as empty", () => {
    const type = BUILT_IN_TYPES["datetime"]!
    expect(matchesFilter(0, { key: "d", operator: "empty" }, type, format)).toBe(false)
  })
})

describe("filters that ask for the impossible", () => {
  const rows = [{ n: 1 }, { n: 5 }, { n: 10 }]
  const columns = resolveColumns<AnyRow, unknown>({
    columns: [{ key: "n", type: "number" }],
    rows,
    state: createState(),
    types,
  }).visible

  const run = (filters: TableState["filters"]) =>
    filterRows(rows, columns, filters, "all", types.get, format).map((row) => row["n"])

  it("returns nothing for a range with its bounds the wrong way round", () => {
    // Defensible either way; what matters is that it is consistent and does not
    // silently swap the user's numbers behind their back.
    expect(run([{ key: "n", operator: "between", value: ["10", "1"] }])).toEqual([])
  })

  it("returns nothing for a list with nothing in it", () => {
    expect(run([{ key: "n", operator: "in", value: [] }])).toEqual([1, 5, 10])
  })

  it("ignores a filter on a column nobody has any more", () => {
    expect(run([{ key: "deleted_last_week", operator: "eq", value: "x" }])).toEqual([1, 5, 10])
  })

  it("applies several filters on the same column", () => {
    expect(
      run([
        { key: "n", operator: "gte", value: "5" },
        { key: "n", operator: "lt", value: "10" },
      ]),
    ).toEqual([5])
  })

  it("refuses an operator the type does not offer, rather than guessing", () => {
    // `contains` on a number is not in the type's list, but a URL can still ask
    // for it — and the answer must be defined rather than a crash.
    expect(() => run([{ key: "n", operator: "contains", value: "1" }])).not.toThrow()
  })
})

describe("pages that do not exist", () => {
  const rows = Array.from({ length: 10 }, (_, index) => ({ id: String(index) }))

  it("clamps a page past the end", () => {
    const { result } = table(rows, { page: 99, pageSize: 3 })
    expect(result.rows).toHaveLength(1)
    expect(result.pageCount).toBe(4)
  })

  it("takes a page size larger than the data in its stride", () => {
    const { result } = table(rows, { pageSize: 1000 })
    expect(result.rows).toHaveLength(10)
    expect(result.pageCount).toBe(1)
  })

  it("copes with a page size of one", () => {
    const { result } = table(rows, { pageSize: 1, page: 10 })
    expect(result.rows).toHaveLength(1)
    expect(result.pageCount).toBe(10)
  })

  it("shows something when the data shrinks under a late page", () => {
    const { result } = table(rows.slice(0, 2), { page: 4, pageSize: 3 })
    expect(result.rows).toHaveLength(2)
  })
})

describe("arrangements that refer to nothing", () => {
  const rows = [{ a: 1, b: 2 }]

  it("ignores a sort on a column that is not there", () => {
    const { result } = table(rows, { sort: [{ key: "gone", direction: "asc" }] })
    expect(result.rows).toEqual(rows)
  })

  it("ignores an order naming columns that are not there", () => {
    const { columns } = table(rows, { order: ["ghost", "b", "a"] })
    expect(columns.map((column) => column.key)).toEqual(["b", "a"])
  })

  it("ignores a hidden column that does not exist", () => {
    const { columns } = table(rows, { hidden: ["ghost"] })
    expect(columns).toHaveLength(2)
  })

  it("still sorts by a hidden column if asked, because the state says so", () => {
    // Hiding a column changes what is shown, not what the rows are ordered by —
    // a saved view that sorts by a column it also hides is a real thing.
    const many = [{ a: 3 }, { a: 1 }, { a: 2 }]
    const { columns, state } = table(many, { sort: [{ key: "a", direction: "asc" }] })
    expect(sortRows(many, columns, state, types, format).map((row) => row["a"])).toEqual([1, 2, 3])
  })
})

describe("URLs somebody edited by hand", () => {
  const nonsense = [
    "page=-1",
    "page=abc",
    "size=0",
    "sort=",
    "sort=:::",
    "f=",
    "f=~~~~",
    "f=a:notanoperator:x",
    "f=%%%",
    "cols=~~~",
    "d=enormous",
    "match=maybe",
    "sel=,,,,",
    "w=a:b",
  ]

  for (const query of nonsense) {
    it(`survives "${query}"`, () => {
      expect(() => stateFromUrl(query)).not.toThrow()
      const state = createState(stateFromUrl(query))
      expect(state.page).toBeGreaterThan(0)
      expect(state.pageSize).toBeGreaterThan(0)
    })
  }

  it("keeps an unknown operator out of the way rather than matching everything", () => {
    const state = createState(stateFromUrl("f=n:notanoperator:5"))
    const rows = [{ n: 1 }, { n: 5 }]
    const columns = resolveColumns<AnyRow, unknown>({ columns: [{ key: "n" }], rows, state, types }).visible

    // An operator nobody recognises falls through to "asks nothing", which
    // shows everything rather than nothing — a filter that silently hides rows
    // is the worse failure.
    expect(filterRows(rows, columns, state.filters, "all", types.get, format)).toHaveLength(2)
  })

  it("survives a query string that is only rubbish", () => {
    expect(() => stateFromUrl("?????&&&==")).not.toThrow()
  })
})

describe("values that could break an export", () => {
  it("quotes what needs quoting and defuses a formula", () => {
    const rows = [
      { name: 'He said "hello"', note: "one,two", formula: "=SUM(A1:A9)", line: "first\nsecond" },
    ]
    const columns = resolveColumns<AnyRow, unknown>({ rows, state: createState(), types }).visible
    const csv = toCsv(rows, { columns, types, format, bom: false })

    expect(csv).toContain('"He said ""hello"""')
    expect(csv).toContain('"one,two"')
    // A leading `=` would be run as a formula by a spreadsheet.
    expect(csv).toContain("'=SUM(A1:A9)")
    expect(csv).toContain('"first\nsecond"')
  })
})

describe("a custom type that behaves badly", () => {
  const broken = createTypeRegistry({
    exploding: {
      name: "exploding",
      normalise: () => {
        throw new Error("no")
      },
    },
    silent: { name: "silent" },
  })

  it("does not swallow a custom type's error, so the author sees it", () => {
    const rows = [{ v: 1 }, { v: 2 }]
    const state = createState({ sort: [{ key: "v", direction: "asc" }] })
    const columns = resolveColumns<AnyRow, unknown>({
      columns: [{ key: "v", type: "exploding" }],
      rows,
      state,
      types: broken,
    }).visible

    // Deliberately not caught: a type that throws is a bug in the type, and
    // hiding it behind a fallback would make it impossible to find.
    expect(() => sortRows(rows, columns, state, broken, format)).toThrow("no")
  })

  it("treats a type that defines almost nothing as text", () => {
    const rows = [{ v: "b" }, { v: "a" }]
    const state = createState({ sort: [{ key: "v", direction: "asc" }] })
    const columns = resolveColumns<AnyRow, unknown>({
      columns: [{ key: "v", type: "silent" }],
      rows,
      state,
      types: broken,
    }).visible

    expect(sortRows(rows, columns, state, broken, format).map((row) => row["v"])).toEqual(["a", "b"])
  })

  it("falls back to text for a type nobody registered", () => {
    const rows = [{ v: "b" }, { v: "a" }]
    const columns = resolveColumns<AnyRow, unknown>({
      columns: [{ key: "v", type: "no-such-type" }],
      rows,
      state: createState(),
      types,
    }).visible

    expect(columns[0]?.type).toBe("text")
  })
})

describe("search that should find nothing", () => {
  const rows = [{ name: "Ada" }, { name: "Tom" }]
  const columns = resolveColumns<AnyRow, unknown>({ rows, state: createState(), types }).visible

  it("does not treat the query as a pattern", () => {
    for (const query of [".*", "[a-z]", "(", "\\", "$^"]) {
      expect(() => searchRows(rows, columns, query, types, format)).not.toThrow()
      expect(searchRows(rows, columns, query, types, format)).toEqual([])
    }
  })

  it("trims the query, because a stray space is not a search", () => {
    expect(searchRows(rows, columns, "  ada  ", types, format)).toHaveLength(1)
    expect(searchRows(rows, columns, "   ", types, format)).toHaveLength(2)
    // Inside the query it is a real character, and matches nothing here.
    expect(searchRows(rows, columns, "a d a", types, format)).toHaveLength(0)
  })
})

describe("state that round-trips through a URL", () => {
  it("survives values full of separators", () => {
    const awkward = createState({
      filters: [
        { key: "note", operator: "eq", value: "a:b~c,d&e=f?g#h" },
        { key: "tags", operator: "in", value: ["x,y", "z~w"] },
      ],
      search: "a&b=c",
    })

    expect(stateFromUrl(stateToQueryString(awkward)).filters).toEqual(awkward.filters)
    expect(stateFromUrl(stateToQueryString(awkward)).search).toBe(awkward.search)
  })

  it("survives an emoji", () => {
    const state = createState({ search: "🎉", filters: [{ key: "n", operator: "eq", value: "🎉" }] })
    expect(stateFromUrl(stateToQueryString(state)).search).toBe("🎉")
  })
})
