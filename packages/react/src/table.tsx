import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  formatWithType,
  copyText,
  downloadText,
  resolveSelection,
  rowsToExport,
  selectRange,
  selectableIds as selectableIdsOf,
  setSelected,
  toCsv,
  toDelimitedText,
  toSelectOptions,
  toggleSelection,
  type AnyRow,
  type SelectOption,
  type TableState,
} from "@trapezium/core"

import { createClasses } from "./classes.js"
import { TableContext } from "./context.js"
import { HeaderCell } from "./header-cell.js"
import { Icon } from "./icon.js"
import { InfiniteSentinel, Pagination } from "./pagination.js"
import { Row } from "./row.js"
import { Toolbar } from "./toolbar.js"
import type { SearchOptions, TableProps } from "./types.js"
import { useTable } from "./use-table.js"

/**
 * The table.
 *
 * ```tsx
 * <Table data={users} />
 * ```
 *
 * That is a complete usage: columns are inferred from the data, types from the
 * values, and sorting, searching and pagination work. Everything below is for
 * the cases where the default is not what you want.
 *
 * It renders a real `<table>` — real rows, real cells, real header semantics —
 * because that is what screen readers, keyboard navigation, browser find, print
 * and "copy as table" all rely on. A grid of divs is easier to style and worse
 * at every one of those.
 */
export function Table<TRow extends AnyRow>(props: TableProps<TRow>) {
  const {
    data,
    getRowId,
    loading,
    error,
    responsive = "scroll",
    stickyHeader = true,
    maxHeight,
    rowHeight = "fixed",
    rowHref,
    onRowClick,
    rowClassName,
    emptyState,
    emptyMessage = "Nothing to show",
    toolbar,
    appendRow,
    footer,
    caption,
    buildHref,
    linkComponent: Link,
    onNavigate,
    className,
    classNames,
    unstyled,
    theme,
  } = props

  const table = useTable(props)
  const { rows, matchedRows, rowIds, columns, hiddenColumns, state, update, types, format, pagination, total, serverSource } =
    table

  const classes = useMemo(() => createClasses(classNames, unstyled), [classNames, unstyled])

  /*
    Memoised because they are dependencies of effects and callbacks below. A
    fresh object every render would re-run the selection report and rebuild the
    header handlers on every keystroke in the search box.
  */
  const selection = useMemo(
    () => resolveSelection(props.selection, props.onSelectionChange),
    [props.selection, props.onSelectionChange],
  )

  const search = useMemo(() => normaliseSearch(props.search), [props.search])

  const features = useMemo(
    () => ({
      sortable: props.sortable !== false,
      filters: props.filters !== false,
      menu: props.columnMenu !== false,
      resizable: props.resizable !== false,
      reorderable: props.reorderable !== false,
    }),
    [props.sortable, props.filters, props.columnMenu, props.resizable, props.reorderable],
  )

  const visibleKeys = useMemo(() => columns.map((column) => column.key), [columns])

  /**
   * How a stored value reads on screen, for whichever column is asking.
   *
   * The set filter uses it so its choices match the cells — including for a
   * custom type, whose formatter is the only thing that knows that "blocker"
   * is shown as "Blocker".
   */
  const formatValue = useCallback(
    (column: (typeof columns)[number]) => (value: unknown) =>
      formatWithType(types.get(column.type), value, { ...format, ...column.formatOptions }),
    [types, format],
  )

  /*
    A set-filter column with nothing of its own asks the server, if the table
    was told how to ask. Bound per column and remembered by identity, so the
    panel fetches once and reopening it is free.
  */
  const distinctFor = useMemo(() => {
    const source = serverSource?.distinct
    if (!source) return undefined

    const bound = new Map<string, () => Promise<SelectOption[]>>()
    return (key: string) => {
      let provider = bound.get(key)
      if (!provider) {
        provider = async () => {
          const values = await source(key, latestState.current)
          return toSelectOptions(values)
        }
        bound.set(key, provider)
      }
      return provider
    }
  }, [serverSource])

  // Read when a provider actually runs, so a fetch reflects the filters in
  // force at that moment rather than the ones in force when it was bound.
  const latestState = useRef(state)
  latestState.current = state
  const columnCount = columns.length + (selection ? 1 : 0)

  /*
    Frozen columns need real pixel offsets, and only the browser knows how wide
    a column ended up. They are measured after layout and applied as custom
    properties, so the server and the first client render agree on the markup
    and the numbers arrive a frame later — rather than the two disagreeing and
    React throwing the tree away.
  */
  const headRef = useRef<HTMLTableSectionElement | null>(null)
  const [pinOffsets, setPinOffsets] = useState<Record<string, number>>({})

  // Marks the table while a column is being dragged, so it can show that
  // letting go outside will remove it.
  const [draggingColumn, setDraggingColumn] = useState(false)

  useLayoutEffect(() => {
    const head = headRef.current
    if (!head) return

    const cells = [...head.querySelectorAll<HTMLElement>("[data-pin]")]
    const next: Record<string, number> = {}

    let start = 0
    for (const cell of cells.filter((entry) => entry.dataset["pin"] === "start")) {
      next[cell.dataset["key"] ?? ""] = start
      start += cell.getBoundingClientRect().width
    }

    let end = 0
    for (const cell of cells.filter((entry) => entry.dataset["pin"] === "end").reverse()) {
      next[cell.dataset["key"] ?? ""] = end
      end += cell.getBoundingClientRect().width
    }

    setPinOffsets((current) => (shallowEqualNumbers(current, next) ? current : next))
  }, [columns, state.widths, state.density, rows.length])

  /*
    Both custom properties on one object so the memo has one identity to
    compare. A number for `rowHeight` is simply the token the whole stylesheet
    already sizes rows by, which is why it needs no rule of its own — and why
    it still respects a column that has been told to wrap.
  */
  /*
    A number is its own mode rather than only a token, because it wraps like
    `auto` does — the token alone could not say that.
  */
  const rowHeightMode = rowHeight === "fixed" ? undefined : typeof rowHeight === "number" ? "exact" : "auto"

  const rootStyle = useMemo(() => {
    const style: Record<string, string> = {}
    if (maxHeight !== undefined) {
      style["--tpz-max-height"] = typeof maxHeight === "number" ? `${String(maxHeight)}px` : maxHeight
    }
    if (typeof rowHeight === "number") style["--tpz-row-height"] = `${String(rowHeight)}px`
    return Object.keys(style).length > 0 ? (style as React.CSSProperties) : undefined
  }, [maxHeight, rowHeight])

  /*
    Worked out once for the table rather than per cell. The old form asked
    "is this the last pinned column?" inside every cell of every row, which
    walked the column list twice each time — quadratic in columns, multiplied
    by rows, on every render.
  */
  const pinEdges = useMemo(() => {
    const starts = columns.filter((column) => column.pin === "start")
    const ends = columns.filter((column) => column.pin === "end")
    const edges: Record<string, true> = {}
    const first = starts[starts.length - 1]?.key
    const last = ends[0]?.key
    if (first) edges[first] = true
    if (last) edges[last] = true
    return edges
  }, [columns])

  /* ── Selection ─────────────────────────────────────────────────────────── */

  const selectableIds = useMemo(
    () => selectableIdsOf(rows, rowIds, selection?.isSelectable),
    [rows, rowIds, selection],
  )

  const selectedOnPage = selectableIds.filter((id) => table.selection.has(id)).length
  const allSelected = selectableIds.length > 0 && selectedOnPage === selectableIds.length

  // Shift-click selects a range, which is the one selection gesture people
  // expect from a table and almost never get.
  const lastToggled = useRef<string | undefined>(undefined)

  /*
    Read through a ref so the handler itself never changes identity. It needs
    the current ids and the current `update`, and both of those change whenever
    a page is appended or the caller passes an inline `onStateChange` — which
    would hand every memoised row a new prop and undo the memo. An event
    handler is exactly the thing that can be read late instead: it runs on a
    click, long after the render that would have rebuilt it.
  */
  const handlers = useRef({ selectableIds, mode: selection?.mode, update })
  handlers.current = { selectableIds, mode: selection?.mode, update }

  const toggleRow = useCallback((id: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const { selectableIds: ids, mode, update: apply } = handlers.current
    // React's change event does not carry the modifier keys; the click
    // underneath it does.
    const native = event.nativeEvent
    const shift = "shiftKey" in native && native.shiftKey === true
    const anchor = lastToggled.current

    if (shift && anchor && mode !== "single") {
      // The range runs over the selectable rows only, so a disabled row
      // between two chosen ones is stepped over rather than swept up.
      apply((current) => selectRange(current, ids, anchor, id, !current.selection.includes(id)))
      return
    }

    lastToggled.current = id
    apply((current) => toggleSelection(current, id, mode === "single"))
  }, [])

  /*
    Same trick for the caller's row click: it is nearly always written inline
    at the call site, and a fresh function every render would be enough on its
    own to re-render every row in the table.
  */
  const clickRef = useRef(onRowClick)
  clickRef.current = onRowClick

  const handleRowClick = useCallback((row: TRow, event: React.MouseEvent) => {
    clickRef.current?.(row, event)
  }, [])

  /*
    Reported in an effect rather than from the handler: the selection can also
    change from outside — a controlled state, a cleared view, a URL — and a
    caller listening for it should hear about all of them, not only the clicks.
  */
  const reported = useRef<string>("")
  useEffect(() => {
    if (!selection?.onChange) return
    const key = state.selection.join(",")
    if (key === reported.current) return
    reported.current = key

    const byId = new Map(rows.map((row, index) => [rowIds[index]!, row]))
    selection.onChange(
      state.selection,
      state.selection.map((id) => byId.get(id)).filter((row): row is TRow => row !== undefined),
    )
  }, [state.selection, rows, rowIds, selection])

  /* ── Export ────────────────────────────────────────────────────────────── */

  const exportOptions = props.export === true ? {} : props.export || undefined

  /*
    Everything the filters and the search leave, not the page on screen. An
    export that hands back twenty-five of four hundred rows is not an export,
    and it is the sort of thing nobody notices until a spreadsheet is wrong.
  */
  const exportRows = exportOptions?.scope === "page" ? rows : matchedRows

  // Only worth saying when the caller has given it no way to do better.
  if (
    exportOptions &&
    props.server &&
    !exportOptions.fetchRows &&
    !exportOptions.onExport &&
    !serverSource?.all
  ) {
    warnAboutServerExport()
  }

  const exportControl = exportOptions
    ? {
        onDownload: () => {
          void (async () => {
            /*
              A selection wins over everything matched, for the file as for
              the clipboard. The selected rows are usually on hand; only when
              some are not — a server-side table whose selection spans pages —
              or when nothing is selected and the caller can see more than
              this page, are the caller's rows asked for.
            */
            const fetchRows = exportOptions.fetchRows ?? serverSource?.all
            const onHand = rowsToExport(exportRows, state.selection, getRowId)
            const rows =
              fetchRows && !onHand.complete
                ? rowsToExport(await fetchRows(state), state.selection, getRowId).rows
                : onHand.rows

            if (exportOptions.onExport) {
              exportOptions.onExport(state, rows)
              return
            }

            downloadText(
              toCsv(rows, { columns, types, format, getRowId }),
              `${exportOptions.filename ?? "table"}.csv`,
            )
          })()
        },
        onCopy:
          exportOptions.clipboard === false
            ? undefined
            : () => {
                // The selection when there is one, and only what is on hand:
                // the clipboard has to be written inside the click, so there
                // is no room to fetch.
                const selected = rowsToExport(exportRows, state.selection, getRowId).rows

                void copyText(toDelimitedText(selected, { columns, types, format, delimiter: "\t", getRowId }))
              },
      }
    : undefined

  /* ── Render ────────────────────────────────────────────────────────────── */

  const showEmpty = rows.length === 0 && !loading && !error

  return (
    <TableContext.Provider value={{ theme, density: state.density }}>
    <div
      className={classes("root", className)}
      data-theme={theme}
      data-density={state.density}
      data-responsive={responsive}
      data-sticky-header={stickyHeader ? "true" : undefined}
      data-loading={loading ? "true" : undefined}
      data-dragging-out={draggingColumn ? "true" : undefined}
      data-row-height={rowHeightMode}
      style={rootStyle}
    >
      <div className={classes("frame")}>
        <Toolbar
          state={state}
          update={update}
          columns={columns}
          hiddenColumns={hiddenColumns}
          total={total}
          selectedCount={state.selection.length}
          search={search}
          columnControl={props.columnControl !== false}
          densityControl={props.densityControl === true}
          exportControl={exportControl}
          extra={toolbar}
          className={classes("toolbar")}
          searchClassName={classes("search")}
        />

        <div className={classes("scroll")}>
          <table className={classes("table")} aria-label={props["aria-label"]}>
            {caption && <caption className="tpz-caption">{caption}</caption>}

            <thead className={classes("thead")} ref={headRef}>
              <tr className={classes("headerRow")}>
                {selection && (
                  <th
                    scope="col"
                    className="tpz-th tpz-select-cell"
                    data-pin="start"
                    data-key="__select"
                    style={{ left: pinOffsets["__select"] ?? 0 }}
                  >
                    {selection.mode === "multiple" && (
                      <input
                        type="checkbox"
                        className="tpz-checkbox"
                        checked={allSelected}
                        ref={(node) => {
                          if (node) node.indeterminate = selectedOnPage > 0 && !allSelected
                        }}
                        aria-label={allSelected ? "Clear selection" : "Select all rows on this page"}
                        onChange={() =>
                          update((current) => setSelected(current, selectableIds, !allSelected))
                        }
                      />
                    )}
                  </th>
                )}

                {columns.map((column) => (
                  <HeaderCell
                    key={column.key}
                    column={column}
                    state={state}
                    rows={data}
                    update={update}
                    visibleKeys={visibleKeys}
                    features={features}
                    buildHref={buildHref}
                    linkComponent={Link}
                    onNavigate={onNavigate}
                    pinOffset={pinOffsets[column.key]}
                    isPinEdge={isPinEdge(columns, column.key)}
                    theme={theme}
                    onDragStateChange={setDraggingColumn}
                    formatValue={formatValue(column)}
                    fetchOptions={column.filterOptions ? undefined : distinctFor?.(column.key)}
                    className={classes("headerCell", column.headerClassName)}
                    style={{ width: column.width, minWidth: column.minWidth, maxWidth: column.maxWidth }}
                  />
                ))}
              </tr>
            </thead>

            <tbody className={classes("tbody")}>
              {loading && rows.length === 0 && <SkeletonRows columns={columnCount} />}

              {error && (
                <tr>
                  <td colSpan={columnCount} className="tpz-td" data-wrap="true">
                    <div className={classes("empty")} data-tone="danger" role="alert">
                      <Icon name="warning" size={20} className="tpz-state-icon" />
                      {error}
                    </div>
                  </td>
                </tr>
              )}

              {showEmpty && (
                <tr>
                  <td colSpan={columnCount} className="tpz-td" data-wrap="true">
                    {emptyState ?? (
                      <div className={classes("empty")}>
                        <Icon name="empty" size={22} className="tpz-state-icon" />
                        {table.filtered ? "No rows match" : emptyMessage}
                      </div>
                    )}
                  </td>
                </tr>
              )}

              {rows.map((row, rowIndex) => {
                const id = rowIds[rowIndex]!

                /*
                  Resolved here rather than inside the row, so what the memo
                  compares is a string that changes when the class changes —
                  not the identity of a `rowClassName` written inline, which
                  changes every render and never means anything by it.
                */
                return (
                  <Row
                    key={id}
                    row={row}
                    id={id}
                    rowIndex={rowIndex}
                    columns={columns}
                    types={types}
                    format={format}
                    classes={classes}
                    className={rowClassName?.(row, rowIndex)}
                    href={rowHref?.(row)}
                    selected={table.selection.has(id)}
                    selectionMode={selection?.mode}
                    selectable={selection?.isSelectable ? selection.isSelectable(row, rowIndex) : true}
                    pinOffsets={pinOffsets}
                    pinEdges={pinEdges}
                    fit={rowHeightMode === "exact"}
                    onRowClick={onRowClick ? handleRowClick : undefined}
                    onToggle={toggleRow}
                    linkComponent={Link}
                  />
                )
              })}

              {appendRow && (
                <tr className={classes("row")}>
                  <td colSpan={columnCount} className="tpz-td">
                    {appendRow}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/*
            Inside the scroll area, after the last row — which is the only place
            a sentinel means "the user has reached the end".
          */}
          {pagination?.mode === "infinite" && (
            <InfiniteSentinel
              hasMore={state.page < table.pageCount}
              loading={loading}
              page={state.page}
              onMore={() => update((current) => ({ ...current, page: current.page + 1 }))}
            />
          )}
        </div>

        {footer && <div className={classes("footer")}>{footer}</div>}

        {pagination && (
          <Pagination
            mode={pagination.mode}
            state={state}
            update={update}
            total={total}
            pageCount={table.pageCount}
            shown={rows.length}
            pageSizeOptions={pagination.pageSizeOptions}
            siblings={pagination.siblings}
            loading={loading}
            buildHref={buildHref}
            linkComponent={Link}
            onNavigate={onNavigate}
            className={classes("pagination")}
          />
        )}
      </div>
    </div>
    </TableContext.Provider>
  )
}

/*
  In server mode the table holds one page, so an export can only contain that
  page. It is the caller's data to fetch, and `onExport` is where they do it.
*/
let warnedAboutExport = false

function warnAboutServerExport(): void {
  if (warnedAboutExport) return
  if (typeof process !== "undefined" && process.env["NODE_ENV"] === "production") return

  warnedAboutExport = true
  console.warn(
    "[trapezium] Exporting in server mode can only include the rows the table has, which is one " +
      "page. Say where the rest come from — server={{ all: (state) => … }} — and the table will " +
      "write the file from whatever you fetch. See " +
      "https://github.com/Gregaly/trapezium/blob/main/docs/server-data.md#exporting",
  )
}

function SkeletonRows({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 5 }, (_, row) => (
        <tr key={row} className="tpz-tr" aria-hidden="true">
          {Array.from({ length: columns }, (_, cell) => (
            <td key={cell} className="tpz-td">
              <span className="tpz-skeleton" style={{ width: `${String(45 + ((row * 7 + cell * 13) % 40))}%` }} />
            </td>
          ))}
        </tr>
      ))}
      <tr className="tpz-sr">
        <td colSpan={columns} aria-live="polite">
          Loading rows
        </td>
      </tr>
    </>
  )
}

/** The last pinned column on each side gets the shadow that marks the frozen edge. */
function isPinEdge(columns: Array<{ key: string; pin?: "start" | "end" }>, key: string): boolean {
  const starts = columns.filter((column) => column.pin === "start")
  const ends = columns.filter((column) => column.pin === "end")
  return starts[starts.length - 1]?.key === key || ends[0]?.key === key
}

function normaliseSearch(option: TableProps<AnyRow>["search"]): SearchOptions | undefined {
  if (!option) return undefined
  return option === true ? {} : option
}

function shallowEqualNumbers(a: Record<string, number>, b: Record<string, number>): boolean {
  const aKeys = Object.keys(a)
  if (aKeys.length !== Object.keys(b).length) return false
  return aKeys.every((key) => a[key] === b[key])
}
