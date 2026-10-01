/**
 * Every combination an export can be asked for.
 *
 * An export is the view, written down — so what the file should hold depends
 * on everything the view depends on at once: the levels of the sort, a filter,
 * a search typed into a column header, the toolbar's search, the columns moved
 * and hidden, the rows ticked, and whether "the view" means the page or all of
 * it. Each of those is easy to get right alone. The bugs live in the pairs,
 * which is why this multiplies them out rather than sampling them.
 *
 * What each combination should produce is worked out here by a second
 * implementation, written plainly from the documented behaviour and sharing
 * nothing with the library's pipeline — the same idea as the conformance
 * suite's reference. An adapter renders a table in each state, presses
 * "Download CSV" or "Copy to clipboard", and compares what came out.
 */

import type { ColumnDef, PartialTableState } from "../types.js"

export type ExportRow = {
  id: string
  name: string
  team: string
  salary: number | null
  joined: string
  remote: boolean
  tags: string[]
}

/** Twelve people, with ties to sort through, a gap, an accent and a row with no tags. */
export const EXPORT_ROWS: ExportRow[] = [
  { id: "1", name: "Ada", team: "Eng", salary: 120_000, joined: "2024-03-01", remote: true, tags: ["lead", "core"] },
  { id: "2", name: "Tom", team: "Sales", salary: 80_000, joined: "2023-06-15", remote: false, tags: ["new"] },
  { id: "3", name: "Zoë", team: "Eng", salary: 120_000, joined: "2022-01-10", remote: true, tags: [] },
  { id: "4", name: "Bea", team: "Eng", salary: 95_000, joined: "2024-03-22", remote: false, tags: ["core"] },
  { id: "5", name: "Cy", team: "Sales", salary: 80_000, joined: "2025-02-20", remote: true, tags: ["new", "lead"] },
  { id: "6", name: "Dee", team: "Ops", salary: null, joined: "2021-11-05", remote: false, tags: ["core"] },
  { id: "7", name: "Eli", team: "Ops", salary: 101_500, joined: "2024-12-01", remote: true, tags: ["lead"] },
  { id: "8", name: "Fay", team: "Eng", salary: 135_250, joined: "2020-09-30", remote: false, tags: ["core", "new"] },
  { id: "9", name: "Gus", team: "Sales", salary: 64_000, joined: "2024-07-04", remote: true, tags: [] },
  { id: "10", name: "Hal", team: "Ops", salary: 101_500, joined: "2023-02-14", remote: false, tags: ["new"] },
  { id: "11", name: "Ida", team: "Eng", salary: 18_000, joined: "2025-05-19", remote: true, tags: ["lead"] },
  { id: "12", name: "Jo", team: "Sales", salary: 112_000, joined: "2022-10-08", remote: false, tags: ["core"] },
]

/** One column of each kind an export treats differently. Written with no renderers, so every adapter can take them. */
export const EXPORT_COLUMNS: ColumnDef<ExportRow>[] = [
  { key: "name" },
  { key: "team" },
  { key: "salary", type: "currency" },
  { key: "joined", type: "date" },
  { key: "remote", type: "boolean" },
  { key: "tags", type: "tags" },
]

/** Rows a page, for the scenarios that export only the page. */
export const EXPORT_PAGE_SIZE = 4

export type ExportScenario = {
  /** Reads as the combination it is: "sorted by three levels, searched in two headers, …". */
  name: string
  /** The state to put the table in. */
  state: PartialTableState
  /** `matching` exports every row the view matches; `page` only those on screen. */
  scope: "matching" | "page"
  /** Which control to press. */
  action: "download" | "copy"
  /** Exactly what should be handed to the browser, byte order mark and all. */
  expected: string
}

type Axis<T> = Array<{ label: string; value: T }>

const SORTS: Axis<NonNullable<PartialTableState["sort"]>> = [
  { label: "unsorted", value: [] },
  { label: "sorted by one column", value: [{ key: "salary", direction: "desc" }] },
  {
    label: "sorted by three levels",
    value: [
      { key: "team", direction: "asc" },
      { key: "salary", direction: "desc" },
      { key: "name", direction: "asc" },
    ],
  },
]

const FILTERS: Axis<NonNullable<PartialTableState["filters"]>> = [
  { label: "unfiltered", value: [] },
  { label: "filtered to one team", value: [{ key: "team", operator: "eq", value: "Eng" }] },
  { label: "searched in the salary header", value: [{ key: "salary", operator: "contains", value: "$1" }] },
  {
    label: "searched in two headers",
    value: [
      { key: "joined", operator: "contains", value: "2024" },
      { key: "name", operator: "contains", value: "a" },
    ],
  },
]

const SEARCHES: Axis<string> = [
  { label: "no toolbar search", value: "" },
  { label: "toolbar search", value: "le" },
]

const ARRANGEMENTS: Axis<{ order: string[]; hidden: string[] }> = [
  { label: "columns as given", value: { order: [], hidden: [] } },
  { label: "columns moved and one hidden", value: { order: ["joined", "name"], hidden: ["remote"] } },
]

const SELECTIONS: Axis<string[]> = [
  { label: "nothing ticked", value: [] },
  { label: "four rows ticked", value: ["11", "2", "9", "4"] },
]

const SCOPES: Axis<"matching" | "page"> = [
  { label: "every page", value: "matching" },
  { label: "this page", value: "page" },
]

const ACTIONS: Axis<"download" | "copy"> = [
  { label: "downloaded", value: "download" },
  { label: "copied", value: "copy" },
]

/** Every combination: 3 sorts × 4 filters × 2 searches × 2 arrangements × 2 selections × 2 scopes × 2 actions. */
export function exportScenarios(): ExportScenario[] {
  const scenarios: ExportScenario[] = []

  for (const sort of SORTS) {
    for (const filter of FILTERS) {
      for (const search of SEARCHES) {
        for (const arrangement of ARRANGEMENTS) {
          for (const selection of SELECTIONS) {
            for (const scope of SCOPES) {
              for (const action of ACTIONS) {
                const state: PartialTableState = {
                  sort: sort.value,
                  filters: filter.value,
                  search: search.value,
                  order: arrangement.value.order,
                  hidden: arrangement.value.hidden,
                  selection: selection.value,
                  page: 1,
                  pageSize: EXPORT_PAGE_SIZE,
                }

                scenarios.push({
                  name: [sort.label, filter.label, search.label, arrangement.label, selection.label, scope.label, action.label].join(", "),
                  state,
                  scope: scope.value,
                  action: action.value,
                  expected: expectedExport(state, scope.value, action.value),
                })
              }
            }
          }
        }
      }
    }
  }

  return scenarios
}

/* ── The reference ───────────────────────────────────────────────────────── */

const money = new Intl.NumberFormat("en", { style: "currency", currency: "USD" })
const day = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })

/** What each cell shows on screen, which is what a search is typed against. */
function shown(row: ExportRow, key: string): string {
  switch (key) {
    case "name":
      return row.name
    case "team":
      return row.team
    case "salary":
      return row.salary === null ? "" : money.format(row.salary)
    case "joined":
      return day.format(new Date(`${row.joined}T00:00:00.000Z`))
    case "remote":
      return row.remote ? "Yes" : "No"
    case "tags":
      return row.tags.join(", ")
    default:
      return ""
  }
}

/** The value written out, where it is a plain one. */
function stored(row: ExportRow, key: string): string[] {
  switch (key) {
    case "name":
      return [row.name]
    case "team":
      return [row.team]
    case "salary":
      return row.salary === null ? [] : [String(row.salary)]
    case "joined":
      return [row.joined]
    case "remote":
      return [String(row.remote)]
    case "tags":
      return row.tags
    default:
      return []
  }
}

function blank(row: ExportRow, key: string): boolean {
  if (key === "salary") return row.salary === null
  if (key === "tags") return row.tags.length === 0
  return false
}

const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()

/** "Contains", as a header search means it: the value written out, or the text on screen. */
function says(row: ExportRow, key: string, query: string): boolean {
  if (blank(row, key)) return false
  const needle = fold(query)
  return [...stored(row, key), shown(row, key)].some((text) => fold(text).includes(needle))
}

function passes(row: ExportRow, state: PartialTableState): boolean {
  for (const filter of state.filters ?? []) {
    if (filter.operator === "eq") {
      if (fold(shown(row, filter.key)) !== fold(String(filter.value))) return false
    } else if (filter.operator === "contains") {
      if (!says(row, filter.key, String(filter.value))) return false
    }
  }

  const query = (state.search ?? "").trim()
  if (query === "") return true

  // The toolbar's search looks in every column but the checkbox, which shows no text of its own.
  return ["name", "team", "salary", "joined", "tags"].some((key) => says(row, key, query))
}

function compare(a: ExportRow, b: ExportRow, key: string): number {
  if (key === "salary") return (a.salary ?? 0) - (b.salary ?? 0)
  if (key === "name") return fold(a.name).localeCompare(fold(b.name))
  if (key === "team") return fold(a.team).localeCompare(fold(b.team))
  return 0
}

function ordered(rows: ExportRow[], state: PartialTableState): ExportRow[] {
  const levels = state.sort ?? []
  if (levels.length === 0) return rows

  // Stable, with blanks last whichever way a level runs.
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      for (const level of levels) {
        const leftBlank = blank(left.row, level.key)
        const rightBlank = blank(right.row, level.key)
        if (leftBlank || rightBlank) {
          if (leftBlank && rightBlank) continue
          return leftBlank ? 1 : -1
        }

        const difference = compare(left.row, right.row, level.key)
        if (difference !== 0) return level.direction === "asc" ? difference : -difference
      }
      return left.index - right.index
    })
    .map((entry) => entry.row)
}

/** The columns as the table shows them: the named ones first, the rest after, the hidden ones gone. */
function arranged(state: PartialTableState): string[] {
  const keys = EXPORT_COLUMNS.map((column) => String(column.key))
  const order = state.order ?? []
  const hidden = new Set(state.hidden ?? [])

  return [...order.filter((key) => keys.includes(key)), ...keys.filter((key) => !order.includes(key))].filter(
    (key) => !hidden.has(key),
  )
}

/** What belongs in a file, which is not always what belongs on a screen. */
function written(row: ExportRow, key: string): string {
  switch (key) {
    case "salary":
      return row.salary === null ? "" : String(row.salary)
    case "joined":
      return row.joined
    default:
      return shown(row, key)
  }
}

const HEADERS: Record<string, string> = {
  name: "Name",
  team: "Team",
  salary: "Salary",
  joined: "Joined",
  remote: "Remote",
  tags: "Tags",
}

function field(value: string, delimiter: string): string {
  return value.includes(delimiter) || value.includes('"') || value.includes("\n")
    ? `"${value.replace(/"/g, '""')}"`
    : value
}

function expectedExport(state: PartialTableState, scope: "matching" | "page", action: "download" | "copy"): string {
  const delimiter = action === "download" ? "," : "\t"
  const columns = arranged(state)

  const matched = ordered(EXPORT_ROWS.filter((row) => passes(row, state)), state)
  const onHand = scope === "page" ? matched.slice(0, EXPORT_PAGE_SIZE) : matched

  // A selection is a deliberate choice of rows, so it wins — among the rows on hand.
  const selection = new Set(state.selection ?? [])
  const rows = selection.size > 0 ? onHand.filter((row) => selection.has(row.id)) : onHand

  const lines = [
    columns.map((key) => field(HEADERS[key] ?? key, delimiter)).join(delimiter),
    ...rows.map((row) => columns.map((key) => field(written(row, key), delimiter)).join(delimiter)),
  ]

  const text = lines.join("\r\n")
  // The file opens with a byte order mark so that Excel reads it as UTF-8; the clipboard does not.
  return action === "download" ? `﻿${text}` : text
}
