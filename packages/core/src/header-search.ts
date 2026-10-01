import type { HeaderSearchInput, ResolvedHeaderSearch } from "./types.js"

/**
 * Header search, read the same way by every adapter.
 *
 * The table-level option is a switch or a little configuration; the adapters
 * need both answers every time — whether columns are searchable by default,
 * and how long to wait after a keystroke. The wait is always decided, because
 * a column can opt in on its own while the table says nothing.
 */

/** The same pause the toolbar's search box takes, so the two feel like one control. */
export const HEADER_SEARCH_DEBOUNCE = 150

export function resolveHeaderSearch(option: HeaderSearchInput | undefined): ResolvedHeaderSearch {
  if (option === undefined || option === false) return { enabled: false, debounce: HEADER_SEARCH_DEBOUNCE }
  if (option === true) return { enabled: true, debounce: HEADER_SEARCH_DEBOUNCE }
  return { enabled: true, debounce: option.debounce ?? HEADER_SEARCH_DEBOUNCE }
}
