/**
 * Filter, search, sort, paginate — in that order, as pure functions.
 *
 * The order matters and is not negotiable: searching before filtering would
 * search rows the filters exclude, and paginating before either would make page
 * two of a filtered list mean nothing.
 *
 * These are the same functions on a server and in a browser, which is what
 * makes a server-rendered first page identical to the one the client would have
 * produced — no effect, no correction after paint, no flash of unsorted rows.
 */

import { filterRows } from "./filter.js"
import { compareWithType, type TypeRegistry } from "./registry.js"
import type {
  AnyRow,
  FormatContext,
  GetRowId,
  ResolvedColumn,
  TableRows,
  TableState,
} from "./types.js"
import { clamp, isEmpty, textIncludes } from "./util.js"

export type PipelineOptions<TRow> = {
  rows: readonly TRow[]
  columns: readonly ResolvedColumn<TRow, unknown>[]
  state: TableState
  types: TypeRegistry
  format: FormatContext
  /**
   * True when the caller has already filtered, sorted and paginated — a
   * database did the work and these rows are the answer.
   */
  server?: boolean
  /** Total matching rows, when the caller knows better than this array's length. */
  total?: number
  /** True in the append pagination modes, where every loaded page stays on screen. */
  accumulate?: boolean
}

/**
 * Runs rows through the whole pipeline.
 *
 * In server mode nothing is applied — the rows are returned as given and only
 * the counts are worked out, so the same component renders both ways with the
 * same code path.
 */
export function getRows<TRow extends AnyRow>(options: PipelineOptions<TRow>): TableRows<TRow> {
  const { rows, columns, state, types, format, server } = options

  if (server) {
    const total = options.total ?? rows.length
    return {
      rows: [...rows],
      total,
      totalUnfiltered: total,
      pageCount: pageCount(total, state.pageSize),
      filtered: state.filters.length > 0 || state.search.trim() !== "",
    }
  }

  const filtered = filterRows(rows, columns, state.filters, state.match, types.get, format)
  const searched = searchRows(filtered, columns, state.search, types, format)
  const sorted = sortRows(searched, columns, state, types, format)

  const total = sorted.length
  const pages = pageCount(total, state.pageSize)
  const page = clamp(state.page, 1, pages)

  /*
    Append modes show every page loaded so far, not just the current one, so
    they slice from the beginning. Numbered pagination shows one page.
  */
  const start = options.accumulate ? 0 : (page - 1) * state.pageSize
  const end = page * state.pageSize
  const paged = state.pageSize > 0 ? sorted.slice(start, end) : sorted

  return {
    rows: paged,
    total,
    totalUnfiltered: rows.length,
    pageCount: pages,
    filtered: total !== rows.length,
  }
}

export function pageCount(total: number, pageSize: number): number {
  if (pageSize <= 0) return 1
  return Math.max(1, Math.ceil(total / pageSize))
}

/**
 * Global search.
 *
 * Matches against each column's *formatted* text as well as its raw value, so
 * searching "Aug" finds a date and "Yes" finds a checkbox — the words on the
 * screen are the words a user will type.
 */
export function searchRows<TRow extends AnyRow>(
  rows: readonly TRow[],
  columns: readonly ResolvedColumn<TRow, unknown>[],
  search: string,
  types: TypeRegistry,
  format: FormatContext,
): TRow[] {
  const query = search.trim()
  if (query === "") return [...rows]

  const searchable = columns.filter((column) => column.searchable)
  if (searchable.length === 0) return [...rows]

  return rows.filter((row) =>
    searchable.some((column) => {
      const value = column.accessor(row)
      if (isEmpty(value)) return false

      if (Array.isArray(value)) {
        if (value.some((entry) => textIncludes(String(entry), query))) return true
      } else if (textIncludes(String(value), query)) {
        return true
      }

      const type = types.get(column.type)
      if (!type.format) return false

      const text = type.format(value, { ...format, ...column.formatOptions })
      return text !== "" && textIncludes(text, query)
    }),
  )
}

/**
 * Sorting, by every level in the state, in order.
 *
 * The array is copied before sorting because `Array.prototype.sort` mutates,
 * and mutating the caller's data is how a table starts changing the app around
 * it. `toSorted` would be neater and is not available everywhere yet.
 */
export function sortRows<TRow extends AnyRow>(
  rows: readonly TRow[],
  columns: readonly ResolvedColumn<TRow, unknown>[],
  state: TableState,
  types: TypeRegistry,
  format: FormatContext,
): TRow[] {
  const levels = state.sort
    .map((sort) => {
      const column = columns.find((candidate) => candidate.key === sort.key)
      return column && column.sortable ? { sort, column, type: types.get(column.type) } : undefined
    })
    .filter((level): level is NonNullable<typeof level> => level !== undefined)

  if (levels.length === 0) return [...rows]

  return [...rows].sort((a, b) => {
    for (const { sort, column, type } of levels) {
      const context = { ...format, ...column.formatOptions }
      const comparison = column.compare
        ? column.compare(column.accessor(a), column.accessor(b))
        : compareWithType(type, column.accessor(a), column.accessor(b), context)

      if (comparison !== 0) return sort.direction === "asc" ? comparison : -comparison
    }
    return 0
  })
}

/**
 * Row identity.
 *
 * Falls back to the index, which is correct only until the data is sorted or
 * paged — hence the warning. Selection, keys and expansion all depend on this,
 * so getting it right is worth one line of configuration.
 */
export function resolveRowId<TRow extends AnyRow>(
  row: TRow,
  index: number,
  getRowId?: GetRowId<TRow>,
): string {
  if (getRowId) return getRowId(row, index)

  const id = (row as AnyRow)["id"] ?? (row as AnyRow)["uuid"] ?? (row as AnyRow)["key"]
  if (typeof id === "string" || typeof id === "number") return String(id)

  return String(index)
}

/** True when rows have no usable identity of their own, so a caller can be warned once. */
export function rowsLackIds<TRow extends AnyRow>(rows: readonly TRow[]): boolean {
  const first = rows[0]
  if (!first || typeof first !== "object") return false
  return first["id"] === undefined && first["uuid"] === undefined && first["key"] === undefined
}
