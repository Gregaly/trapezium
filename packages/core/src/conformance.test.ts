import { describe, expect, it } from "vitest"

import { resolveColumns } from "./columns.js"
import { DEFAULT_FORMAT } from "./format.js"
import { filterRows, matchesFilter } from "./filter.js"
import { getRows, searchRows, sortRows } from "./pipeline.js"
import { createTypeRegistry } from "./registry.js"
import { createState } from "./state.js"
import { columns, customTypes, makeRows, PLANS, STATUSES, type Row } from "./testing/dataset.js"
import { found, matches, order, type OracleColumn } from "./testing/oracle.js"
import type { FilterOperator, TableState } from "./types.js"

/**
 * Conformance.
 *
 * Every type, every operator, against an independent reference implementation
 * over a dataset built to be awkward — nulls, blanks, zeroes, accents, emoji,
 * numbers stored as text, dates in four shapes. Where the two disagree, one of
 * them is wrong, and the disagreement is worth understanding before anything
 * ships.
 */

const NOW = new Date("2026-08-13T12:00:00.000Z")
const FORMAT = { ...DEFAULT_FORMAT, now: NOW }

const rows = makeRows(600, 7)
const types = createTypeRegistry(customTypes)

/** The same columns the library is given, described for the reference. */
const oracleColumns: OracleColumn[] = columns.map((column) => ({
  key: column.key as keyof Row,
  type: column.type ?? "text",
  options: column.formatOptions?.options,
  minorUnits: column.formatOptions?.currencyInMinorUnits,
}))

function resolve(state: TableState = createState()) {
  return resolveColumns<Row, unknown>({ columns, rows, state, types }).visible
}

const resolved = resolve()

function oracleOf(key: string): OracleColumn {
  const column = oracleColumns.find((entry) => entry.key === key)
  if (!column) throw new Error(`no oracle column for ${key}`)
  return column
}

/** Values worth filtering each column by, drawn from the data itself. */
const TARGETS: Record<string, unknown[]> = {
  id: ["row_00001", "ROW_00042", "row_9999"],
  name: ["ada", "Zoë", "zoe", "O'Neill", "🎉", "", "  Padded"],
  bio: ["biography", "prose"],
  count: [0, "0", 100, "-50", 999_999],
  amountCents: [0, "10000", -5000, 250_000],
  ratio: [0, "50", 99.99],
  active: [true, false, "true", "false"],
  birthday: ["1990-01-01", "1970-06-15", "2020-12-31"],
  seenAt: ["2026-03-01", "2026-03-01T12:00:00.000Z", "2026-12-31"],
  startsAt: ["09:30", "00:00", "23:59"],
  updatedAt: ["2026-05-01", "2026-01-01T00:00:00.000Z"],
  plan: ["pro", "Professional", "PRO", "nothing"],
  status: ["active", "Closed", "paused"],
  tags: ["urgent", "vip", ["urgent", "new"]],
  email: ["example.com", "ada", "@"],
  website: ["https://example.com/1", "example"],
  phone: ["+61", "4"],
  avatar: ["avatar", "png"],
  reference: ["REF-2026001", "ref-2026", "2026"],
  snippet: ["const", "value = 1"],
  home: ["Sydney", "Test Street", "2000"],
  attachment: ["document-1.pdf", "pdf"],
  payload: ["anything"],
  version: ["1.0.0", "10.0.0", "2.5"],
  priority: ["high", "High", "blocker", "someday"],
  seat: ["A1", "B10"],
}

const ALL_OPERATORS: FilterOperator[] = [
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
]

describe("filtering matches the reference, for every type and every operator", () => {
  for (const column of resolved) {
    const oracle = oracleOf(column.key)
    const targets = TARGETS[column.key] ?? ["x"]

    it(`${column.key} (${column.type})`, () => {
      const disagreements: string[] = []

      for (const operator of ALL_OPERATORS) {
        const values: unknown[] =
          operator === "empty" || operator === "notEmpty"
            ? [undefined]
            : operator === "between"
              ? [[targets[0], targets[targets.length - 1]]]
              : operator === "in" || operator === "notIn"
                ? [targets.slice(0, 2)]
                : targets

        for (const target of values) {
          for (const row of rows) {
            const value = row[column.key as keyof Row]
            const filter = { key: column.key, operator, ...(target === undefined ? {} : { value: target as never }) }

            const mine = matchesFilter(value, filter, types.get(column.type), {
              ...FORMAT,
              ...column.formatOptions,
            })
            const theirs = matches(oracle, value, operator, target)

            if (mine !== theirs) {
              disagreements.push(
                `${column.key} ${operator} ${JSON.stringify(target)} on ${JSON.stringify(value)}: library=${String(mine)} reference=${String(theirs)}`,
              )
            }
          }
        }
      }

      expect(disagreements.slice(0, 5)).toEqual([])
    })
  }
})

describe("sorting matches the reference, for every type", () => {
  for (const column of resolved) {
    const oracle = oracleOf(column.key)

    it(`${column.key} (${column.type})`, () => {
      for (const direction of ["asc", "desc"] as const) {
        const state = createState({ sort: [{ key: column.key, direction }] })
        const mine = sortRows(rows, resolved, state, types, FORMAT)

        /*
          A type with no meaningful order — a picture, a blob of JSON — must
          leave the rows exactly as they were. Silently reordering by something
          arbitrary would be worse than refusing.
        */
        if (!column.sortable) {
          expect(mine.map((row) => row.id)).toEqual(rows.map((row) => row.id))
          continue
        }

        const theirs = [...rows].sort((a, b) => {
          const left = a[column.key as keyof Row]
          const right = b[column.key as keyof Row]

          // The column with its own comparator is ordered by that comparator,
          // and by nothing else — which is the point of offering one.
          if (column.compare) {
            const comparison = column.compare(left, right)
            return direction === "asc" ? comparison : -comparison
          }

          const blankLeft = left === null || left === undefined || left === "" || (Array.isArray(left) && left.length === 0)
          const blankRight = right === null || right === undefined || right === "" || (Array.isArray(right) && right.length === 0)
          if (blankLeft || blankRight) {
            if (blankLeft && blankRight) return 0
            return blankLeft ? 1 : -1
          }

          const comparison = order(oracle, left, right)
          return direction === "asc" ? comparison : -comparison
        })

        expect(mine.map((row) => row.id)).toEqual(theirs.map((row) => row.id))
      }
    })
  }
})

describe("search matches the reference", () => {
  const queries = [
    "ada",
    "zoe",
    "Zoë",
    "PRO",
    "Professional",
    "urgent",
    "example.com",
    "Aug",
    "2026",
    "$1,",
    "yes",
    "🎉",
    "O'Neill",
    "nothing at all",
    "  ",
    "1.0.0",
    "High",
  ]

  for (const query of queries) {
    it(`"${query}"`, () => {
      const mine = searchRows(rows, resolved, query, types, FORMAT)
      const theirs = rows.filter((row) => found(oracleColumns, row, query, NOW))

      expect(mine.map((row) => row.id)).toEqual(theirs.map((row) => row.id))
    })
  }
})

describe("the whole pipeline matches the reference", () => {
  /** Filter, then search, then sort, then page — in that order, every time. */
  const scenarios: Array<{ name: string; state: Partial<TableState> }> = [
    {
      name: "one filter",
      state: { filters: [{ key: "plan", operator: "eq", value: "pro" }] },
    },
    {
      name: "two filters, all",
      state: {
        filters: [
          { key: "plan", operator: "in", value: ["pro", "team"] },
          { key: "count", operator: "gte", value: "100" },
        ],
      },
    },
    {
      name: "two filters, any",
      state: {
        match: "any",
        filters: [
          { key: "status", operator: "eq", value: "closed" },
          { key: "amountCents", operator: "lt", value: "0" },
        ],
      },
    },
    {
      name: "filter and search",
      state: { filters: [{ key: "priority", operator: "lte", value: "high" }], search: "ada" },
    },
    {
      name: "filter, search and sort",
      state: {
        filters: [{ key: "tags", operator: "in", value: ["urgent", "vip"] }],
        search: "example",
        sort: [{ key: "version", direction: "desc" }],
      },
    },
    {
      name: "everything, paged",
      state: {
        filters: [
          { key: "active", operator: "eq", value: "true" },
          { key: "birthday", operator: "gte", value: "1980-01-01" },
        ],
        search: "e",
        sort: [
          { key: "priority", direction: "asc" },
          { key: "name", direction: "asc" },
        ],
        page: 3,
        pageSize: 20,
      },
    },
    {
      name: "date day-bounds",
      state: { filters: [{ key: "seenAt", operator: "eq", value: "2026-03-01" }] },
    },
    {
      name: "custom type, custom order",
      state: { sort: [{ key: "seat", direction: "asc" }], filters: [{ key: "version", operator: "gte", value: "5.0.0" }] },
    },
  ]

  for (const scenario of scenarios) {
    it(scenario.name, () => {
      const state = createState(scenario.state)
      const mine = getRows<Row, unknown>({ rows, columns: resolved, state, types, format: FORMAT })

      /* The reference does the same four steps, plainly. */
      let expected = rows.filter((row) => {
        const results = state.filters.map((filter) =>
          matches(oracleOf(filter.key), row[filter.key as keyof Row], filter.operator, filter.value),
        )
        return state.match === "any" ? results.some(Boolean) : results.every(Boolean)
      })

      expected = expected.filter((row) => found(oracleColumns, row, state.search, NOW))

      expected = [...expected].sort((a, b) => {
        for (const level of state.sort) {
          const column = resolved.find((entry) => entry.key === level.key)
          const left = a[level.key as keyof Row]
          const right = b[level.key as keyof Row]

          if (column?.compare) {
            const comparison = column.compare(left, right)
            if (comparison !== 0) return level.direction === "asc" ? comparison : -comparison
            continue
          }

          const blankLeft = left === null || left === undefined || left === "" || (Array.isArray(left) && left.length === 0)
          const blankRight = right === null || right === undefined || right === "" || (Array.isArray(right) && right.length === 0)
          if (blankLeft || blankRight) {
            if (blankLeft && blankRight) continue
            return blankLeft ? 1 : -1
          }

          const comparison = order(oracleOf(level.key), left, right)
          if (comparison !== 0) return level.direction === "asc" ? comparison : -comparison
        }
        return 0
      })

      const total = expected.length
      const pageCount = Math.max(1, Math.ceil(total / state.pageSize))
      const page = Math.min(Math.max(state.page, 1), pageCount)
      const paged = expected.slice((page - 1) * state.pageSize, page * state.pageSize)

      expect(mine.total).toBe(total)
      expect(mine.pageCount).toBe(pageCount)
      expect(mine.rows.map((row) => row.id)).toEqual(paged.map((row) => row.id))
    })
  }
})

describe("filterRows and the single-value check agree", () => {
  it("a filter applied to a set gives the same answer as applying it row by row", () => {
    for (const column of resolved) {
      for (const operator of ["eq", "contains", "gt", "in", "notEmpty"] as FilterOperator[]) {
        const target = (TARGETS[column.key] ?? ["x"])[0]
        const filter = {
          key: column.key,
          operator,
          ...(operator === "notEmpty" ? {} : { value: (operator === "in" ? [target] : target) as never }),
        }

        const viaSet = filterRows(rows, resolved, [filter], "all", types.get, FORMAT)
        const viaRow = rows.filter((row) =>
          matchesFilter(row[column.key as keyof Row], filter, types.get(column.type), {
            ...FORMAT,
            ...column.formatOptions,
          }),
        )

        expect(viaSet.map((row) => row.id)).toEqual(viaRow.map((row) => row.id))
      }
    }
  })
})
