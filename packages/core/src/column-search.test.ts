import { describe, expect, it } from "vitest"

import { resolveColumns } from "./columns.js"
import { DEFAULT_FORMAT } from "./format.js"
import { getRows } from "./pipeline.js"
import { createTypeRegistry, formatWithType } from "./registry.js"
import { columnSearchText, createState, setColumnSearch } from "./state.js"
import { columns, customTypes, makeRows, type Row } from "./testing/dataset.js"
import { isBlank, matches, type OracleColumn } from "./testing/oracle.js"
import { stateFromUrl, stateToQueryString } from "./url.js"

/**
 * Searching a column from its header, for every type there is.
 *
 * The promise is that a person can type what they see. So the words searched
 * for here are read off the cells themselves — the text each column shows for
 * real rows of the awkward dataset — and every one of them has to find the row
 * it was read from, agree with the reference implementation about every other
 * row, and survive being put in a link.
 */

const NOW = new Date("2026-08-13T12:00:00.000Z")
const FORMAT = { ...DEFAULT_FORMAT, now: NOW }

const rows = makeRows(400, 11)
const types = createTypeRegistry(customTypes)

const resolved = resolveColumns<Row, unknown>({
  columns,
  rows,
  state: createState(),
  types,
  headerSearch: true,
}).visible

const oracleColumns = new Map<string, OracleColumn>(
  columns.map((column) => [
    String(column.key),
    {
      key: column.key as keyof Row,
      type: column.type ?? "text",
      options: column.formatOptions?.options,
      minorUnits: column.formatOptions?.currencyInMinorUnits,
    },
  ]),
)

/** Every row the search leaves, with paging out of the way. */
function search(key: string, text: string) {
  const state = setColumnSearch(createState(), key, text)
  const result = getRows<Row, unknown>({
    rows,
    columns: resolved,
    state: { ...state, pageSize: 0 },
    types,
    format: FORMAT,
  })
  return { state, found: result.matched }
}

/** The pieces of a cell's text a person might type: all of it, either end, the middle, shouted. */
function fragments(text: string): string[] {
  const middle = Math.floor(text.length / 2)
  const pieces = [text, text.slice(0, 3), text.slice(-3), text.slice(Math.max(0, middle - 2), middle + 2), text.toUpperCase()]
  return [...new Set(pieces.map((piece) => piece.trim()).filter((piece) => piece !== ""))]
}

describe("which columns can be searched from their header", () => {
  it("is every type that shows text, and neither of the two that do not", () => {
    const off = resolved.filter((column) => !column.headerSearch).map((column) => column.type)
    expect(off.sort()).toEqual(["image", "json"])
  })
})

describe("typing what a cell shows finds that cell, for every type", () => {
  for (const column of resolved.filter((entry) => entry.headerSearch)) {
    const oracle = oracleColumns.get(column.key)
    if (!oracle) throw new Error(`no reference column for ${column.key}`)

    it(`${column.key} (${column.type})`, () => {
      const context = { ...FORMAT, ...column.formatOptions }

      // A handful of real rows that have something in this column.
      const samples = rows.filter((row) => !isBlank(row[column.key as keyof Row])).slice(0, 6)
      expect(samples.length).toBeGreaterThan(0)

      let asked = 0

      for (const sample of samples) {
        const shown = formatWithType(types.get(column.type), sample[column.key as keyof Row], context)

        for (const text of fragments(shown)) {
          const { state, found } = search(column.key, text)
          asked += 1

          // The row the words were read from is among the answers.
          expect(found, `"${text}" in ${column.key}`).toContain(sample)

          // And the whole answer is the reference's, row for row and in order.
          const expected = rows.filter((row) => matches(oracle, row[column.key as keyof Row], "contains", text, NOW))
          expect(found.map((row) => row.id)).toEqual(expected.map((row) => row.id))

          // A link to this view opens on the same search.
          const reopened = stateFromUrl(stateToQueryString(state))
          expect(reopened.filters).toEqual(state.filters)
          expect(columnSearchText(reopened, column.key)).toBe(text)
        }
      }

      expect(asked).toBeGreaterThan(0)
    })
  }
})

describe("a search nobody could satisfy", () => {
  it("finds nothing, in any column, rather than everything", () => {
    for (const column of resolved.filter((entry) => entry.headerSearch)) {
      expect(search(column.key, "⟪no cell says this⟫").found, column.key).toEqual([])
    }
  })

  it("never finds a row whose cell is empty", () => {
    for (const column of resolved.filter((entry) => entry.headerSearch)) {
      // "e" and "1" between them turn up in nearly every shown value.
      for (const text of ["e", "1"]) {
        const blank = search(column.key, text).found.filter((row) => isBlank(row[column.key as keyof Row]))
        expect(blank, `${column.key} "${text}"`).toEqual([])
      }
    }
  })
})

describe("a column search alongside everything else", () => {
  it("narrows what the other filters, the global search and the sort already apply", () => {
    let state = setColumnSearch(createState(), "amountCents", "$1,")
    state = setColumnSearch(state, "birthday", "19")
    state = {
      ...state,
      search: "example",
      sort: [
        { key: "plan", direction: "asc" },
        { key: "name", direction: "desc" },
      ],
      pageSize: 0,
    }

    const result = getRows<Row, unknown>({ rows, columns: resolved, state, types, format: FORMAT })
    expect(result.total).toBeGreaterThan(0)

    const amount = oracleColumns.get("amountCents")
    const birthday = oracleColumns.get("birthday")
    if (!amount || !birthday) throw new Error("missing reference columns")

    for (const row of result.matched) {
      expect(matches(amount, row.amountCents, "contains", "$1,", NOW)).toBe(true)
      expect(matches(birthday, row.birthday, "contains", "19", NOW)).toBe(true)
    }

    // Ordered by plan label, then by name backwards within a plan.
    const plans = result.matched.map((row) => formatWithType(types.get("select"), row.plan, {
      ...FORMAT,
      options: columns.find((column) => column.key === "plan")?.formatOptions?.options,
    }))
    expect(plans).toEqual([...plans].sort((a, b) => a.localeCompare(b)))
  })
})
