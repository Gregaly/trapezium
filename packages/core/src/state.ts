/**
 * Table state, and every transition over it.
 *
 * Pure functions from state to state. No component owns any of this, which is
 * what lets the same table be uncontrolled, controlled, driven from a URL, or
 * restored from a saved view without any of those being a special case.
 *
 * One invariant runs through the whole file: **anything that changes which rows
 * match resets the page to one.** Filtering while on page seven and landing on
 * an empty page is the single most common bug in hand-rolled tables.
 */

import type {
  ColumnFilter,
  Density,
  Pin,
  Sort,
  SortDirection,
  TableState,
  PartialTableState,
} from "./types.js"
import { withFilter, withoutFilter } from "./filter.js"

/** What a table starts as before anything is configured or remembered. */
export const DEFAULT_STATE: TableState = {
  sort: [],
  filters: [],
  match: "all",
  search: "",
  page: 1,
  pageSize: 25,
  selection: [],
  order: [],
  hidden: [],
  widths: {},
  pinned: {},
  density: "normal",
}

/** Fills in everything a caller left out. */
export function createState(partial?: PartialTableState): TableState {
  return { ...DEFAULT_STATE, ...partial }
}

/**
 * Cycles a column's sort: ascending, descending, none.
 *
 * Three states rather than two, because a user who sorted by accident needs a
 * way back to the order the data arrived in, and clicking the same header again
 * is where everyone looks for it.
 *
 * `additive` appends a level instead of replacing — shift-click, in most UIs.
 */
export function toggleSort(state: TableState, key: string, additive = false): TableState {
  const existing = state.sort.find((sort) => sort.key === key)
  const others = state.sort.filter((sort) => sort.key !== key)

  const next: Sort[] = !existing
    ? [{ key, direction: "asc" }]
    : existing.direction === "asc"
      ? [{ key, direction: "desc" }]
      : []

  return { ...state, sort: additive ? [...others, ...next] : next, page: 1 }
}

/** Sets one column's sort explicitly, replacing whatever was there. */
export function setSort(state: TableState, key: string, direction: SortDirection): TableState {
  return { ...state, sort: [{ key, direction }], page: 1 }
}

export function clearSort(state: TableState): TableState {
  return { ...state, sort: [], page: 1 }
}

export function setFilter(state: TableState, filter: ColumnFilter): TableState {
  return { ...state, filters: withFilter(state.filters, filter), page: 1 }
}

/** Appends a filter, so a column can carry more than one condition. */
export function addFilter(state: TableState, filter: ColumnFilter): TableState {
  return { ...state, filters: [...state.filters, filter], page: 1 }
}

export function removeFilter(state: TableState, key: string): TableState {
  return { ...state, filters: withoutFilter(state.filters, key), page: 1 }
}

/** Removes one filter by position, for a UI showing several on the same column. */
export function removeFilterAt(state: TableState, index: number): TableState {
  return { ...state, filters: state.filters.filter((_, at) => at !== index), page: 1 }
}

export function clearFilters(state: TableState): TableState {
  return { ...state, filters: [], page: 1 }
}

export function setMatch(state: TableState, match: "all" | "any"): TableState {
  return { ...state, match, page: 1 }
}

export function setSearch(state: TableState, search: string): TableState {
  return { ...state, search, page: 1 }
}

export function setPage(state: TableState, page: number): TableState {
  return { ...state, page: Math.max(1, Math.floor(page)) }
}

/**
 * Changes the page size and returns to the first page.
 *
 * Trying to keep the user's position across a size change sounds considerate
 * and produces nonsense — row 130 is on page 6 at 25 a page and page 2 at 100,
 * and neither is where they were looking.
 */
export function setPageSize(state: TableState, pageSize: number): TableState {
  return { ...state, pageSize: Math.max(1, Math.floor(pageSize)), page: 1 }
}

export function setDensity(state: TableState, density: Density): TableState {
  return { ...state, density }
}

/** Adds or removes one row from the selection. */
export function toggleSelection(state: TableState, id: string, single = false): TableState {
  if (single) {
    return { ...state, selection: state.selection.includes(id) ? [] : [id] }
  }

  return {
    ...state,
    selection: state.selection.includes(id)
      ? state.selection.filter((entry) => entry !== id)
      : [...state.selection, id],
  }
}

/**
 * Selects or clears a set of ids, leaving anything outside it alone.
 *
 * Called with the ids on the current page, which is what a header checkbox
 * means: select what I can see, not everything that exists behind the
 * pagination.
 */
export function setSelected(state: TableState, ids: readonly string[], selected: boolean): TableState {
  const set = new Set(state.selection)
  for (const id of ids) {
    if (selected) set.add(id)
    else set.delete(id)
  }
  return { ...state, selection: [...set] }
}

export function clearSelection(state: TableState): TableState {
  return { ...state, selection: [] }
}

export function hideColumn(state: TableState, key: string): TableState {
  return state.hidden.includes(key) ? state : { ...state, hidden: [...state.hidden, key] }
}

export function showColumn(state: TableState, key: string): TableState {
  return { ...state, hidden: state.hidden.filter((entry) => entry !== key) }
}

export function toggleColumn(state: TableState, key: string): TableState {
  return state.hidden.includes(key) ? showColumn(state, key) : hideColumn(state, key)
}

/** Records an explicit column order, which is what a drag or a move produces. */
export function setOrder(state: TableState, order: readonly string[]): TableState {
  return { ...state, order: [...order] }
}

export function setWidth(state: TableState, key: string, width: number): TableState {
  return { ...state, widths: { ...state.widths, [key]: Math.max(40, Math.round(width)) } }
}

/** Forgets a dragged width, so the column goes back to sizing itself. */
export function clearWidth(state: TableState, key: string): TableState {
  const widths = { ...state.widths }
  delete widths[key]
  return { ...state, widths }
}

export function setPin(state: TableState, key: string, pin: Pin | undefined): TableState {
  const pinned = { ...state.pinned }
  if (pin) pinned[key] = pin
  else delete pinned[key]
  return { ...state, pinned }
}

export function togglePin(state: TableState, key: string, pin: Pin = "start"): TableState {
  return setPin(state, key, state.pinned[key] === pin ? undefined : pin)
}

/** Everything that affects which rows are shown, cleared in one go. */
export function resetView(state: TableState): TableState {
  return { ...state, filters: [], search: "", sort: [], page: 1 }
}

/** True when the user has narrowed the data in any way. */
export function isFiltering(state: TableState): boolean {
  return state.filters.length > 0 || state.search.trim() !== ""
}
