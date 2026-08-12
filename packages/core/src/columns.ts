/**
 * Turning what the caller wrote into what the table renders.
 *
 * Column definitions are sparse by design — often just a key — so this is where
 * every default is applied: the header, the type, the accessor, the alignment,
 * the filter control, the icon. Renderers receive columns with nothing left
 * optional, so the defaulting rules exist in exactly one place.
 *
 * Pure, so the ordering, hiding and pinning rules can be tested exhaustively
 * without a browser.
 */

import { inferType } from "./infer.js"
import type { TypeDef, TypeRegistry } from "./registry.js"
import type {
  AnyRow,
  ColumnDef,
  FilterKind,
  FilterOperator,
  Pin,
  ResolvedColumn,
  TableState,
} from "./types.js"
import { getPath, humanise } from "./util.js"

/** How many rows are sampled when a column's type has to be inferred. */
const SAMPLE_SIZE = 50

/** A column, or just the key of one. */
export type ColumnInput<TRow = AnyRow, TNode = unknown> = ColumnDef<TRow, TNode> | (keyof TRow & string) | string

export type ResolveColumnsOptions<TRow, TNode> = {
  columns?: readonly ColumnInput<TRow, TNode>[]
  rows: readonly TRow[]
  state: TableState
  types: TypeRegistry
  /** Applied to every column that does not set the property itself. */
  defaults?: Partial<ColumnDef<TRow, TNode>>
  /** False switches off resizing for the whole table, whatever a column says. */
  resizable?: boolean
  /** False switches off reordering for the whole table, whatever a column says. */
  reorderable?: boolean
}

export type ResolvedColumns<TRow, TNode> = {
  /** Ordered, pinned and visible — what the table body renders. */
  visible: ResolvedColumn<TRow, TNode>[]
  /** Hidden, for the column menu to offer back. */
  hidden: ResolvedColumn<TRow, TNode>[]
  /** Everything, in resolved order, whether shown or not. */
  all: ResolvedColumn<TRow, TNode>[]
}

/**
 * Resolves the caller's columns against the data and the current state.
 *
 * With no columns given, one is inferred per key in the data — which is what
 * makes `<Table data={rows} />` a complete usage rather than a starting point.
 */
export function resolveColumns<TRow extends AnyRow, TNode>(
  options: ResolveColumnsOptions<TRow, TNode>,
): ResolvedColumns<TRow, TNode> {
  const { rows, state, types } = options
  const sample = rows.slice(0, SAMPLE_SIZE)

  const definitions = normaliseInput(options.columns, sample)

  const resolved = definitions.map((definition) =>
    resolveColumn(definition, sample, state, types, options),
  )

  const ordered = applyOrder(resolved, state.order)
  const hiddenKeys = new Set(state.hidden)

  const visible = ordered.filter(
    (column) => !hiddenKeys.has(column.key) && !(column.hidden && !state.order.includes(column.key)),
  )
  const hidden = ordered.filter((column) => !visible.includes(column))

  const pinned = applyPins(visible, state.pinned)
  pinned.forEach((column, index) => {
    column.index = index
  })

  return { visible: pinned, hidden, all: ordered }
}

/**
 * Accepts a list of definitions, a list of keys, or nothing at all.
 *
 * `columns={['name', 'email']}` is the shorthand people reach for when they
 * want to choose and order fields but have nothing to say about how they
 * render, and supporting it costs four lines.
 */
function normaliseInput<TRow extends AnyRow, TNode>(
  columns: readonly ColumnInput<TRow, TNode>[] | undefined,
  sample: readonly TRow[],
): ColumnDef<TRow, TNode>[] {
  if (columns && columns.length > 0) {
    return columns.map((column) => (typeof column === "string" ? { key: column } : column))
  }

  const keys: string[] = []
  const seen = new Set<string>()
  for (const row of sample) {
    if (row === null || typeof row !== "object") continue
    for (const key of Object.keys(row)) {
      if (seen.has(key) || key.startsWith("_")) continue
      seen.add(key)
      keys.push(key)
    }
  }

  return keys.map((key) => ({ key }) as ColumnDef<TRow, TNode>)
}

function resolveColumn<TRow extends AnyRow, TNode>(
  definition: ColumnDef<TRow, TNode>,
  sample: readonly TRow[],
  state: TableState,
  types: TypeRegistry,
  options: ResolveColumnsOptions<TRow, TNode>,
): ResolvedColumn<TRow, TNode> {
  const merged = { ...options.defaults, ...definition }
  const key = String(merged.key)
  const accessor = merged.accessor ?? ((row: TRow) => getPath(row, key))

  const typeName = merged.type ?? inferOwnType(key, accessor, sample, types)
  const type = types.get(typeName)

  const filter = resolveFilter(merged.filter, type)

  return {
    ...merged,
    key,
    header: merged.header ?? humanise(key),
    type: type.name,
    accessor,
    align: merged.align ?? type.align ?? "start",
    // Sortable unless the type says otherwise. A custom renderer does not
    // change this: the column still has a value underneath, and that value is
    // what gets ordered.
    sortable: merged.sortable ?? type.sortable ?? true,
    searchable: merged.searchable ?? type.searchable ?? true,
    exportable: merged.exportable ?? true,
    mono: merged.mono ?? type.mono ?? false,
    filterKind: filter.kind,
    operators: filter.operators,
    // A column with no header has nothing for an icon to label, and an actions
    // column showing a stray "text" glyph looks like a mistake.
    icon: merged.icon ?? (merged.header === "" ? false : (type.icon ?? false)),
    resizable: merged.resizable ?? options.resizable ?? true,
    reorderable: merged.reorderable ?? options.reorderable ?? true,
    width: state.widths[key] ?? merged.width,
    pin: state.pinned[key] ?? merged.pin,
    index: 0,
  }
}

/**
 * The type of a column whose definition did not name one.
 *
 * A column with a custom renderer and no data behind it stays `text` rather
 * than being inferred from whatever `undefined` looks like.
 */
function inferOwnType<TRow extends AnyRow>(
  key: string,
  accessor: (row: TRow) => unknown,
  sample: readonly TRow[],
  types: TypeRegistry,
): string {
  const values = sample.map(accessor)
  const inferred = inferType(key, values)
  return types.has(inferred) ? inferred : "text"
}

function resolveFilter(
  option: ColumnDef["filter"],
  type: TypeDef,
): { kind: FilterKind; operators: FilterOperator[] } {
  const operators = [...(type.operators ?? ["contains", "eq", "empty", "notEmpty"])]

  if (option === undefined || option === true) {
    return { kind: type.filter ?? "text", operators }
  }
  if (option === false) return { kind: "none", operators }
  if (typeof option === "string") return { kind: option, operators }

  return {
    kind: option.kind ?? type.filter ?? "text",
    operators: option.operators ?? operators,
  }
}

/**
 * Applies a saved order.
 *
 * Columns the order does not mention still appear, after the ones it does — a
 * field added to the data after somebody arranged their view should show up,
 * not silently vanish because it was not in a list written before it existed.
 */
function applyOrder<TRow, TNode>(
  columns: ResolvedColumn<TRow, TNode>[],
  order: readonly string[],
): ResolvedColumn<TRow, TNode>[] {
  if (order.length === 0) return columns

  const byKey = new Map(columns.map((column) => [column.key, column]))
  const placed = new Set<string>()
  const ordered: ResolvedColumn<TRow, TNode>[] = []

  for (const key of order) {
    const column = byKey.get(key)
    if (column && !placed.has(key)) {
      ordered.push(column)
      placed.add(key)
    }
  }

  for (const column of columns) {
    if (!placed.has(column.key)) ordered.push(column)
  }

  return ordered
}

/** Frozen columns lead and trail, whatever the order says. */
function applyPins<TRow, TNode>(
  columns: ResolvedColumn<TRow, TNode>[],
  pinned: Record<string, Pin>,
): ResolvedColumn<TRow, TNode>[] {
  const pin = (column: ResolvedColumn<TRow, TNode>) => pinned[column.key] ?? column.pin

  const start = columns.filter((column) => pin(column) === "start")
  const end = columns.filter((column) => pin(column) === "end")
  const middle = columns.filter((column) => pin(column) === undefined)

  return [...start, ...middle, ...end]
}

/** Moves a column one position among the visible ones. */
export function moveColumn(
  visibleKeys: readonly string[],
  key: string,
  direction: "left" | "right",
): string[] {
  const index = visibleKeys.indexOf(key)
  if (index === -1) return [...visibleKeys]

  const target = direction === "left" ? index - 1 : index + 1
  if (target < 0 || target >= visibleKeys.length) return [...visibleKeys]

  const next = [...visibleKeys]
  const [moved] = next.splice(index, 1)
  if (moved !== undefined) next.splice(target, 0, moved)
  return next
}

/** Places a column at an explicit position, for drag and drop. */
export function reorderColumn(
  visibleKeys: readonly string[],
  key: string,
  toIndex: number,
): string[] {
  const index = visibleKeys.indexOf(key)
  if (index === -1) return [...visibleKeys]

  const next = [...visibleKeys]
  const [moved] = next.splice(index, 1)
  if (moved !== undefined) next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, moved)
  return next
}

/** Drops references to columns that no longer exist, so state cannot accumulate junk. */
export function pruneState(state: TableState, keys: readonly string[]): TableState {
  const known = new Set(keys)
  const widths: Record<string, number> = {}
  for (const [key, width] of Object.entries(state.widths)) {
    if (known.has(key)) widths[key] = width
  }
  const pinned: Record<string, Pin> = {}
  for (const [key, pin] of Object.entries(state.pinned)) {
    if (known.has(key)) pinned[key] = pin
  }

  return {
    ...state,
    order: state.order.filter((key) => known.has(key)),
    hidden: state.hidden.filter((key) => known.has(key)),
    filters: state.filters.filter((filter) => known.has(filter.key)),
    sort: state.sort.filter((sort) => known.has(sort.key)),
    widths,
    pinned,
  }
}
