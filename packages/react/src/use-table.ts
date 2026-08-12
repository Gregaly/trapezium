import { useCallback, useMemo, useRef, useState } from "react"
import {
  DEFAULT_FORMAT,
  DEFAULT_STATE,
  createTypeRegistry,
  defaultTypeRegistry,
  getRows,
  resolveColumns,
  resolveRowId,
  type FormatContext,
  type PaginationOptions,
  type PartialTableState,
  type TableState,
  type AnyRow,
} from "@trapezium/core"

import type { TableColumn, TableProps } from "./types.js"

/**
 * The table, without any markup.
 *
 * `<Table>` is this hook plus a renderer, and both are exported: use the
 * component to get the whole thing, use the hook when you want Trapezium's
 * model and your own DOM.
 *
 * Everything here is computed during render — no effects, no timers, nothing
 * that only runs in a browser — which is what makes the first server-rendered
 * paint identical to what the client would produce.
 */
export function useTable<TRow extends AnyRow>(props: TableProps<TRow>) {
  const {
    data,
    columns: columnInput,
    state: controlled,
    defaultState,
    onStateChange,
    server = false,
    total,
    getRowId,
    types: customTypes,
    format: formatOverrides,
  } = props

  const pagination = normalisePagination(props.pagination)

  /*
    An uncontrolled table still needs somewhere to keep state, and a controlled
    one still needs somewhere to keep the parts the caller did not control.
    Holding both here means the component never branches on which mode it is
    in — it reads `state` and calls `update`, and the difference is one merge.
  */
  const [internal, setInternal] = useState<TableState>(() => ({
    ...DEFAULT_STATE,
    ...(pagination ? { pageSize: pagination.pageSize } : {}),
    ...defaultState,
    ...controlled,
  }))

  const state: TableState = useMemo(
    () => ({ ...internal, ...controlled, ...(props.density ? { density: props.density } : {}) }),
    [internal, controlled, props.density],
  )

  /*
    The latest state, readable synchronously from an event handler. Two
    controls changed in the same tick — a filter applied while a debounce was
    pending — would otherwise each build their next state from the render's
    stale snapshot, and the second would undo the first.
  */
  const latest = useRef(state)
  latest.current = state

  const update = useCallback(
    (next: TableState | ((current: TableState) => TableState)) => {
      const resolved = typeof next === "function" ? next(latest.current) : next
      latest.current = resolved
      setInternal(resolved)
      onStateChange?.(resolved)
    },
    [onStateChange],
  )

  /** Applies part of the state, leaving the rest alone. */
  const patch = useCallback(
    (partial: PartialTableState) => update((current) => ({ ...current, ...partial })),
    [update],
  )

  const types = useMemo(
    () => (customTypes ? createTypeRegistry(customTypes) : defaultTypeRegistry),
    [customTypes],
  )

  const format: FormatContext = useMemo(
    () => ({ ...DEFAULT_FORMAT, ...formatOverrides }),
    [formatOverrides],
  )

  const { visible, hidden, all } = useMemo(
    () =>
      resolveColumns<TRow, React.ReactNode>({
        columns: columnInput,
        rows: data,
        state,
        types,
        resizable: props.resizable,
        reorderable: props.reorderable,
      }),
    [columnInput, data, state, types, props.resizable, props.reorderable],
  )

  // Append modes keep every page loaded so far on screen rather than replacing
  // one with the next.
  const accumulate = pagination?.mode === "infinite" || pagination?.mode === "loadMore"

  const result = useMemo(
    () =>
      getRows<TRow, React.ReactNode>({
        rows: data,
        columns: visible,
        state: pagination ? state : { ...state, pageSize: 0 },
        types,
        format,
        server,
        total,
        accumulate,
      }),
    [data, visible, state, types, format, server, total, accumulate, pagination],
  )

  const rowIds = useMemo(
    () => result.rows.map((row, index) => resolveRowId(row, index, getRowId)),
    [result.rows, getRowId],
  )

  const selection = useMemo(() => new Set(state.selection), [state.selection])

  return {
    /** The rows to render, after everything has been applied. */
    rows: result.rows,
    /** Ids for those rows, in the same order. */
    rowIds,
    /** Matching rows across every page. */
    total: result.total,
    pageCount: result.pageCount,
    /** True when filters or search are hiding rows that exist. */
    filtered: result.filtered,

    columns: visible as TableColumn<TRow>[],
    hiddenColumns: hidden as TableColumn<TRow>[],
    allColumns: all as TableColumn<TRow>[],

    state,
    update,
    patch,
    types,
    format,
    pagination,
    selection,
    server,
  }
}

export type TableInstance<TRow extends AnyRow = AnyRow> = ReturnType<typeof useTable<TRow>>

/** `true` means numbered pages of 25; `false` means every row on one page. */
export function normalisePagination(
  option: TableProps<AnyRow>["pagination"],
): Required<Omit<PaginationOptions, "pageSizeOptions">> & { pageSizeOptions?: number[] } | undefined {
  if (option === false) return undefined

  const given = option === true || option === undefined ? {} : option
  return {
    mode: given.mode ?? "pages",
    pageSize: given.pageSize ?? DEFAULT_STATE.pageSize,
    siblings: given.siblings ?? 1,
    pageSizeOptions: given.pageSizeOptions,
  }
}
