import {
  DEFAULT_FORMAT,
  DEFAULT_STATE,
  copyText,
  createTypeRegistry,
  defaultTypeRegistry,
  distinctValues,
  downloadText,
  formatWithType,
  getRows,
  hideColumn,
  isEmpty,
  moveColumn,
  optionLabel,
  poof,
  removeFilter,
  removeFilterAt,
  reorderColumnTo,
  resolveColumns,
  resolveRowId,
  setFilter,
  setOrder,
  setPage,
  setPageSize,
  setPin,
  setSearch,
  setSelected,
  setWidth,
  showColumn,
  toCsv,
  toDelimitedText,
  toggleSelection,
  toggleSort,
  OPERATOR_LABELS,
  clearFilters,
  type AnyRow,
  type CellContext,
  type ColumnDef,
  type ColumnFilter,
  type Density,
  type FilterOperator,
  type FormatContext,
  type GetRowId,
  type PaginationOptions,
  type PartialTableState,
  type ResolvedColumn,
  type TableState,
  type TypeDef,
} from "@trapezium/core"

import { el, fill, icon } from "./dom.js"
import { closeMenu, menuItem, menuLabel, menuSeparator, openMenuAt } from "./menu.js"

/**
 * The table, in plain DOM.
 *
 * Same model, same markup, same class names as every other adapter — this one
 * simply builds the elements itself. It is also the reference implementation of
 * the markup: if a border or a data attribute differs here from the React
 * version, one of the two is wrong.
 *
 * Rendering is a rebuild rather than a diff. For the number of rows a page ever
 * shows, replacing the head and body is faster than reconciling them and an
 * order of magnitude less code. The toolbar is built once and kept, so the
 * search box does not lose focus mid-word.
 */

/** A cell renderer returns a node or a string — never a framework element. */
export type VanillaColumn<TRow extends AnyRow = AnyRow> = ColumnDef<TRow, Node | string>

export type TableOptions<TRow extends AnyRow = AnyRow> = {
  data: readonly TRow[]
  columns?: readonly (VanillaColumn<TRow> | string)[]
  getRowId?: GetRowId<TRow>

  state?: PartialTableState
  onStateChange?: (state: TableState) => void

  server?: boolean
  total?: number
  loading?: boolean
  error?: string

  search?: boolean | { placeholder?: string; debounce?: number }
  filters?: boolean
  sortable?: boolean
  resizable?: boolean
  reorderable?: boolean
  columnMenu?: boolean
  columnControl?: boolean
  pagination?: boolean | PaginationOptions
  selection?: boolean | "single" | "multiple"
  onSelectionChange?: (ids: string[], rows: TRow[]) => void
  export?: boolean | { filename?: string }

  types?: Record<string, TypeDef>
  format?: Partial<FormatContext>
  density?: Density
  responsive?: "scroll" | "cards"
  stickyHeader?: boolean
  maxHeight?: number | string
  theme?: "light" | "dark"

  rowHref?: (row: TRow) => string
  onRowClick?: (row: TRow, event: MouseEvent) => void
  rowClassName?: (row: TRow, index: number) => string | undefined
  emptyMessage?: string
  caption?: string
  ariaLabel?: string
}

export type TableInstance<TRow extends AnyRow = AnyRow> = {
  /** The root element, in case you need to measure or observe it. */
  element: HTMLElement
  /** Replaces the rows and re-renders. */
  setData(data: readonly TRow[]): void
  /** Merges options and re-renders. */
  setOptions(options: Partial<TableOptions<TRow>>): void
  getState(): TableState
  setState(state: PartialTableState): void
  /** The rows currently on screen, after everything has been applied. */
  getRows(): TRow[]
  /** Row ids currently selected. */
  getSelection(): string[]
  refresh(): void
  destroy(): void
}

export function createTable<TRow extends AnyRow>(
  target: HTMLElement | string,
  options: TableOptions<TRow>,
): TableInstance<TRow> {
  const host = typeof target === "string" ? document.querySelector<HTMLElement>(target) : target
  if (!host) throw new Error(`Trapezium: no element matched ${String(target)}`)

  let settings = options
  let state: TableState = { ...DEFAULT_STATE, ...paginationOf(options)?.stateDefaults, ...options.state }
  let lastSelection = state.selection.join(",")

  const root = el("div", { class: "tpz" })
  const frame = el("div", { class: "tpz-frame" })
  const toolbar = el("div", { class: "tpz-toolbar" })
  const toolbarStart = el("div", { class: "tpz-toolbar-group" })
  const toolbarEnd = el("div", { class: "tpz-toolbar-group" })
  const count = el("span", { class: "tpz-count", "aria-live": "polite" })
  const chips = el("div", { class: "tpz-chips" })
  const scroll = el("div", { class: "tpz-scroll" })
  /*
    Watched by infinite scrolling. It lives at the end of the scroll area — a
    sentinel in the pagination bar below the table is visible whenever the
    table is on screen, so it fires immediately and loads every page at once.
  */
  const sentinel = el("div", { class: "tpz-sentinel", "aria-hidden": "true" })
  const table = el("table", { class: "tpz-table" })
  const head = el("thead", { class: "tpz-thead" })
  const body = el("tbody", { class: "tpz-tbody" })
  const paginationBar = el("div", { class: "tpz-pagination" })

  toolbarStart.append(count, chips)
  toolbar.append(toolbarStart, toolbarEnd)
  table.append(head, body)
  scroll.append(table, sentinel)
  frame.append(toolbar, scroll, paginationBar)
  root.append(frame)
  host.append(root)

  /* ── Toolbar, built once so the search box keeps focus ─────────────────── */

  let searchInput: HTMLInputElement | undefined
  let searchTimer: ReturnType<typeof setTimeout> | undefined

  function buildToolbar() {
    fill(toolbarEnd, [])
    searchInput = undefined

    if (settings.search) {
      const config = settings.search === true ? {} : settings.search
      const wrap = el("div", { class: "tpz-search" })
      const glyph = icon("search", 14, "tpz-search-icon")
      searchInput = el("input", {
        class: "tpz-input",
        type: "search",
        placeholder: config.placeholder ?? "Search",
        "aria-label": config.placeholder ?? "Search",
        value: state.search,
      })

      searchInput.addEventListener("input", () => {
        clearTimeout(searchTimer)
        const value = searchInput?.value ?? ""
        searchTimer = setTimeout(() => update(setSearch(state, value)), config.debounce ?? 150)
      })

      wrap.append(glyph ?? "", searchInput)
      toolbarEnd.append(wrap)
    }

    if (settings.columnControl !== false) {
      const button = el("button", { type: "button", class: "tpz-btn", "aria-haspopup": "true" }, [
        icon("columns"),
        "Columns",
      ])
      button.addEventListener("click", () => openColumnMenu(button))
      toolbarEnd.append(button)
    }

    if (settings.export) {
      const config = settings.export === true ? {} : settings.export
      const button = el("button", {
        type: "button",
        class: "tpz-btn tpz-btn-icon",
        "aria-label": "Export",
        "aria-haspopup": "true",
      })
      const glyph = icon("download")
      if (glyph) button.append(glyph)

      button.addEventListener("click", () => {
        openMenuAt({ anchor: button, align: "end", label: "Export", theme: settings.theme }, (close) => [
          menuItem(
            "Download CSV",
            () => {
              const { rows, columns } = current()
              downloadText(
                toCsv(rows, { columns, types: registry(), format: formatting(), getRowId: settings.getRowId }),
                `${config.filename ?? "table"}.csv`,
              )
              close()
            },
            { icon: icon("download") },
          ),
          menuItem(
            "Copy to clipboard",
            () => {
              const { rows, columns } = current()
              void copyText(
                toDelimitedText(rows, {
                  columns,
                  types: registry(),
                  format: formatting(),
                  delimiter: "\t",
                  getRowId: settings.getRowId,
                }),
              )
              close()
            },
            { icon: icon("copy") },
          ),
        ])
      })

      toolbarEnd.append(button)
    }

    toolbar.style.display =
      toolbarEnd.childElementCount === 0 && state.filters.length === 0 ? "none" : ""
  }

  /* ── Model ─────────────────────────────────────────────────────────────── */

  function registry() {
    return settings.types ? createTypeRegistry(settings.types) : defaultTypeRegistry
  }

  function formatting(): FormatContext {
    return { ...DEFAULT_FORMAT, ...settings.format }
  }

  function current() {
    const pagination = paginationOf(settings)
    const { visible, hidden } = resolveColumns<TRow, Node | string>({
      columns: settings.columns,
      rows: settings.data,
      state,
      types: registry(),
      resizable: settings.resizable,
      reorderable: settings.reorderable,
    })

    const result = getRows<TRow, Node | string>({
      rows: settings.data,
      columns: visible,
      state: pagination ? state : { ...state, pageSize: 0 },
      types: registry(),
      format: formatting(),
      server: settings.server,
      total: settings.total,
      accumulate: pagination?.mode === "infinite" || pagination?.mode === "loadMore",
    })

    return { columns: visible, hidden, pagination, ...result }
  }

  function update(next: TableState) {
    state = next
    render()
    settings.onStateChange?.(next)

    const key = state.selection.join(",")
    if (key !== lastSelection) {
      lastSelection = key
      const { rows } = current()
      const byId = new Map(rows.map((row, index) => [resolveRowId(row, index, settings.getRowId), row]))
      settings.onSelectionChange?.(
        state.selection,
        state.selection.map((id) => byId.get(id)).filter((row): row is TRow => row !== undefined),
      )
    }
  }

  /* ── Render ────────────────────────────────────────────────────────────── */

  function render() {
    const { columns, hidden, rows, total, pageCount, filtered, pagination } = current()
    const types = registry()
    const format = formatting()
    const selectionMode = settings.selection === true ? "multiple" : settings.selection || undefined
    const columnCount = columns.length + (selectionMode ? 1 : 0)

    root.dataset["density"] = state.density
    root.dataset["responsive"] = settings.responsive ?? "scroll"
    if (settings.theme) root.dataset["theme"] = settings.theme
    if (settings.stickyHeader !== false) root.dataset["stickyHeader"] = "true"
    if (settings.maxHeight !== undefined) {
      root.style.setProperty(
        "--tpz-max-height",
        typeof settings.maxHeight === "number" ? `${String(settings.maxHeight)}px` : settings.maxHeight,
      )
    }
    if (settings.ariaLabel) table.setAttribute("aria-label", settings.ariaLabel)

    count.textContent =
      state.selection.length > 0
        ? `${state.selection.length.toLocaleString()} selected`
        : `${total.toLocaleString()} ${total === 1 ? "row" : "rows"}`

    renderChips(columns)

    /* Header */
    const headerRow = el("tr", { class: "tpz-tr" })
    if (selectionMode) headerRow.append(selectionHeader(rows, selectionMode))
    for (const column of columns) headerRow.append(headerCell(column, columns))
    fill(head, [headerRow])

    /* Body */
    const rendered: Node[] = []

    if (settings.loading && rows.length === 0) {
      for (let index = 0; index < 5; index += 1) {
        const row = el("tr", { class: "tpz-tr", "aria-hidden": "true" })
        for (let cell = 0; cell < columnCount; cell += 1) {
          const skeleton = el("span", { class: "tpz-skeleton" })
          skeleton.style.width = `${String(45 + ((index * 7 + cell * 13) % 40))}%`
          row.append(el("td", { class: "tpz-td" }, [skeleton]))
        }
        rendered.push(row)
      }
    }

    if (settings.error) {
      rendered.push(
        el("tr", {}, [
          el("td", { class: "tpz-td", colspan: columnCount, "data-wrap": "true" }, [
            el("div", { class: "tpz-state", "data-tone": "danger", role: "alert" }, [
              icon("warning", 20, "tpz-state-icon"),
              settings.error,
            ]),
          ]),
        ]),
      )
    }

    if (rows.length === 0 && !settings.loading && !settings.error) {
      rendered.push(
        el("tr", {}, [
          el("td", { class: "tpz-td", colspan: columnCount, "data-wrap": "true" }, [
            el("div", { class: "tpz-state" }, [
              icon("empty", 22, "tpz-state-icon"),
              filtered ? "No rows match" : (settings.emptyMessage ?? "Nothing to show"),
            ]),
          ]),
        ]),
      )
    }

    rows.forEach((row, index) => {
      const id = resolveRowId(row, index, settings.getRowId)
      const selected = state.selection.includes(id)
      const tr = el("tr", {
        class: ["tpz-tr", settings.rowClassName?.(row, index)].filter(Boolean).join(" "),
        "data-selected": selected ? "true" : undefined,
        "data-clickable": settings.onRowClick ? "true" : undefined,
      })

      if (settings.onRowClick) {
        tr.addEventListener("click", (event) => settings.onRowClick?.(row, event))
      }

      if (selectionMode) {
        const box = el("input", {
          type: selectionMode === "single" ? "radio" : "checkbox",
          class: "tpz-checkbox",
          "aria-label": `Select row ${String(index + 1)}`,
        }) as HTMLInputElement
        box.checked = selected
        box.addEventListener("click", (event) => event.stopPropagation())
        box.addEventListener("change", () =>
          update(toggleSelection(state, id, selectionMode === "single")),
        )
        tr.append(el("td", { class: "tpz-td tpz-select-cell", "data-pin": "start", "data-key": "__select" }, [box]))
      }

      columns.forEach((column, columnIndex) => {
        const context = cellContext(row, id, index, column, types, format)
        const content = renderCell(context, settings)
        const cell = el("td", {
          class: ["tpz-td", column.className].filter(Boolean).join(" "),
          "data-align": column.align,
          "data-mono": column.mono ? undefined : "false",
          "data-wrap": column.wrap ? "true" : undefined,
          "data-pin": column.pin,
          "data-key": column.key,
          "data-label": column.header,
        })
        if (column.width) cell.style.width = `${String(column.width)}px`

        if (columnIndex === 0 && settings.rowHref) {
          const link = el("a", { class: "tpz-link tpz-lead", href: settings.rowHref(row) })
          link.append(typeof content === "string" ? document.createTextNode(content) : content)
          cell.append(link)
        } else {
          cell.append(typeof content === "string" ? document.createTextNode(content) : content)
        }

        tr.append(cell)
      })

      rendered.push(tr)
    })

    fill(body, rendered)
    applyPinOffsets()
    renderPagination(pagination, total, pageCount, rows.length)
    void hidden
  }

  /** Frozen columns need real pixel offsets, and only layout knows them. */
  function applyPinOffsets() {
    const cells = [...head.querySelectorAll<HTMLElement>("[data-pin]")]
    const offsets: Record<string, number> = {}

    let start = 0
    for (const cell of cells.filter((entry) => entry.dataset["pin"] === "start")) {
      offsets[cell.dataset["key"] ?? ""] = start
      start += cell.getBoundingClientRect().width
    }

    let end = 0
    for (const cell of cells.filter((entry) => entry.dataset["pin"] === "end").reverse()) {
      offsets[cell.dataset["key"] ?? ""] = end
      end += cell.getBoundingClientRect().width
    }

    /*
      Matched by reading the attribute rather than by building a selector from
      it: a column key can contain a dot (`customer.name`), and `CSS.escape`
      is not available everywhere the core is — including some test
      environments.
    */
    for (const cell of root.querySelectorAll<HTMLElement>("[data-pin][data-key]")) {
      const offset = offsets[cell.dataset["key"] ?? ""]
      if (offset === undefined) continue
      cell.style[cell.dataset["pin"] === "end" ? "right" : "left"] = `${String(offset)}px`
    }
  }

  function selectionHeader(rows: readonly TRow[], mode: "single" | "multiple"): HTMLElement {
    const cell = el("th", {
      scope: "col",
      class: "tpz-th tpz-select-cell",
      "data-pin": "start",
      "data-key": "__select",
    })

    if (mode === "multiple") {
      const ids = rows.map((row, index) => resolveRowId(row, index, settings.getRowId))
      const selectedHere = ids.filter((id) => state.selection.includes(id)).length
      const all = ids.length > 0 && selectedHere === ids.length

      const box = el("input", {
        type: "checkbox",
        class: "tpz-checkbox",
        "aria-label": all ? "Clear selection" : "Select all rows on this page",
      }) as HTMLInputElement
      box.checked = all
      box.indeterminate = selectedHere > 0 && !all
      box.addEventListener("change", () => update(setSelected(state, ids, !all)))
      cell.append(box)
    }

    return cell
  }

  function headerCell(
    column: ResolvedColumn<TRow, Node | string>,
    columns: ResolvedColumn<TRow, Node | string>[],
  ): HTMLElement {
    const sort = state.sort.find((entry) => entry.key === column.key)
    const filter = state.filters.find((entry) => entry.key === column.key)
    const sortable = settings.sortable !== false && column.sortable
    const keys = columns.map((entry) => entry.key)

    const cell = el("th", {
      scope: "col",
      class: "tpz-th",
      "data-align": column.align,
      "data-pin": column.pin,
      "data-key": column.key,
      "data-filtered": filter ? "true" : undefined,
      "aria-sort": sort ? (sort.direction === "asc" ? "ascending" : "descending") : "none",
    })
    if (column.width) cell.style.width = `${String(column.width)}px`

    const inner = el("div", { class: "tpz-th-inner" })
    const reorderable = settings.reorderable !== false && column.reorderable !== false && !column.pin

    if (reorderable) {
      // The whole header is the handle. A grip inside it is a 28px target for
      // something as physical as moving a column, and every table people have
      // used lets them grab the header itself.
      cell.draggable = true
      cell.dataset["draggable"] = "true"
      attachColumnDrag(cell, column.key, keys)
    }

    // Dragging is a pointer affordance; the keyboard equivalent is "Move left"
    // and "Move right" in the column panel, so the icon announces nothing.
    inner.append(el("span", { class: "tpz-th-icon", "aria-hidden": "true" }, [icon(column.icon)]))

    const label = el(sortable ? "button" : "span", { class: "tpz-th-button", type: sortable ? "button" : undefined }, [
      el("span", { class: "tpz-th-label", text: column.header }),
      sort ? icon(sort.direction === "asc" ? "sortAscending" : "sortDescending", 12, "tpz-th-marker") : null,
    ])
    if (sortable) label.addEventListener("click", () => update(toggleSort(state, column.key)))
    inner.append(label)

    if (settings.columnMenu !== false) {
      const trigger = el(
        "button",
        {
          type: "button",
          class: "tpz-th-menu",
          "aria-haspopup": "true",
          "aria-label": `${column.header} column options`,
        },
        [icon("chevronDown", 12, "tpz-th-chevron")],
      )
      trigger.addEventListener("click", () => openHeaderMenu(trigger, column, keys))
      inner.append(trigger)
    }

    if (settings.resizable !== false && column.resizable !== false) {
      inner.append(resizeHandle(cell, column.key))
    }

    cell.append(inner)
    return cell
  }

  /**
   * Reordering by drag, and removing by dragging out.
   *
   * Which side of the middle the pointer is on decides where the column lands,
   * so a drop is never a guess. Letting go outside the table removes the
   * column — the same gesture as dragging something off the macOS dock, with
   * the same puff of smoke, because a removal with no animation reads as a bug.
   */
  function attachColumnDrag(cell: HTMLElement, key: string, keys: string[]) {
    let edge: "before" | "after" = "before"

    cell.addEventListener("dragstart", (event) => {
      event.dataTransfer?.setData("text/tpz-column", key)
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move"
      cell.dataset["dragging"] = "true"
      root.dataset["draggingOut"] = "true"
    })

    cell.addEventListener("dragend", (event) => {
      delete cell.dataset["dragging"]
      delete cell.dataset["drop"]
      delete root.dataset["draggingOut"]

      // Nothing accepted the drop, so it landed outside the table. The last
      // visible column is refused: a table of nothing has no obvious way back.
      if (event.dataTransfer?.dropEffect !== "none") return
      if (keys.length <= 1) return

      const rect = root.querySelector(".tpz-frame")?.getBoundingClientRect()
      if (!rect) return
      const outside =
        event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom
      if (!outside) return

      poof({ x: event.clientX, y: event.clientY, theme: settings.theme })
      update(hideColumn(state, key))
    })

    cell.addEventListener("dragover", (event) => {
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move"

      const rect = cell.getBoundingClientRect()
      edge = event.clientX < rect.left + rect.width / 2 ? "before" : "after"
      cell.dataset["drop"] = edge
    })

    cell.addEventListener("dragleave", () => delete cell.dataset["drop"])

    cell.addEventListener("drop", (event) => {
      event.preventDefault()
      delete cell.dataset["drop"]

      const dragged = event.dataTransfer?.getData("text/tpz-column")
      if (!dragged || dragged === key) return
      update(setOrder(state, reorderColumnTo(keys, dragged, key, edge)))
    })
  }

  function resizeHandle(cell: HTMLElement, key: string): HTMLElement {
    const handle = el("button", { type: "button", class: "tpz-resizer", "aria-label": `Resize column` })

    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault()
      const startX = event.clientX
      const startWidth = cell.getBoundingClientRect().width
      handle.setPointerCapture(event.pointerId)
      handle.dataset["resizing"] = "true"
      // A press-and-move on the handle is exactly what starts a column drag.
      // Turning it off for the duration is what lets the two gestures share
      // the same cell.
      const wasDraggable = cell.draggable
      cell.draggable = false

      const move = (next: PointerEvent) => update(setWidth(state, key, startWidth + (next.clientX - startX)))
      const up = () => {
        delete handle.dataset["resizing"]
        cell.draggable = wasDraggable
        handle.removeEventListener("pointermove", move)
        handle.removeEventListener("pointerup", up)
      }

      handle.addEventListener("pointermove", move)
      handle.addEventListener("pointerup", up)
    })

    handle.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
      event.preventDefault()
      const step = event.shiftKey ? 40 : 10
      const width = cell.getBoundingClientRect().width
      update(setWidth(state, key, width + (event.key === "ArrowRight" ? step : -step)))
    })

    return handle
  }

  function openHeaderMenu(
    anchor: HTMLElement,
    column: ResolvedColumn<TRow, Node | string>,
    keys: string[],
  ) {
    const filter = state.filters.find((entry) => entry.key === column.key)

    openMenuAt({ anchor, label: `${column.header} column`, theme: settings.theme }, (close) => {
      const items: Array<Node | null> = []

      if (settings.sortable !== false && column.sortable) {
        items.push(
          menuItem("Sort ascending", () => {
            update({ ...state, sort: [{ key: column.key, direction: "asc" }], page: 1 })
            close()
          }, { icon: icon("sortAscending") }),
          menuItem("Sort descending", () => {
            update({ ...state, sort: [{ key: column.key, direction: "desc" }], page: 1 })
            close()
          }, { icon: icon("sortDescending") }),
          menuSeparator(),
        )
      }

      if (settings.filters !== false && column.filterKind !== "none") {
        items.push(
          filterControl(column, filter, (next) => {
            update(setFilter(state, next))
            if (column.filterKind !== "set") close()
          }, () => update(removeFilter(state, column.key))),
          menuSeparator(),
        )
      }

      if (settings.reorderable !== false && !column.pin) {
        items.push(
          menuItem("Move left", () => {
            update(setOrder(state, moveColumn(keys, column.key, "left")))
            close()
          }, { icon: icon("arrowLeft"), disabled: keys.indexOf(column.key) <= 0 }),
          menuItem("Move right", () => {
            update(setOrder(state, moveColumn(keys, column.key, "right")))
            close()
          }, { icon: icon("arrowRight"), disabled: keys.indexOf(column.key) >= keys.length - 1 }),
        )
      }

      items.push(
        menuItem(
          state.pinned[column.key] === "start" ? "Unpin" : "Pin to the left",
          () => {
            update(setPin(state, column.key, state.pinned[column.key] === "start" ? undefined : "start"))
            close()
          },
          { icon: icon("pin") },
        ),
        menuItem("Hide column", () => {
          update(hideColumn(state, column.key))
          close()
        }, { icon: icon("eyeOff") }),
      )

      return items
    })
  }

  /** The right control for the column's type, built as DOM. */
  function filterControl(
    column: ResolvedColumn<TRow, Node | string>,
    filter: ColumnFilter | undefined,
    onApply: (filter: ColumnFilter) => void,
    onClear: () => void,
  ): HTMLElement {
    const wrap = el("div", { class: "tpz-filter" })

    if (column.filterKind === "set") {
      const configured = column.formatOptions?.options
      // Labelled the way the column labels its cells, so a set filter offers
      // "Blocker" rather than "blocker" — including for a custom type, whose
      // formatter is the only thing that knows the difference.
      const label = (value: unknown) =>
        formatWithType(registry().get(column.type), value, { ...formatting(), ...column.formatOptions })

      const choices = configured?.length
        ? configured.map((option) => ({ value: option.value, label: option.label ?? option.value }))
        : distinctValues(settings.data.map((row) => column.accessor(row))).map((entry) => ({
            value: entry.value,
            label: label(entry.value) || entry.value,
          }))

      const chosen = new Set(
        filter && Array.isArray(filter.value)
          ? filter.value.map(String)
          : filter?.value !== undefined
            ? [String(filter.value)]
            : [],
      )

      const list = el("div", { class: "tpz-menu-scroll tpz-filter-list" })
      for (const choice of choices) {
        const box = el("input", { type: "checkbox", class: "tpz-checkbox" }) as HTMLInputElement
        box.checked = chosen.has(choice.value)
        box.addEventListener("change", () => {
          if (box.checked) chosen.add(choice.value)
          else chosen.delete(choice.value)

          if (chosen.size === 0) onClear()
          else onApply({ key: column.key, operator: chosen.size === 1 ? "eq" : "in", value: [...chosen] })
        })
        list.append(el("label", { class: "tpz-filter-option" }, [box, el("span", { class: "tpz-filter-option-label", text: choice.label })]))
      }

      wrap.append(list)
      if (filter) {
        const clear = el("button", { type: "button", class: "tpz-btn", text: "Clear" })
        clear.addEventListener("click", onClear)
        wrap.append(el("div", { class: "tpz-filter-actions" }, [clear]))
      }
      return wrap
    }

    if (column.filterKind === "boolean") {
      const select = el("select", { class: "tpz-input", "aria-label": `Filter ${column.header}` }, [
        el("option", { value: "", text: "Any" }),
        el("option", { value: "true", text: "Yes" }),
        el("option", { value: "false", text: "No" }),
      ]) as HTMLSelectElement
      select.value = filter?.value === undefined ? "" : String(filter.value)
      select.addEventListener("change", () => {
        if (select.value === "") onClear()
        else onApply({ key: column.key, operator: "eq", value: select.value })
      })
      wrap.append(select)
      return wrap
    }

    const operators = el("select", { class: "tpz-input", "aria-label": `How to filter ${column.header}` }) as HTMLSelectElement
    for (const operator of column.operators) {
      operators.append(el("option", { value: operator, text: OPERATOR_LABELS[operator] }))
    }
    operators.value = filter?.operator ?? column.operators[0] ?? "contains"

    const value = el("input", {
      class: "tpz-input",
      type: column.filterKind === "date" ? "date" : column.filterKind === "range" ? "number" : "text",
      "aria-label": `Filter ${column.header} by`,
      placeholder: "Value",
      value: filter?.value === undefined ? "" : String(filter.value),
    }) as HTMLInputElement

    const apply = () => {
      const operator = operators.value as FilterOperator
      if (operator === "empty" || operator === "notEmpty") {
        onApply({ key: column.key, operator })
        return
      }
      if (value.value.trim() === "") {
        onClear()
        return
      }
      onApply({ key: column.key, operator, value: value.value.trim() })
    }

    value.addEventListener("keydown", (event) => {
      if (event.key === "Enter") apply()
    })

    const button = el("button", { type: "button", class: "tpz-btn", "data-variant": "primary", text: "Apply" })
    button.addEventListener("click", apply)

    wrap.append(operators, value, el("div", { class: "tpz-filter-actions" }, [button]))
    return wrap
  }

  function openColumnMenu(anchor: HTMLElement) {
    const { columns, hidden } = current()

    openMenuAt({ anchor, align: "end", label: "Columns", theme: settings.theme, width: 220 }, () => {
      const list = el("div", { class: "tpz-menu-scroll" }, [menuLabel("Shown")])

      const keys = columns.map((column) => column.key)

      for (const column of columns) {
        const box = el("input", { type: "checkbox", class: "tpz-checkbox" }) as HTMLInputElement
        box.checked = true
        box.disabled = columns.length === 1
        box.addEventListener("change", () => update(hideColumn(state, column.key)))

        const reorderable = column.reorderable !== false && !column.pin
        const row = el(
          "label",
          { class: "tpz-filter-option", draggable: reorderable ? "true" : undefined },
          [
            reorderable ? icon("grip", 14, "tpz-grip") : null,
            box,
            icon(column.icon),
            el("span", { class: "tpz-filter-option-label", text: column.header || column.key }),
          ],
        )

        // The other place people expect to reorder columns, and the one that
        // works when the column they want is scrolled off the side.
        if (reorderable) attachListDrag(row, column.key, keys)
        list.append(row)
      }

      if (hidden.length > 0) {
        list.append(menuSeparator(), menuLabel("Hidden"))
        for (const column of hidden) {
          const box = el("input", { type: "checkbox", class: "tpz-checkbox" }) as HTMLInputElement
          box.addEventListener("change", () => update(showColumn(state, column.key)))
          list.append(
            el("label", { class: "tpz-filter-option" }, [
              box,
              icon(column.icon),
              el("span", { class: "tpz-filter-option-label", text: column.header || column.key }),
            ]),
          )
        }
      }

      return [list]
    })
  }

  /** Vertical reordering inside the column list. */
  function attachListDrag(row: HTMLElement, key: string, keys: string[]) {
    let edge: "before" | "after" = "before"

    row.addEventListener("dragstart", (event) => {
      event.dataTransfer?.setData("text/tpz-column", key)
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move"
      row.dataset["dragging"] = "true"
    })

    row.addEventListener("dragend", () => {
      delete row.dataset["dragging"]
      delete row.dataset["drop"]
    })

    row.addEventListener("dragover", (event) => {
      event.preventDefault()
      const rect = row.getBoundingClientRect()
      edge = event.clientY < rect.top + rect.height / 2 ? "before" : "after"
      row.dataset["drop"] = edge
    })

    row.addEventListener("dragleave", () => delete row.dataset["drop"])

    row.addEventListener("drop", (event) => {
      event.preventDefault()
      delete row.dataset["drop"]

      const dragged = event.dataTransfer?.getData("text/tpz-column")
      if (!dragged || dragged === key) return
      update(setOrder(state, reorderColumnTo(keys, dragged, key, edge)))
    })
  }

  function renderChips(columns: ResolvedColumn<TRow, Node | string>[]) {
    if (state.filters.length === 0) {
      fill(chips, [])
      return
    }

    const nodes: Node[] = state.filters.map((filter, index) => {
      const column = columns.find((entry) => entry.key === filter.key)
      const name = column?.header ?? filter.key
      const operator = OPERATOR_LABELS[filter.operator] ?? filter.operator
      const options = column?.formatOptions?.options
      const value =
        filter.value === undefined
          ? ""
          : Array.isArray(filter.value)
            ? filter.value.map((entry) => optionLabel(entry, options)).join(", ")
            : optionLabel(filter.value, options)

      const remove = el("button", {
        type: "button",
        class: "tpz-chip-remove",
        "aria-label": `Remove filter on ${name}`,
      }, [icon("close", 12)])
      remove.addEventListener("click", () => update(removeFilterAt(state, index)))

      return el("span", { class: "tpz-chip" }, [`${name} ${operator} ${value}`.trim(), remove])
    })

    const clear = el("button", { type: "button", class: "tpz-btn", text: "Clear" })
    clear.addEventListener("click", () => update(clearFilters(state)))
    nodes.push(clear)

    fill(chips, nodes)
  }

  function renderPagination(
    pagination: ReturnType<typeof paginationOf>,
    total: number,
    pageCount: number,
    shown: number,
  ) {
    if (!pagination) {
      fill(paginationBar, [])
      paginationBar.style.display = "none"
      return
    }

    paginationBar.style.display = ""

    if (pagination.mode === "loadMore" || pagination.mode === "infinite") {
      const hasMore = state.page < pageCount
      if (pagination.mode === "infinite") observeSentinel(hasMore)

      if (!hasMore) {
        fill(paginationBar, [])
        paginationBar.style.display = "none"
        return
      }

      const button = el("button", {
        type: "button",
        class: "tpz-btn",
        "data-variant": "outline",
        text: `Load more (${shown.toLocaleString()} of ${total.toLocaleString()})`,
      })
      button.addEventListener("click", () => update(setPage(state, state.page + 1)))
      fill(paginationBar, [button])
      return
    }

    observer?.disconnect()

    if (pageCount <= 1 && !pagination.pageSizeOptions?.length) {
      fill(paginationBar, [])
      paginationBar.style.display = "none"
      return
    }

    const first = total === 0 ? 0 : (state.page - 1) * state.pageSize + 1
    const last = Math.min(state.page * state.pageSize, total)

    const info = el("span", {
      class: "tpz-count",
      "aria-live": "polite",
      text: total === 0 ? "No rows" : `${first.toLocaleString()}–${last.toLocaleString()} of ${total.toLocaleString()}`,
    })

    const start = el("div", { class: "tpz-toolbar-group" }, [info])

    if (pagination.pageSizeOptions && pagination.pageSizeOptions.length > 0) {
      const select = el(
        "select",
        { class: "tpz-input" },
        pagination.pageSizeOptions.map((size) =>
          el("option", { value: size, text: `${String(size)} per page` }),
        ),
      ) as HTMLSelectElement
      select.value = String(state.pageSize)
      select.addEventListener("change", () => update(setPageSize(state, Number(select.value))))

      start.append(
        el("label", { class: "tpz-count" }, [el("span", { class: "tpz-sr", text: "Rows per page" }), select]),
      )
    }

    const nav = el("nav", { class: "tpz-pages", "aria-label": "Pagination" })

    const pageButton = (page: number, label: string, content: Node | string, disabled = false, isCurrent = false) => {
      const button = el("button", {
        type: "button",
        class: "tpz-btn tpz-page",
        "aria-label": label,
        "aria-current": isCurrent ? "page" : undefined,
        disabled,
      }, [content])
      if (!disabled) button.addEventListener("click", () => update(setPage(state, page)))
      return button
    }

    nav.append(pageButton(state.page - 1, "Previous page", icon("chevronLeft") ?? "‹", state.page <= 1))

    if (pagination.mode === "pages") {
      for (const entry of pageWindow(state.page, pageCount, pagination.siblings)) {
        nav.append(
          entry === "gap"
            ? el("span", { class: "tpz-ellipsis", "aria-hidden": "true", text: "…" })
            : pageButton(entry, `Page ${String(entry)}`, entry.toLocaleString(), false, entry === state.page),
        )
      }
    } else {
      nav.append(el("span", { class: "tpz-count", text: `${state.page} / ${pageCount}` }))
    }

    nav.append(pageButton(state.page + 1, "Next page", icon("chevronRight") ?? "›", state.page >= pageCount))

    fill(paginationBar, [start, nav])
  }

  let observer: IntersectionObserver | undefined

  /**
   * Watches for the end of the rows.
   *
   * Rooted on the scroll container when the table has its own height, and on
   * the viewport when it grows with the page — watching the viewport for a
   * table that scrolls internally is what makes a sentinel fire while the user
   * is nowhere near the end.
   *
   * Loads at most one page per render: the observer is disconnected the moment
   * it fires, and the next render sets up a new one. If the sentinel is still
   * visible then — a short page in a tall container — it fires again, which is
   * the right answer to "there is still empty space".
   */
  function observeSentinel(hasMore: boolean) {
    observer?.disconnect()
    observer = undefined

    // No observer, no automatic loading — the button below is still there, so
    // the feature degrades rather than disappearing.
    if (!hasMore || settings.loading || typeof IntersectionObserver === "undefined") return

    const scrolls = scroll.scrollHeight > scroll.clientHeight + 1

    observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer?.disconnect()
        update(setPage(state, state.page + 1))
      },
      { root: scrolls ? scroll : null, rootMargin: "96px" },
    )

    observer.observe(sentinel)
  }

  /* ── Instance ──────────────────────────────────────────────────────────── */

  buildToolbar()
  render()

  return {
    element: root,
    setData(data) {
      settings = { ...settings, data }
      render()
    },
    setOptions(next) {
      settings = { ...settings, ...next }
      buildToolbar()
      render()
    },
    getState: () => state,
    setState(partial) {
      update({ ...state, ...partial })
    },
    getRows: () => current().rows,
    getSelection: () => [...state.selection],
    refresh: render,
    destroy() {
      observer?.disconnect()
      clearTimeout(searchTimer)
      closeMenu()
      root.remove()
    },
  }
}

/* ── Helpers shared with the other adapters' behaviour ───────────────────── */

function paginationOf<TRow extends AnyRow>(options: TableOptions<TRow>) {
  if (options.pagination === false) return undefined
  const given = options.pagination === true || options.pagination === undefined ? {} : options.pagination
  return {
    mode: given.mode ?? "pages",
    pageSize: given.pageSize ?? DEFAULT_STATE.pageSize,
    siblings: given.siblings ?? 1,
    pageSizeOptions: given.pageSizeOptions,
    stateDefaults: { pageSize: given.pageSize ?? DEFAULT_STATE.pageSize } as PartialTableState,
  }
}

function cellContext<TRow extends AnyRow>(
  row: TRow,
  rowId: string,
  rowIndex: number,
  column: ResolvedColumn<TRow, Node | string>,
  types: ReturnType<typeof createTypeRegistry>,
  format: FormatContext,
): CellContext<TRow, Node | string> {
  const value = column.accessor(row)
  const context: CellContext<TRow, Node | string> = {
    value,
    row,
    rowIndex,
    rowId,
    column,
    text: formatWithType(types.get(column.type), value, { ...format, ...column.formatOptions }),
    format,
  }
  if (column.format) context.text = column.format(context)
  return context
}

/**
 * The default cell, matching the React adapter exactly.
 *
 * When these two disagree, four packages become four products — so the list of
 * cases here and the switch in `@trapezium/react` are meant to be read side by
 * side.
 */
function renderCell<TRow extends AnyRow>(
  context: CellContext<TRow, Node | string>,
  settings: TableOptions<TRow>,
): Node | string {
  const { column, value, text } = context
  if (column.render) return column.render(context)

  if (isEmpty(value)) {
    return el("span", { class: "tpz-empty-value", "aria-label": "Empty", text: context.format.emptyText })
  }

  switch (column.type) {
    case "boolean":
      return el("span", { class: value ? "tpz-boolean-true" : "tpz-boolean-false" }, [
        icon(value ? "check" : "minus"),
        el("span", { class: "tpz-sr", text: value ? "Yes" : "No" }),
      ])

    case "url": {
      const href = String(value)
      const link = el("a", {
        class: "tpz-link",
        href,
        target: "_blank",
        rel: "noopener noreferrer",
        text: href.replace(/^https?:\/\//, "").replace(/\/$/, ""),
      })
      link.addEventListener("click", (event) => event.stopPropagation())
      return link
    }

    case "email":
      return el("a", { class: "tpz-link", href: `mailto:${String(value)}`, text: String(value) })

    case "phone":
      return el("a", {
        class: "tpz-link",
        href: `tel:${String(value).replace(/[^\d+]/g, "")}`,
        text: String(value),
      })

    case "image":
      return el("img", { class: "tpz-avatar", src: String(value), alt: "", loading: "lazy" })

    case "select":
    case "badge":
      return badge(String(value), column.formatOptions?.options)

    case "tags": {
      const values = Array.isArray(value) ? value : [value]
      return el(
        "span",
        { class: "tpz-tags" },
        values.map((entry) => badge(String(entry), column.formatOptions?.options)),
      )
    }

    default:
      void settings
      return text
  }
}

function badge(value: string, options: Array<{ value: string; label?: string; colour?: string }> | undefined): HTMLElement {
  const option = options?.find((entry) => entry.value === value)
  const node = el("span", { class: "tpz-badge", title: option?.label ?? value, text: option?.label ?? value })
  if (option?.colour) {
    node.dataset["colour"] = ""
    node.style.setProperty("--tpz-badge-colour", option.colour)
  }
  return node
}

/** Which page numbers to show: first, last, the current one and its neighbours. */
export function pageWindow(page: number, pageCount: number, siblings: number): Array<number | "gap"> {
  const width = siblings * 2 + 5
  const range = (from: number, to: number) =>
    Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index)

  if (pageCount <= width) return range(1, pageCount)

  const start = Math.max(2, page - siblings)
  const end = Math.min(pageCount - 1, page + siblings)

  const pages: Array<number | "gap"> = [1]
  if (start > 2) pages.push("gap")
  pages.push(...range(start, end))
  if (end < pageCount - 1) pages.push("gap")
  pages.push(pageCount)

  return pages
}
