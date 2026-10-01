import { describe, expect, it } from "vitest"

import { resolveColumns } from "./columns.js"
import { rowsToExport, toCsv, toDelimitedText } from "./csv.js"
import { DEFAULT_FORMAT } from "./format.js"
import { getRows } from "./pipeline.js"
import { createTypeRegistry, defaultTypeRegistry } from "./registry.js"
import { createState, setColumnSearch } from "./state.js"
import type { AnyRow, ColumnDef } from "./types.js"

/**
 * What ends up in the file.
 *
 * A spreadsheet is not a page. "$4,790.50" is right in a cell and useless in a
 * column somebody wants to add up, and "Aug 13, 2026" cannot be sorted as a
 * date by anything that opens the file — so money and dates go in as a number
 * and an ISO date, while a select column still goes in as its label.
 */

const types = defaultTypeRegistry
const format = DEFAULT_FORMAT

function csv<TRow extends AnyRow>(rows: TRow[], columns: ColumnDef<TRow>[]): string[] {
  const visible = resolveColumns<TRow, unknown>({ columns, rows, state: createState(), types }).visible
  return toCsv(rows, { columns: visible, types, format, bom: false }).split("\r\n")
}

describe("values a spreadsheet can work with", () => {
  it("writes numbers as numbers, without grouping", () => {
    const [, row] = csv([{ n: 1_234_567.5 }], [{ key: "n", type: "number" }])
    expect(row).toBe("1234567.5")
  })

  it("writes money as a number in major units, with no symbol", () => {
    const [, minor] = csv([{ amount: 479_050 }], [
      { key: "amount", type: "currency", formatOptions: { currencyInMinorUnits: true } },
    ])
    expect(minor).toBe("4790.5")

    const [, major] = csv([{ amount: 4790.5 }], [{ key: "amount", type: "currency" }])
    expect(major).toBe("4790.5")
  })

  it("writes dates as ISO, so they sort wherever the file lands", () => {
    const [, row] = csv([{ due: "2026-08-13", when: "2026-08-13T22:30:00Z" }], [
      { key: "due", type: "date" },
      { key: "when", type: "datetime" },
    ])
    expect(row).toBe("2026-08-13,2026-08-13T22:30:00.000Z")
  })

  it("writes a relative time as the instant it refers to", () => {
    // "3 days ago" means nothing in a file read next week.
    const [, row] = csv([{ seen: "2026-08-10T12:00:00Z" }], [{ key: "seen", type: "relativeTime" }])
    expect(row).toBe("2026-08-10T12:00:00.000Z")
  })

  it("leaves an empty value empty rather than writing a placeholder", () => {
    const [, row] = csv([{ n: null, d: null }], [
      { key: "n", type: "number" },
      { key: "d", type: "date" },
    ])
    expect(row).toBe(",")
  })
})

describe("values a person needs to read", () => {
  it("writes the label of a choice, not the value stored underneath", () => {
    const [, row] = csv([{ plan: "pro" }], [
      { key: "plan", type: "select", formatOptions: { options: [{ value: "pro", label: "Professional" }] } },
    ])
    expect(row).toBe("Professional")
  })

  it("writes a checkbox as a word", () => {
    const [, row] = csv([{ ok: true, no: false }], [
      { key: "ok", type: "boolean" },
      { key: "no", type: "boolean" },
    ])
    expect(row).toBe("Yes,No")
  })

  it("writes tags as a readable list", () => {
    const [, row] = csv([{ tags: ["urgent", "new"] }], [{ key: "tags", type: "tags" }])
    expect(row).toBe('"urgent, new"')
  })
})

describe("what the caller says goes", () => {
  it("prefers the column's own export value", () => {
    const [, row] = csv([{ amount: 4790.5 }], [
      { key: "amount", type: "currency", exportValue: ({ value }) => `AUD ${String(value)}` },
    ])
    expect(row).toBe("AUD 4790.5")
  })

  it("then the column's own formatter", () => {
    const [, row] = csv([{ amount: 4790.5 }], [
      { key: "amount", type: "currency", format: ({ value }) => `about ${Math.round(Number(value))}` },
    ])
    expect(row).toBe("about 4791")
  })

  it("and a custom type can say how it belongs in a file", () => {
    const registry = createTypeRegistry({
      duration: {
        name: "duration",
        format: (value) => `${String(value)} minutes`,
        exportValue: (value) => String(Number(value) * 60),
      },
    })

    const rows = [{ length: 90 }]
    const visible = resolveColumns<AnyRow, unknown>({
      columns: [{ key: "length", type: "duration" }],
      rows,
      state: createState(),
      types: registry,
    }).visible

    const [, row] = toCsv(rows, { columns: visible, types: registry, format, bom: false }).split("\r\n")
    expect(row).toBe("5400")
  })

  it("leaves a column out when it is not exportable", () => {
    const [header] = csv([{ name: "Ada", actions: "x" }], [
      { key: "name" },
      { key: "actions", header: "", exportable: false },
    ])
    expect(header).toBe("Name")
  })
})

describe("the shape of the file", () => {
  it("separates with tabs when asked, for pasting into a spreadsheet", () => {
    const rows = [{ a: "one", b: "two" }]
    const visible = resolveColumns<AnyRow, unknown>({ rows, state: createState(), types }).visible

    // CRLF throughout, which is what the CSV specification asks for and what
    // Excel handles without complaint on every platform.
    expect(toDelimitedText(rows, { columns: visible, types, format, delimiter: "\t" })).toBe("A\tB\r\none\ttwo")
  })

  it("starts with a byte order mark, which is what makes Excel read it as UTF-8", () => {
    const rows = [{ name: "José" }]
    const visible = resolveColumns<AnyRow, unknown>({ rows, state: createState(), types }).visible

    expect(toCsv(rows, { columns: visible, types, format }).startsWith("﻿")).toBe(true)
    expect(toCsv(rows, { columns: visible, types, format, bom: false }).startsWith("﻿")).toBe(false)
  })
})

/**
 * An export is the view, written down.
 *
 * Whatever the table is showing — the levels of its sort, a search typed into
 * a column header, the columns moved and hidden, a handful of rows ticked — is
 * what the file has to hold, and in the same order. Each of those is tried on
 * its own and then all at once, because the combinations are where an export
 * quietly returns something other than what was on screen.
 */
describe("an export follows the view", () => {
  type Person = { id: string; name: string; team: string; salary: number | null; joined: string }

  const staff: Person[] = [
    { id: "1", name: "Ada", team: "Eng", salary: 120_000, joined: "2024-03-01" },
    { id: "2", name: "Tom", team: "Sales", salary: 80_000, joined: "2023-06-15" },
    { id: "3", name: "Zoë", team: "Eng", salary: 120_000, joined: "2022-01-10" },
    { id: "4", name: "Bea", team: "Eng", salary: 95_000, joined: "2024-03-01" },
    { id: "5", name: "Cy", team: "Sales", salary: 80_000, joined: "2025-02-20" },
    { id: "6", name: "Dee", team: "Ops", salary: null, joined: "2021-11-05" },
  ]

  const definitions: ColumnDef<Person>[] = [
    { key: "name" },
    { key: "team" },
    { key: "salary", type: "currency" },
    { key: "joined", type: "date" },
  ]

  /** The file a table in this state would write, line by line. */
  function exported(
    partial: Parameters<typeof createState>[0],
    options: { scope?: "matching" | "page"; delimiter?: string; columns?: ColumnDef<Person>[] } = {},
  ): string[] {
    const state = createState(partial)
    const { visible } = resolveColumns<Person, unknown>({
      columns: options.columns ?? definitions,
      rows: staff,
      state,
      types,
      headerSearch: true,
    })
    const view = getRows<Person, unknown>({ rows: staff, columns: visible, state, types, format })
    const { rows } = rowsToExport(options.scope === "page" ? view.rows : view.matched, state.selection)

    return toDelimitedText(rows, { columns: visible, types, format, delimiter: options.delimiter }).split("\r\n")
  }

  const threeLevels = [
    { key: "team", direction: "asc" },
    { key: "salary", direction: "desc" },
    { key: "name", direction: "asc" },
  ] as const

  it("writes rows in the order of a sort with several levels", () => {
    expect(exported({ sort: [...threeLevels] })).toEqual([
      "Name,Team,Salary,Joined",
      "Ada,Eng,120000,2024-03-01",
      "Zoë,Eng,120000,2022-01-10",
      "Bea,Eng,95000,2024-03-01",
      "Dee,Ops,,2021-11-05",
      "Cy,Sales,80000,2025-02-20",
      "Tom,Sales,80000,2023-06-15",
    ])
  })

  it("turns one level over without disturbing the others", () => {
    const sort = [{ key: "team", direction: "desc" }, threeLevels[1], threeLevels[2]] as const
    expect(exported({ sort: [...sort] }).slice(1).map((line) => line.split(",")[0])).toEqual([
      "Cy",
      "Tom",
      "Dee",
      "Ada",
      "Zoë",
      "Bea",
    ])
  })

  it("holds only what a search in a column header leaves", () => {
    const state = setColumnSearch(createState(), "team", "s")
    // "Sales" and "Ops" both say "s"; "Eng" does not.
    expect(exported(state).slice(1).map((line) => line.split(",")[0])).toEqual(["Tom", "Cy", "Dee"])
  })

  it("finds money by the figure on screen, and writes it as a number", () => {
    const state = setColumnSearch(createState(), "salary", "$80,000")
    expect(exported(state).slice(1)).toEqual(["Tom,Sales,80000,2023-06-15", "Cy,Sales,80000,2025-02-20"])
  })

  it("finds a date by its month, and writes it as ISO", () => {
    const state = setColumnSearch(createState(), "joined", "mar")
    expect(exported(state).slice(1)).toEqual(["Ada,Eng,120000,2024-03-01", "Bea,Eng,95000,2024-03-01"])
  })

  it("applies searches in two columns together", () => {
    let state = setColumnSearch(createState(), "team", "eng")
    state = setColumnSearch(state, "joined", "2024")
    expect(exported(state).slice(1).map((line) => line.split(",")[0])).toEqual(["Ada", "Bea"])
  })

  it("follows the column order and leaves out what is hidden", () => {
    expect(exported({ order: ["joined", "name"], hidden: ["salary"] })[0]).toBe("Joined,Name,Team")
    expect(exported({ order: ["joined", "name"], hidden: ["salary"] })[1]).toBe("2024-03-01,Ada,Eng")
  })

  it("puts a pinned column where the table shows it", () => {
    expect(exported({ pinned: { team: "start", name: "end" } })[0]).toBe("Team,Salary,Joined,Name")
  })

  it("leaves out a column marked as not for export, wherever it sits", () => {
    const columns: ColumnDef<Person>[] = [{ key: "name" }, { key: "team", exportable: false }, { key: "salary", type: "currency" }]
    expect(exported({ order: ["team"] }, { columns })[0]).toBe("Name,Salary")
  })

  it("holds the selection alone, in the order of the view rather than of the ticking", () => {
    expect(
      exported({ sort: [...threeLevels], selection: ["2", "3", "5"] }).slice(1).map((line) => line.split(",")[0]),
    ).toEqual(["Zoë", "Cy", "Tom"])
  })

  it("drops a selected row the filters no longer show", () => {
    const state = { ...setColumnSearch(createState(), "team", "eng"), selection: ["1", "2"] }
    // Tom is ticked but in Sales, and the view is Eng.
    expect(exported(state).slice(1).map((line) => line.split(",")[0])).toEqual(["Ada"])
  })

  it("holds one page or every page, as asked", () => {
    const paged = { sort: [...threeLevels], pageSize: 2, page: 2 }
    expect(exported(paged, { scope: "page" }).slice(1).map((line) => line.split(",")[0])).toEqual(["Bea", "Dee"])
    expect(exported(paged, { scope: "matching" })).toHaveLength(7)
  })

  it("keeps a selection that is on another page, because the matching rows are all on hand", () => {
    const paged = { sort: [...threeLevels], pageSize: 2, page: 1, selection: ["5"] }
    expect(exported(paged).slice(1).map((line) => line.split(",")[0])).toEqual(["Cy"])
    // Asked for the page alone, a row that is not on it is not in the file.
    expect(exported(paged, { scope: "page" }).slice(1)).toEqual([])
  })

  it("does all of it at once", () => {
    let state = createState({
      sort: [
        { key: "salary", direction: "desc" },
        { key: "name", direction: "desc" },
      ],
      order: ["team", "name"],
      hidden: ["joined"],
      selection: ["4", "3", "6", "1"],
      match: "all",
      search: "e",
    })
    state = setColumnSearch(state, "team", "eng")
    state = setColumnSearch(state, "salary", "$1")

    // Eng only, salaries reading "$1…" only (so not Bea's $95,000.00), the
    // global search leaves names and teams with an "e" in them, the ticked
    // rows among those, highest paid first and names backwards within a tie.
    expect(exported(state)).toEqual(["Team,Name,Salary", "Eng,Zoë,120000", "Eng,Ada,120000"])
  })

  it("writes the same rows for the clipboard, tab-separated", () => {
    const state = setColumnSearch(createState({ sort: [...threeLevels] }), "team", "sales")
    expect(exported(state, { delimiter: "\t" })).toEqual([
      "Name\tTeam\tSalary\tJoined",
      "Cy\tSales\t80000\t2025-02-20",
      "Tom\tSales\t80000\t2023-06-15",
    ])
  })

  it("exports nothing but the heading when the view is empty", () => {
    expect(exported(setColumnSearch(createState(), "name", "nobody"))).toEqual(["Name,Team,Salary,Joined"])
  })
})

describe("which rows an export contains", () => {
  const rows = [
    { id: "a", name: "Ada" },
    { id: "b", name: "Bea" },
    { id: "c", name: "Cy" },
  ]

  it("is everything, when nothing is selected — and the caller may still know more", () => {
    const result = rowsToExport(rows, [])
    expect(result.rows).toEqual(rows)
    expect(result.rows).not.toBe(rows)
    expect(result.complete).toBe(false)
  })

  it("is the selection, in row order, when there is one", () => {
    const result = rowsToExport(rows, ["c", "a"])
    expect(result.rows.map((row) => row.id)).toEqual(["a", "c"])
    expect(result.complete).toBe(true)
  })

  it("says so when part of the selection is not on hand", () => {
    const result = rowsToExport(rows, ["a", "zz"])
    expect(result.rows.map((row) => row.id)).toEqual(["a"])
    expect(result.complete).toBe(false)
  })

  it("finds rows by the caller's own identity", () => {
    const keyed = [{ code: "x1" }, { code: "x2" }]
    expect(rowsToExport(keyed, ["x2"], (row) => row.code).rows).toEqual([{ code: "x2" }])
  })

  it("counts a repeated id once", () => {
    expect(rowsToExport(rows, ["a", "a"]).complete).toBe(true)
  })
})
