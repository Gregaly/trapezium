import type { ResolvedColumn, ResolvedSorting, Sort, SortInput } from "./types.js"

/**
 * Sorting, read the same way by every adapter.
 *
 * A caller writes `sortable`, `sortable={false}` or the options; the adapters
 * need one shape with every default decided. Doing that here, once, is what
 * keeps four adapters agreeing about what `true` means.
 */

/** Used for "no sort", so a table that never names one is always handed the same array. */
const NO_SORT: readonly Sort[] = []

/**
 * Normalises whatever the caller passed, or returns `undefined` when sorting
 * is off altogether.
 */
export function resolveSorting(option: SortInput | undefined): ResolvedSorting | undefined {
  if (option === false) return undefined

  const given = option === true || option === undefined ? {} : option
  const reset = given.reset ?? true

  return {
    multiple: given.multiple ?? true,
    reset: reset === false ? undefined : reset === true ? NO_SORT : reset,
  }
}

/** Whether two sorts order rows the same way: the same levels, in the same order. */
export function sortsEqual(a: readonly Sort[], b: readonly Sort[]): boolean {
  if (a.length !== b.length) return false
  return a.every((level, index) => level.key === b[index]?.key && level.direction === b[index]?.direction)
}

/**
 * Whether the reset control has anything to do.
 *
 * False while the table is in its resting sort, which is what keeps the
 * control out of the way until the user has actually changed something.
 */
export function canResetSort(sort: readonly Sort[], sorting: ResolvedSorting | undefined): boolean {
  if (!sorting?.reset) return false
  return !sortsEqual(sort, sorting.reset)
}

/**
 * The levels of a sort that a table's headers can speak for.
 *
 * State is the caller's, and a link can say anything: a level on a column that
 * has since been hidden, one on a column that cannot be sorted, the same
 * column twice. None of those order the rows — the pipeline skips them — so
 * none of them should be counted when a header says which level it is. Left
 * in, the one sorted column on screen announces itself as level two of a sort
 * nobody can see the first level of.
 *
 * `columns` are the visible ones. The order of the levels is kept.
 */
export function sortLevels<TRow, TNode>(
  sort: readonly Sort[],
  columns: readonly ResolvedColumn<TRow, TNode>[],
): Sort[] {
  const sortable = new Set(columns.filter((column) => column.sortable).map((column) => column.key))
  const seen = new Set<string>()

  return sort.filter((level) => {
    if (!sortable.has(level.key) || seen.has(level.key)) return false
    seen.add(level.key)
    return true
  })
}

/**
 * A column's place in a sort of several levels, counted from one.
 *
 * `undefined` when the column is not sorted — and when it is the only level,
 * because a lone "1" beside the only arrow on the table tells nobody anything.
 */
export function sortPriority(sort: readonly Sort[], key: string): number | undefined {
  if (sort.length < 2) return undefined
  const index = sort.findIndex((level) => level.key === key)
  return index === -1 ? undefined : index + 1
}
