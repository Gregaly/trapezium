/**
 * Table state, in a URL.
 *
 * This is what makes a view shareable, the back button work, and a
 * server-rendered table correct on its first paint — the server reads the same
 * query string the user's controls write, so there is no state to rehydrate and
 * nothing to correct after the page appears.
 *
 * The encoding is compact and readable rather than base64 JSON:
 * `?sort=name:asc&f=status:eq:active&page=2` is something a person can
 * understand in a shared link and edit by hand, and it keeps URLs short enough
 * to survive being pasted into a chat window.
 */

import type {
  ColumnFilter,
  Density,
  FilterOperator,
  FilterValue,
  Pin,
  Sort,
  TableState,
  PartialTableState,
} from "./types.js"
import { DEFAULT_STATE } from "./state.js"
import { normaliseFilter } from "./filter.js"

/** Separates one entry from the next within a parameter. */
const BETWEEN = "~"
/** Separates the parts of one entry. */
const WITHIN = ":"
/** Separates the members of a list. */
const LIST = ","

/** Which piece of state each parameter carries. */
export const URL_KEYS = {
  sort: "sort",
  filters: "f",
  match: "match",
  search: "q",
  page: "page",
  pageSize: "size",
  columns: "cols",
  pinned: "pin",
  density: "d",
  selection: "sel",
  widths: "w",
} as const

export type UrlStateKey = keyof typeof URL_KEYS

/**
 * What goes in the URL by default.
 *
 * Selection and widths are left out: a selection can be thousands of ids long
 * and means nothing to whoever receives the link, and a dragged width is a
 * local preference rather than part of the view. Both can be opted into.
 */
export const DEFAULT_URL_KEYS: UrlStateKey[] = [
  "sort",
  "filters",
  "match",
  "search",
  "page",
  "pageSize",
  "columns",
  "pinned",
  "density",
]

export type UrlOptions = {
  /** Which parts of the state to carry. Defaults to everything but selection and widths. */
  include?: UrlStateKey[]
  /**
   * The table's own defaults, where they differ from the library's.
   *
   * A table showing fifteen rows a page has `pageSize: 15` as its resting
   * state, not twenty-five: reading a URL with no size must give fifteen, and
   * writing a URL for fifteen must write nothing. Pass the same object to
   * every call — `stateFromUrl`, `stateToQueryString`, `applyStateToUrl` — so
   * the two directions agree.
   */
  defaults?: PartialTableState
  /**
   * Prefix for every parameter, so two tables can share a page without
   * fighting over `sort`.
   */
  prefix?: string
}

function name(key: UrlStateKey, options?: UrlOptions): string {
  return `${options?.prefix ?? ""}${URL_KEYS[key]}`
}

/**
 * Encodes one value.
 *
 * Percent-encoded, so a value containing a separator cannot silently split the
 * filter it belongs to — the one failure mode of a scheme like this, and the
 * kind that produces a wrong result set rather than an error. `~` is escaped by
 * hand because `encodeURIComponent` considers it unreserved and leaves it be.
 */
function encodeValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(encodeValue).join(LIST)
  return encodeURIComponent(String(value ?? "")).replace(/~/g, "%7E")
}

function decodeValue(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    // A hand-edited URL can contain a stray `%`. Take it literally rather than
    // throwing a page away over it.
    return value
  }
}

/**
 * Writes state into search parameters.
 *
 * Only what differs from the defaults is written, so an untouched table has a
 * clean URL and a shared link contains exactly what the sender changed.
 */
export function stateToSearchParams(
  state: PartialTableState,
  options: UrlOptions = {},
  into: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  const include = new Set(options.include ?? DEFAULT_URL_KEYS)
  const resting = { ...DEFAULT_STATE, ...options.defaults }
  const params = into

  const write = (key: UrlStateKey, value: string | undefined) => {
    const parameter = name(key, options)
    if (value === undefined || value === "") params.delete(parameter)
    else params.set(parameter, value)
  }

  if (include.has("sort")) {
    write("sort", state.sort?.length ? state.sort.map((sort) => `${sort.key}${WITHIN}${sort.direction}`).join(LIST) : undefined)
  }

  if (include.has("filters")) {
    write("filters", state.filters?.length ? encodeFilters(state.filters) : undefined)
  }

  if (include.has("match")) {
    write("match", state.match && state.match !== resting.match ? state.match : undefined)
  }

  if (include.has("search")) {
    write("search", state.search?.trim() ? state.search : undefined)
  }

  if (include.has("page")) {
    write("page", state.page && state.page > 1 ? String(state.page) : undefined)
  }

  if (include.has("pageSize")) {
    write("pageSize", state.pageSize && state.pageSize !== resting.pageSize ? String(state.pageSize) : undefined)
  }

  if (include.has("columns")) {
    const order = state.order ?? []
    const hidden = state.hidden ?? []
    write("columns", order.length || hidden.length ? `${order.join(LIST)}${BETWEEN}${hidden.join(LIST)}` : undefined)
  }

  if (include.has("pinned") && state.pinned) {
    const start = Object.entries(state.pinned).filter(([, pin]) => pin === "start").map(([key]) => key)
    const end = Object.entries(state.pinned).filter(([, pin]) => pin === "end").map(([key]) => key)
    write("pinned", start.length || end.length ? `${start.join(LIST)}${BETWEEN}${end.join(LIST)}` : undefined)
  }

  if (include.has("density")) {
    write("density", state.density && state.density !== resting.density ? state.density : undefined)
  }

  if (include.has("selection")) {
    write("selection", state.selection?.length ? state.selection.map(encodeValue).join(LIST) : undefined)
  }

  if (include.has("widths") && state.widths) {
    const widths = Object.entries(state.widths).map(([key, width]) => `${key}${WITHIN}${width}`)
    write("widths", widths.length ? widths.join(LIST) : undefined)
  }

  return params
}

/** The same thing as a query string, for building an `href`. */
export function stateToQueryString(state: PartialTableState, options?: UrlOptions): string {
  return stateToSearchParams(state, options).toString()
}

/**
 * Reads state out of search parameters.
 *
 * Everything here is untrusted — a URL is typed by people and generated by
 * other systems — so anything malformed is dropped and the default is used
 * instead. A bad link shows the default view; it never shows an error.
 */
export function stateFromSearchParams(
  input: URLSearchParams | Record<string, string | string[] | undefined> | string,
  options: UrlOptions = {},
): PartialTableState {
  const params = toSearchParams(input)
  const include = new Set(options.include ?? DEFAULT_URL_KEYS)
  const state: PartialTableState = {}
  const read = (key: UrlStateKey) => (include.has(key) ? params.get(name(key, options)) : null)

  const sort = read("sort")
  if (sort) state.sort = decodeSort(sort)

  const filters = read("filters")
  if (filters) state.filters = decodeFilters(filters)

  const match = read("match")
  if (match === "any" || match === "all") state.match = match

  const search = read("search")
  if (search !== null) state.search = search

  const page = read("page")
  if (page !== null) {
    const parsed = Number.parseInt(page, 10)
    if (Number.isFinite(parsed) && parsed > 0) state.page = parsed
  }

  const pageSize = read("pageSize")
  if (pageSize !== null) {
    const parsed = Number.parseInt(pageSize, 10)
    if (Number.isFinite(parsed) && parsed > 0) state.pageSize = parsed
  }

  const columns = read("columns")
  if (columns !== null) {
    const [order = "", hidden = ""] = columns.split(BETWEEN)
    state.order = splitList(order)
    state.hidden = splitList(hidden)
  }

  const pinned = read("pinned")
  if (pinned !== null) {
    const [start = "", end = ""] = pinned.split(BETWEEN)
    const map: Record<string, Pin> = {}
    for (const key of splitList(start)) map[key] = "start"
    for (const key of splitList(end)) map[key] = "end"
    state.pinned = map
  }

  const density = read("density")
  if (density === "compact" || density === "normal" || density === "relaxed") {
    state.density = density as Density
  }

  const selection = read("selection")
  if (selection !== null) state.selection = splitList(selection).map(decodeValue)

  const widths = read("widths")
  if (widths !== null) {
    const map: Record<string, number> = {}
    for (const entry of splitList(widths)) {
      const [key, width] = entry.split(WITHIN)
      const parsed = Number.parseInt(width ?? "", 10)
      if (key && Number.isFinite(parsed)) map[key] = parsed
    }
    state.widths = map
  }

  return state
}

/** Accepts whatever shape a framework hands over for a query string. */
function toSearchParams(
  input: URLSearchParams | Record<string, string | string[] | undefined> | string,
): URLSearchParams {
  if (typeof input === "string") return new URLSearchParams(input)
  if (input instanceof URLSearchParams) return input

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue
    // Next.js hands over an array when a parameter appears twice. The last one
    // wins, which is what a browser does with a form.
    params.set(key, Array.isArray(value) ? (value[value.length - 1] ?? "") : value)
  }
  return params
}

export function encodeFilters(filters: readonly ColumnFilter[]): string {
  return filters
    .map((filter) => {
      const parts = [filter.key, filter.operator]
      if (filter.operator !== "empty" && filter.operator !== "notEmpty") {
        parts.push(encodeValue(filter.value))
      }
      return parts.join(WITHIN)
    })
    .join(BETWEEN)
}

/**
 * Filters come back as text, never as guessed types.
 *
 * A URL cannot tell "9" the string from 9 the number, and guessing gets it
 * wrong in both directions — a postcode of "0800" becomes 800. There is no need
 * to guess: the column's type is the authority, and every comparison
 * normalises through it before anything is compared.
 */
export function decodeFilters(value: string): ColumnFilter[] {
  return value
    .split(BETWEEN)
    .filter(Boolean)
    .map((entry) => {
      const [key, operator, rawValue] = entry.split(WITHIN)
      if (!key || !operator) return undefined

      const filter: ColumnFilter = { key, operator: operator as FilterOperator }
      if (rawValue !== undefined) filter.value = decodeFilterValue(operator, rawValue)
      return normaliseFilter(filter)
    })
    .filter((filter): filter is ColumnFilter => filter !== undefined)
}

function decodeFilterValue(operator: string, raw: string): FilterValue {
  const isList = operator === "in" || operator === "notIn" || operator === "between"
  if (!isList) return decodeValue(raw)
  return raw.split(LIST).map(decodeValue)
}

function decodeSort(value: string): Sort[] {
  return value
    .split(LIST)
    .filter(Boolean)
    .map((entry) => {
      const [key, direction] = entry.split(WITHIN)
      if (!key) return undefined
      return { key, direction: direction === "desc" ? "desc" : "asc" } satisfies Sort
    })
    .filter((sort): sort is Sort => sort !== undefined)
}

function splitList(value: string): string[] {
  return value ? value.split(LIST).filter(Boolean) : []
}

/**
 * Merges table state into an existing URL, leaving every other parameter alone.
 *
 * A table lives on a page that has its own query string — a tab, a date range,
 * a referrer — and clobbering it is how a "share this view" link loses half the
 * view.
 */
export function applyStateToUrl(
  url: string,
  state: PartialTableState,
  options: UrlOptions = {},
): string {
  const [path = "", query = ""] = url.split("?")
  const params = new URLSearchParams(query)
  stateToSearchParams(state, options, params)
  const search = params.toString()
  return search ? `${path}?${search}` : path
}

/**
 * The part of a state the URL carries, with defaults filled in — what to hand a
 * table as its controlled `state` when the URL is the source of truth.
 *
 * A controlled `state` controls exactly the keys it has. Pass the whole state
 * read from a URL and the keys the URL never carries — selection and widths,
 * by default — are controlled too, pinned to their defaults, and every
 * checkbox and every dragged column edge snaps straight back. This keeps the
 * URL's keys and leaves the rest to the table.
 *
 * ```tsx
 * <Table state={pickUrlState(state)} onStateChange={(next) => router.push(applyStateToUrl(pathname, next))} />
 * ```
 */
export function pickUrlState(state: TableState, options: UrlOptions = {}): PartialTableState {
  const include = options.include ?? DEFAULT_URL_KEYS
  const picked: PartialTableState = {}

  for (const key of include) {
    if (key === "columns") {
      picked.order = state.order
      picked.hidden = state.hidden
    } else if (key === "sort") picked.sort = state.sort
    else if (key === "filters") picked.filters = state.filters
    else if (key === "match") picked.match = state.match
    else if (key === "search") picked.search = state.search
    else if (key === "page") picked.page = state.page
    else if (key === "pageSize") picked.pageSize = state.pageSize
    else if (key === "pinned") picked.pinned = state.pinned
    else if (key === "density") picked.density = state.density
    else if (key === "selection") picked.selection = state.selection
    else if (key === "widths") picked.widths = state.widths
  }

  return picked
}

/** Full state from a URL, with defaults filled in — what a server page wants. */
export function stateFromUrl(
  input: URLSearchParams | Record<string, string | string[] | undefined> | string,
  options: UrlOptions = {},
): TableState {
  return { ...DEFAULT_STATE, ...options.defaults, ...stateFromSearchParams(input, options) }
}
