import fc from "fast-check"
import { describe, expect, it } from "vitest"

import { resolveColumns } from "./columns.js"
import { DEFAULT_FORMAT } from "./format.js"
import { filterRows, isFilterUsable, normaliseFilter } from "./filter.js"
import { getRows, searchRows, sortRows } from "./pipeline.js"
import { createTypeRegistry } from "./registry.js"
import { createState, setSelected, toggleSelection } from "./state.js"
import { stateFromUrl, stateToSearchParams } from "./url.js"
import { columns, customTypes, makeRows, type Row } from "./testing/dataset.js"
import type { ColumnFilter, FilterOperator, TableState } from "./types.js"

/**
 * Invariants.
 *
 * Properties that must hold for *any* data and *any* arrangement, checked
 * against thousands of randomly generated states. Where the conformance suite
 * asks "is this the right answer", this asks "could this ever be a wrong sort of
 * answer" — rows appearing twice, rows vanishing, a page that overlaps the one
 * before it, an order that depends on how many times you sorted.
 */

const NOW = new Date("2026-08-13T12:00:00.000Z")
const FORMAT = { ...DEFAULT_FORMAT, now: NOW }

const rows = makeRows(400, 11)
const types = createTypeRegistry(customTypes)
const resolved = resolveColumns<Row, unknown>({ columns, rows, state: createState(), types }).visible

const keys = resolved.map((column) => column.key)
const ids = (list: readonly Row[]) => list.map((row) => row.id)

/* ── Generators ──────────────────────────────────────────────────────────── */

const operator = fc.constantFrom<FilterOperator>(
  "eq",
  "ne",
  "contains",
  "notContains",
  "startsWith",
  "endsWith",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "in",
  "notIn",
  "empty",
  "notEmpty",
)

/** Values drawn from the data itself, plus a few that are in it nowhere. */
const filterValue = fc.oneof(
  fc.constantFrom("pro", "active", "urgent", "ada", "1990-01-01", "2026-03-01", "09:30", "true", "0", "100", "1.0.0", "high"),
  fc.integer({ min: -1000, max: 1000 }).map(String),
  fc.constantFrom("", "   ", "☃", "nothing-matches-this"),
)

/**
 * A filter in the shape the library keeps them in: a list for the list
 * operators, a single value for everything else.
 */
const filter: fc.Arbitrary<ColumnFilter> = fc
  .record({
    key: fc.constantFrom(...keys),
    operator,
    value: fc.oneof(filterValue, fc.array(filterValue, { minLength: 1, maxLength: 3 })),
  })
  .map(({ key, operator: op, value }) => normaliseFilter({ key, operator: op, value }))

/** The same, but always complete — an operator with a value it can use. */
const usableFilter: fc.Arbitrary<ColumnFilter> = filter.filter(isFilterUsable)

const state: fc.Arbitrary<TableState> = fc
  .record({
    filters: fc.array(filter, { maxLength: 3 }),
    match: fc.constantFrom<"all" | "any">("all", "any"),
    search: fc.constantFrom("", "a", "ada", "pro", "2026", "☃", "urgent"),
    sort: fc.array(
      fc.record({ key: fc.constantFrom(...keys), direction: fc.constantFrom<"asc" | "desc">("asc", "desc") }),
      { maxLength: 2 },
    ),
    page: fc.integer({ min: 1, max: 30 }),
    pageSize: fc.constantFrom(1, 5, 10, 25, 100),
  })
  .map((partial) => createState(partial))

/** Enough runs to be worth trusting, few enough to stay a test rather than a job. */
const runs = { numRuns: 300 }

/* ── Filtering ───────────────────────────────────────────────────────────── */

describe("filtering", () => {
  it("returns a subsequence of the input — never a new row, never a reordering", () => {
    fc.assert(
      fc.property(fc.array(filter, { maxLength: 3 }), fc.constantFrom<"all" | "any">("all", "any"), (filters, match) => {
        const result = filterRows(rows, resolved, filters, match, types.get, FORMAT)
        const order = ids(result)

        expect(new Set(order).size).toBe(order.length)
        expect(order).toEqual(ids(rows).filter((id) => order.includes(id)))
      }),
      runs,
    )
  })

  it("is idempotent", () => {
    fc.assert(
      fc.property(fc.array(filter, { maxLength: 3 }), (filters) => {
        const once = filterRows(rows, resolved, filters, "all", types.get, FORMAT)
        const twice = filterRows(once, resolved, filters, "all", types.get, FORMAT)
        expect(ids(twice)).toEqual(ids(once))
      }),
      runs,
    )
  })

  it("narrows as conditions are added, and widens as they are relaxed", () => {
    fc.assert(
      fc.property(usableFilter, usableFilter, (a, b) => {
        const one = filterRows(rows, resolved, [a], "all", types.get, FORMAT)
        const both = filterRows(rows, resolved, [a, b], "all", types.get, FORMAT)
        const either = filterRows(rows, resolved, [a, b], "any", types.get, FORMAT)

        expect(both.length).toBeLessThanOrEqual(one.length)
        expect(either.length).toBeGreaterThanOrEqual(one.length)
      }),
      runs,
    )
  })

  it("splits the rows in two: a condition and its negation, plus the blanks", () => {
    const pairs: Array<[FilterOperator, FilterOperator]> = [
      ["eq", "ne"],
      ["contains", "notContains"],
      ["in", "notIn"],
      ["empty", "notEmpty"],
    ]

    fc.assert(
      fc.property(fc.constantFrom(...keys), filterValue, fc.constantFrom(...pairs), (key, value, [yes, no]) => {
        // A half-typed filter asks nothing, so it is ignored rather than
        // applied — and then neither side of the question excludes anything.
        if (yes !== "empty" && (value === "" || value.trim() === "")) return
        const listed = yes === "in" ? [value] : value
        const matching = filterRows(rows, resolved, [{ key, operator: yes, value: listed }], "all", types.get, FORMAT)
        const notMatching = filterRows(rows, resolved, [{ key, operator: no, value: listed }], "all", types.get, FORMAT)

        // No row can be on both sides of a question.
        const overlap = ids(matching).filter((id) => ids(notMatching).includes(id))
        expect(overlap).toEqual([])
      }),
      runs,
    )
  })

  it("ignores an incomplete filter rather than letting it exclude anything", () => {
    fc.assert(
      fc.property(fc.constantFrom(...keys), fc.constantFrom("eq", "contains", "gt", "in", "between") as fc.Arbitrary<FilterOperator>, (key, op) => {
        for (const value of ["", undefined, [] as string[]]) {
          const result = filterRows(rows, resolved, [{ key, operator: op, value: value as never }], "all", types.get, FORMAT)
          expect(result).toHaveLength(rows.length)
        }
      }),
      runs,
    )
  })

  it("ignores a filter naming a column that does not exist", () => {
    fc.assert(
      fc.property(operator, filterValue, (op, value) => {
        const result = filterRows(rows, resolved, [{ key: "no_such_column", operator: op, value }], "all", types.get, FORMAT)
        expect(result).toHaveLength(rows.length)
      }),
      runs,
    )
  })
})

/* ── Sorting ─────────────────────────────────────────────────────────────── */

describe("sorting", () => {
  const sortable = resolved.filter((column) => column.sortable).map((column) => column.key)

  it("is a permutation — every row still there, exactly once", () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ key: fc.constantFrom(...keys), direction: fc.constantFrom<"asc" | "desc">("asc", "desc") }), { maxLength: 3 }),
        (levels) => {
          const sorted = sortRows(rows, resolved, createState({ sort: levels }), types, FORMAT)
          expect(sorted).toHaveLength(rows.length)
          expect([...ids(sorted)].sort()).toEqual([...ids(rows)].sort())
        },
      ),
      runs,
    )
  })

  it("never mutates the rows it was given", () => {
    const before = ids(rows)
    fc.assert(
      fc.property(fc.constantFrom(...keys), fc.constantFrom<"asc" | "desc">("asc", "desc"), (key, direction) => {
        sortRows(rows, resolved, createState({ sort: [{ key, direction }] }), types, FORMAT)
        expect(ids(rows)).toEqual(before)
      }),
      runs,
    )
  })

  it("is idempotent", () => {
    fc.assert(
      fc.property(fc.constantFrom(...sortable), fc.constantFrom<"asc" | "desc">("asc", "desc"), (key, direction) => {
        const state = createState({ sort: [{ key, direction }] })
        const once = sortRows(rows, resolved, state, types, FORMAT)
        const twice = sortRows(once, resolved, state, types, FORMAT)
        expect(ids(twice)).toEqual(ids(once))
      }),
      runs,
    )
  })

  it("is stable: rows that tie keep the order they arrived in", () => {
    fc.assert(
      fc.property(fc.constantFrom("plan", "status", "priority", "active"), (key) => {
        const sorted = sortRows(rows, resolved, createState({ sort: [{ key, direction: "asc" }] }), types, FORMAT)

        const groups = new Map<string, string[]>()
        for (const row of sorted) {
          const value = String(row[key as keyof Row])
          groups.set(value, [...(groups.get(value) ?? []), row.id])
        }

        for (const [, group] of groups) {
          expect(group).toEqual([...group].sort())
        }
      }),
      { numRuns: 20 },
    )
  })

  it("puts blanks last whichever way it is sorted", () => {
    fc.assert(
      fc.property(fc.constantFrom(...sortable), fc.constantFrom<"asc" | "desc">("asc", "desc"), (key, direction) => {
        const sorted = sortRows(rows, resolved, createState({ sort: [{ key, direction }] }), types, FORMAT)

        const blank = (row: Row) => {
          const value = row[key as keyof Row]
          return value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)
        }

        const firstBlank = sorted.findIndex(blank)
        if (firstBlank === -1) return
        expect(sorted.slice(firstBlank).every(blank)).toBe(true)
      }),
      runs,
    )
  })

  it("reverses exactly, apart from the blanks and the ties", () => {
    fc.assert(
      fc.property(fc.constantFrom(...sortable), (key) => {
        const present = (row: Row) => {
          const value = row[key as keyof Row]
          return !(value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0))
        }

        const ascending = sortRows(rows, resolved, createState({ sort: [{ key, direction: "asc" }] }), types, FORMAT).filter(present)
        const descending = sortRows(rows, resolved, createState({ sort: [{ key, direction: "desc" }] }), types, FORMAT).filter(present)

        const column = resolved.find((entry) => entry.key === key)!
        const type = types.get(column.type)
        const value = (row: Row) =>
          column.compare ? String(row[key as keyof Row]) : String(type.normalise?.(row[key as keyof Row], FORMAT) ?? "")

        // Compared by value rather than by id: ties may swap, and that is
        // allowed. The sequence of values must still be the mirror image.
        expect(descending.map(value)).toEqual([...ascending.map(value)].reverse())
      }),
      runs,
    )
  })

  it("applies later levels only where earlier ones tie", () => {
    fc.assert(
      fc.property(fc.constantFrom("plan", "status", "priority"), fc.constantFrom("name", "count", "version"), (first, second) => {
        const sorted = sortRows(
          rows,
          resolved,
          createState({ sort: [{ key: first, direction: "asc" }, { key: second, direction: "asc" }] }),
          types,
          FORMAT,
        )

        // Sorting by the second key alone and then stably by the first must
        // give the same answer, which is what "levels" means.
        const bySecond = sortRows(rows, resolved, createState({ sort: [{ key: second, direction: "asc" }] }), types, FORMAT)
        const then = sortRows(bySecond, resolved, createState({ sort: [{ key: first, direction: "asc" }] }), types, FORMAT)

        expect(ids(sorted)).toEqual(ids(then))
      }),
      { numRuns: 30 },
    )
  })
})

/* ── Search ──────────────────────────────────────────────────────────────── */

describe("search", () => {
  it("returns everything for an empty or blank query", () => {
    fc.assert(
      fc.property(fc.constantFrom("", " ", "   ", "\t"), (query) => {
        expect(searchRows(rows, resolved, query, types, FORMAT)).toHaveLength(rows.length)
      }),
      { numRuns: 10 },
    )
  })

  it("narrows as the query grows", () => {
    fc.assert(
      fc.property(fc.constantFrom("a", "ad", "ada", "p", "pr", "pro", "2", "20", "202"), (query) => {
        const wider = searchRows(rows, resolved, query.slice(0, -1), types, FORMAT)
        const narrower = searchRows(rows, resolved, query, types, FORMAT)

        const widerIds = new Set(ids(wider))
        expect(ids(narrower).every((id) => widerIds.has(id))).toBe(true)
      }),
      { numRuns: 30 },
    )
  })

  it("ignores case and accents", () => {
    for (const [a, b] of [
      ["ada", "ADA"],
      ["zoe", "Zoë"],
      ["josé", "jose"],
      ["émile", "EMILE"],
      ["professional", "Professional"],
    ]) {
      expect(ids(searchRows(rows, resolved, a!, types, FORMAT))).toEqual(
        ids(searchRows(rows, resolved, b!, types, FORMAT)),
      )
    }
  })

  it("preserves the order it was given", () => {
    fc.assert(
      fc.property(fc.constantFrom("a", "e", "pro", "2026"), (query) => {
        const result = ids(searchRows(rows, resolved, query, types, FORMAT))
        expect(result).toEqual(ids(rows).filter((id) => result.includes(id)))
      }),
      { numRuns: 20 },
    )
  })
})

/* ── Pagination ──────────────────────────────────────────────────────────── */

describe("pagination", () => {
  it("cuts the matching rows into pages that exactly cover them, with no overlap", () => {
    fc.assert(
      fc.property(state, (base) => {
        const first = getRows<Row, unknown>({ rows, columns: resolved, state: { ...base, page: 1 }, types, format: FORMAT })
        const collected: string[] = []

        for (let page = 1; page <= first.pageCount; page += 1) {
          const result = getRows<Row, unknown>({ rows, columns: resolved, state: { ...base, page }, types, format: FORMAT })

          expect(result.total).toBe(first.total)
          expect(result.pageCount).toBe(first.pageCount)
          // Every page but the last is full.
          if (page < first.pageCount) expect(result.rows).toHaveLength(base.pageSize)
          collected.push(...ids(result.rows))
        }

        // The pages, laid end to end, are the whole matching set — in order,
        // once each.
        const everything = getRows<Row, unknown>({
          rows,
          columns: resolved,
          state: { ...base, page: 1, pageSize: rows.length + 1 },
          types,
          format: FORMAT,
        })

        expect(collected).toEqual(ids(everything.rows))
        expect(new Set(collected).size).toBe(collected.length)
        expect(collected).toHaveLength(first.total)
      }),
      { numRuns: 120 },
    )
  })

  it("clamps a page past the end rather than showing an empty table", () => {
    fc.assert(
      fc.property(state, fc.integer({ min: 1, max: 500 }), (base, page) => {
        const result = getRows<Row, unknown>({ rows, columns: resolved, state: { ...base, page }, types, format: FORMAT })
        if (result.total > 0) expect(result.rows.length).toBeGreaterThan(0)
      }),
      { numRuns: 120 },
    )
  })

  it("shows every page loaded so far when accumulating, and only those", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 12 }), fc.constantFrom(5, 10, 25), (page, pageSize) => {
        const base = createState({ page, pageSize })
        const accumulated = getRows<Row, unknown>({ rows, columns: resolved, state: base, types, format: FORMAT, accumulate: true })

        const pages: string[] = []
        for (let index = 1; index <= page; index += 1) {
          const single = getRows<Row, unknown>({ rows, columns: resolved, state: { ...base, page: index }, types, format: FORMAT })
          pages.push(...ids(single.rows))
        }

        expect(ids(accumulated.rows)).toEqual(pages)
      }),
      { numRuns: 60 },
    )
  })

  it("counts pages consistently with what it returns", () => {
    fc.assert(
      fc.property(state, (base) => {
        const result = getRows<Row, unknown>({ rows, columns: resolved, state: base, types, format: FORMAT })
        expect(result.pageCount).toBe(Math.max(1, Math.ceil(result.total / base.pageSize)))
        expect(result.rows.length).toBeLessThanOrEqual(base.pageSize)
      }),
      runs,
    )
  })
})

/* ── Data integrity ──────────────────────────────────────────────────────── */

describe("data integrity", () => {
  it("never mutates the rows it was given, whatever is asked of it", () => {
    const snapshot = JSON.stringify(rows)

    fc.assert(
      fc.property(state, (base) => {
        getRows<Row, unknown>({ rows, columns: resolved, state: base, types, format: FORMAT })
        expect(JSON.stringify(rows)).toBe(snapshot)
      }),
      { numRuns: 100 },
    )
  })

  it("returns the caller's own row objects, not copies of them", () => {
    // Identity matters: a caller keying a map by row, or comparing with ===,
    // must get back the object they handed over.
    const result = getRows<Row, unknown>({ rows, columns: resolved, state: createState(), types, format: FORMAT })
    expect(result.rows.every((row) => rows.includes(row))).toBe(true)
  })

  it("reports totals that match what it returns", () => {
    fc.assert(
      fc.property(state, (base) => {
        const result = getRows<Row, unknown>({ rows, columns: resolved, state: base, types, format: FORMAT })

        expect(result.totalUnfiltered).toBe(rows.length)
        expect(result.total).toBeLessThanOrEqual(rows.length)
        expect(result.filtered).toBe(result.total !== rows.length)
      }),
      runs,
    )
  })
})

/* ── State ───────────────────────────────────────────────────────────────── */

describe("state", () => {
  it("survives a round trip through a URL", () => {
    fc.assert(
      fc.property(state, (base) => {
        // Selection and widths stay out of the URL by default, so they are not
        // part of what round-trips.
        const shared = { ...base, selection: [], widths: {} }
        expect(stateFromUrl(stateToSearchParams(shared))).toEqual(shared)
      }),
      runs,
    )
  })

  it("selecting twice returns to where it started", () => {
    fc.assert(
      fc.property(fc.constantFrom(...ids(rows).slice(0, 50)), (id) => {
        const base = createState()
        expect(toggleSelection(toggleSelection(base, id), id).selection).toEqual([])
      }),
      { numRuns: 30 },
    )
  })

  it("selecting a page and clearing it leaves everything else alone", () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...ids(rows).slice(0, 50)), { maxLength: 8 }), (page) => {
        const base = createState({ selection: ["elsewhere"] })
        const selected = setSelected(base, page, true)
        const cleared = setSelected(selected, page, false)

        expect(cleared.selection).toEqual(["elsewhere"])
      }),
      { numRuns: 50 },
    )
  })
})
