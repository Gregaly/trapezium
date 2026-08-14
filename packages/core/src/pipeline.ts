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
import { type TypeDef, type TypeRegistry } from "./registry.js"
import type {
  AnyRow,
  FormatContext,
  FormatOptions,
  GetRowId,
  ResolvedColumn,
  TableRows,
  TableState,
} from "./types.js"
import { clamp, compareUnknown, createTextMatcher, isEmpty } from "./util.js"

export type PipelineOptions<TRow, TNode = unknown> = {
  rows: readonly TRow[]
  columns: readonly ResolvedColumn<TRow, TNode>[]
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
  /**
   * The table was told where a set filter's values come from — `server.distinct`
   * — so a column without a list of its own is not a mistake.
   */
  serverDistinct?: boolean
}

/**
 * Runs rows through the whole pipeline.
 *
 * In server mode nothing is applied — the rows are returned as given and only
 * the counts are worked out, so the same component renders both ways with the
 * same code path.
 */
export function getRows<TRow extends AnyRow, TNode = unknown>(
  options: PipelineOptions<TRow, TNode>,
): TableRows<TRow> {
  const { rows, columns, state, types, format, server } = options

  if (server) {
    const total = options.total ?? rows.length
    if (options.accumulate) warnIfNotAccumulating(rows.length, state)
    if (!options.serverDistinct) warnAboutSetFilters(columns)
    return {
      rows: [...rows],
      matched: [...rows],
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
    // The same array the page was cut from, so this costs nothing.
    matched: sorted,
    total,
    totalUnfiltered: rows.length,
    pageCount: pages,
    filtered: total !== rows.length,
  }
}

/*
  In server mode the table renders exactly what it is handed, so "load more" and
  infinite scrolling only work if the caller appends each page to the last. The
  symptom when they do not is the same page appearing to reload forever, which
  is a miserable thing to debug from the outside — so it is said out loud, once.
*/
let warned = false

function warnIfNotAccumulating(rowCount: number, state: TableState): void {
  if (warned || state.page < 2 || rowCount > state.pageSize) return
  if (typeof process !== "undefined" && process.env["NODE_ENV"] === "production") return

  warned = true
  console.warn(
    "[trapezium] Append pagination in server mode expects `data` to hold every page loaded so far, " +
      `but page ${String(state.page)} arrived with ${String(rowCount)} rows. Append the new page to the ` +
      "previous rows, or have the query return `page * pageSize` rows from the start. " +
      "See https://github.com/Gregaly/trapezium/blob/main/docs/server-data.md#load-more-and-infinite-scroll",
  )
}

/*
  A set filter offers the values it can see. In server mode that is one page,
  so its choices are whatever happened to be on screen — which looks like a
  working filter right up until somebody goes looking for a value that is not on
  page one. The fix is one property, so it is worth saying out loud.
*/
const warnedColumns = new Set<string>()

function warnAboutSetFilters<TRow, TNode>(columns: readonly ResolvedColumn<TRow, TNode>[]): void {
  if (typeof process !== "undefined" && process.env["NODE_ENV"] === "production") return

  for (const column of columns) {
    if (column.filterKind !== "set") continue
    // Either a list of its own, a function that fetches one, or labels it can
    // fall back on.
    if (column.filterOptions) continue
    if (column.formatOptions?.options?.length) continue
    if (warnedColumns.has(column.key)) continue

    warnedColumns.add(column.key)
    console.warn(
      `[trapezium] The set filter on "${column.key}" is offering only the values on the page it can ` +
        "see, because in server mode that is all the table has. Say where the values come from — " +
        "server={{ distinct }} for every column at once, or filter: { kind: \"set\", options } for " +
        "this one — or the values on later pages will be unfindable. " +
        "See https://github.com/Gregaly/trapezium/blob/main/docs/filtering.md#set-filters-with-server-side-data",
    )
  }
}

export function pageCount(total: number, pageSize: number): number {
  if (pageSize <= 0) return 1
  return Math.max(1, Math.ceil(total / pageSize))
}

/**
 * The text a cell shows, remembered per row.
 *
 * Search compares against what is on the screen as well as what is underneath,
 * which means formatting every date, every amount and every duration — and
 * `Intl` formatting costs roughly a microsecond a cell. Over ten thousand rows
 * and a handful of formatted columns that is a fifth of a second on every
 * keystroke.
 *
 * So it is remembered against the row object itself. Filtering and sorting hand
 * back the same objects, and an application replacing its data replaces those
 * objects — so the cache is invalidated by exactly the thing that should
 * invalidate it, and holds nothing alive that the caller has let go of.
 */
const searchText = new WeakMap<object, Map<string, string>>()

function cachedText(
  row: object,
  cacheKey: string,
  type: TypeDef,
  value: unknown,
  context: FormatContext & FormatOptions,
): string {
  let perRow = searchText.get(row)
  if (!perRow) {
    perRow = new Map()
    searchText.set(row, perRow)
  }

  const remembered = perRow.get(cacheKey)
  if (remembered !== undefined) return remembered

  const text = type.format ? type.format(value, context) : ""
  perRow.set(cacheKey, text)
  return text
}

/**
 * Identifies the formatting that produced a cached string.
 *
 * Two tables over the same rows in different currencies must not read each
 * other's cache, and neither must one table before and after its locale changes.
 */
function formatSignature(context: FormatContext & FormatOptions): string {
  return [
    context.locale,
    context.timeZone,
    context.currency,
    context.currencyInMinorUnits ? "1" : "0",
    context.decimals ?? "",
    // `now` moves, and a relative time formatted an hour ago reads differently
    // — but only to the minute, which is close enough to key on.
    context.now ? Math.floor(context.now.getTime() / 60_000) : "",
    context.options ? context.options.map((option) => `${option.value}=${option.label ?? ""}`).join(",") : "",
  ].join("|")
}

/**
 * Global search.
 *
 * Matches against each column's *formatted* text as well as its raw value, so
 * searching "Aug" finds a date and "Yes" finds a checkbox — the words on the
 * screen are the words a user will type.
 */
export function searchRows<TRow extends AnyRow, TNode = unknown>(
  rows: readonly TRow[],
  columns: readonly ResolvedColumn<TRow, TNode>[],
  search: string,
  types: TypeRegistry,
  format: FormatContext,
): TRow[] {
  const query = search.trim()
  if (query === "") return [...rows]

  /*
    Everything that does not depend on the row is worked out once. Building a
    context object per cell — twenty-six columns times ten thousand rows — costs
    more than the comparison it was built for.
  */
  const searchable = columns
    .filter((column) => column.searchable)
    .map((column) => {
      const context = column.formatOptions ? { ...format, ...column.formatOptions } : format
      const type = types.get(column.type)
      return {
        accessor: column.accessor,
        type,
        context,
        // Only a type that renders something other than its raw value needs the
        // expensive pass at all.
        formats: type.format !== undefined,
        cacheKey: `${column.key}|${type.name}|${formatSignature(context)}`,
      }
    })

  if (searchable.length === 0) return [...rows]

  const matches = createTextMatcher(query)

  return rows.filter((row) => {
    for (const column of searchable) {
      const value = column.accessor(row)
      if (isEmpty(value)) continue

      if (Array.isArray(value)) {
        if (value.some((entry) => matches(String(entry)))) return true
      } else if (typeof value !== "object") {
        /*
          Only primitives are compared as they are. `String({…})` is
          "[object Object]", so without this a search for "object" matches every
          row with an address, a file or a blob of JSON in it — and a search for
          the postcode inside that address matches nothing, because the raw form
          never contained it. The formatted text below is the real answer for
          anything structured.
        */
        if (matches(String(value))) return true
      }

      if (!column.formats) continue

      const text = cachedText(row as object, column.cacheKey, column.type, value, column.context)
      if (text !== "" && matches(text)) return true
    }

    return false
  })
}

/**
 * Sorting, by every level in the state, in order.
 *
 * Each row's sort key is worked out **once** and then sorted on, rather than
 * being recomputed inside the comparator. A comparison sort asks about two rows
 * roughly `n log n` times, so the naive version normalises a hundred and fifty
 * thousand values to order ten thousand rows — and for a type whose rule is
 * expensive, like parsing a date or a version number, that is the whole cost of
 * the sort.
 *
 * The array is copied before sorting because `Array.prototype.sort` mutates,
 * and mutating the caller's data is how a table starts changing the app around
 * it.
 */
export function sortRows<TRow extends AnyRow, TNode = unknown>(
  rows: readonly TRow[],
  columns: readonly ResolvedColumn<TRow, TNode>[],
  state: TableState,
  types: TypeRegistry,
  format: FormatContext,
): TRow[] {
  const levels = state.sort
    .map((sort) => {
      const column = columns.find((candidate) => candidate.key === sort.key)
      if (!column || !column.sortable) return undefined

      const context = column.formatOptions ? { ...format, ...column.formatOptions } : format
      return { sort, column, type: types.get(column.type), context }
    })
    .filter((level): level is NonNullable<typeof level> => level !== undefined)

  if (levels.length === 0) return [...rows]

  /*
    A column with its own comparator keeps the raw value, because the caller's
    function is the only thing that knows what to do with it. Everything else is
    reduced to a comparable key here, once.
  */
  const decorated = rows.map((row) => ({
    row,
    keys: levels.map((level) => {
      const value = level.column.accessor(row)
      if (level.column.compare || !level.type.normalise) return value
      return level.type.normalise(value, level.context)
    }),
  }))

  decorated.sort((left, right) => {
    for (let index = 0; index < levels.length; index += 1) {
      const level = levels[index]!
      const a = left.keys[index]
      const b = right.keys[index]

      /*
        Empties sort last in *both* directions, so they are handled before the
        direction is applied. Negating the whole comparison for a descending
        sort would drag every blank row to the top — the user asked for the
        newest first, not for the ones with no date at all.
      */
      const leftEmpty = isEmpty(a)
      const rightEmpty = isEmpty(b)
      if (leftEmpty || rightEmpty) {
        if (leftEmpty && rightEmpty) continue
        return leftEmpty ? 1 : -1
      }

      const comparison = level.column.compare ? level.column.compare(a, b) : compareUnknown(a, b)
      if (comparison !== 0) return level.sort.direction === "asc" ? comparison : -comparison
    }
    return 0
  })

  return decorated.map((entry) => entry.row)
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
