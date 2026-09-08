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
  rowsToExport,
  setFilter,
  setMatch,
  setOrder,
  setPage,
  setPageSize,
  setPin,
  setDensity,
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
  clearWidth,
  createClasses,
  isPlainLinkClick,
  resolveSelection,
  selectRange,
  selectableIds,
  toSelectOptions,
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
  type ResolvedSelection,
  type RowHeight,
  type SelectOption,
  type SelectionInput,
  type ServerSource,
  type TableSlots,
  type TableState,
  type TypeDef,
} from "@trapezium/core"

import { currentDocument, el, fill, fragment, icon, text } from "./dom.js"
import { closeMenu, menuItem, menuLabel, menuLink, menuSeparator, openMenuAt } from "./menu.js"

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

  /** Controlled state. Followed whenever a new object is passed. */
  state?: PartialTableState
  /** Starting state for a table that manages its own — a saved view, a URL. Read once. */
  defaultState?: PartialTableState
  onStateChange?: (state: TableState) => void

  /**
   * The rows have already been filtered, sorted and paginated by a server.
   *
   * Pass an object instead of `true` to say where the answers the table cannot
   * work out for itself come from — the values behind a set filter, and the
   * rows behind an export. Given once, every set-filter column and the export
   * use it.
   */
  server?: boolean | ServerSource<TRow>
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
  /**
   * `true` means multiple. The object form adds `isSelectable`, for rows that
   * must stay unselected, and `onChange`.
   */
  selection?: SelectionInput<TRow>
  /** Convenience for `selection.onChange`. */
  onSelectionChange?: (ids: string[], rows: TRow[]) => void
  export?:
    | boolean
    | {
        filename?: string
        /** Offer "copy to clipboard" alongside the download. Defaults to true. */
        clipboard?: boolean
        /**
         * What goes in the file. `matching` — every row the filters and search
         * leave, however many pages that is, which is the default. `page` —
         * only what is on screen.
         */
        scope?: "matching" | "page"
        /**
         * Fetches the rows to export — the answer for server-side data, where
         * the table holds one page. You do the query; it writes the file.
         */
        fetchRows?: (state: TableState) => readonly TRow[] | Promise<readonly TRow[]>
        /** Takes over the export entirely, file and all. */
        onExport?: (state: TableState, rows: readonly TRow[]) => void
      }

  types?: Record<string, TypeDef>
  format?: Partial<FormatContext>
  density?: Density
  /** Offer the row-height switch in the toolbar. Defaults to false. */
  densityControl?: boolean
  responsive?: "scroll" | "cards"
  stickyHeader?: boolean
  maxHeight?: number | string
  /**
   * How tall a row is: `"fixed"` (the default), `"auto"`, or a number of
   * pixels. `"auto"` and a number both let cells wrap; `"auto"` grows the row
   * to fit its tallest cell, a number gives them all that height and ends what
   * will not fit in an ellipsis.
   */
  rowHeight?: RowHeight
  theme?: "light" | "dark"

  rowHref?: (row: TRow) => string
  onRowClick?: (row: TRow, event: MouseEvent) => void
  rowClassName?: (row: TRow, index: number) => string | undefined

  /** Replaces the "nothing here" state. */
  emptyState?: Node | string
  /** Text for the default empty state. */
  emptyMessage?: string
  /** Extra controls in the toolbar, beside search and columns. */
  toolbar?: Node | string
  /** A row pinned below the last one — an "add another" affordance, a total. */
  appendRow?: Node | string
  /** Content below the table, inside the frame. */
  footer?: Node | string

  /**
   * Renders every control that changes the view as a link to this URL instead
   * of a button.
   *
   * With it, a server-rendered table sorts, pages and hides columns with no
   * client JavaScript at all — the server re-renders from the query string.
   * Pair it with `renderToString` on the server and `stateFromUrl` for the
   * state. The menus still need JavaScript to open, so this is progressive
   * enhancement: the header sorts and the pagination pages before the script
   * arrives, and everything else improves once it has.
   */
  buildHref?: (state: TableState) => string
  /**
   * Fires when one of the table's own links — a sort header, a page, a menu
   * action — is clicked plainly, with the URL it points at. The default is
   * prevented, so hand the URL to your router for a client-side navigation.
   * A click with a modifier held, or with the middle button, is left to the
   * browser. The framework-neutral counterpart of React's `linkComponent`.
   */
  onNavigate?: (href: string, event: MouseEvent) => void

  /** Added to the root element. */
  className?: string
  /** Added per slot, on top of the defaults. */
  classNames?: Partial<TableSlots>
  /** Drops the default classes so your own styling is the only styling. */
  unstyled?: boolean

  /** A visible caption above the table. */
  caption?: string
  /** Describes the table to a screen reader. Use it, or `caption`. */
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
  const host = typeof target === "string" ? currentDocument().querySelector<HTMLElement>(target) : target
  if (!host) throw new Error(`Trapezium: no element matched ${String(target)}`)

  let settings = options
  let state: TableState = {
    ...DEFAULT_STATE,
    ...paginationOf(options)?.stateDefaults,
    ...options.defaultState,
    ...options.state,
  }
  let lastSelection = state.selection.join(",")

  /*
    What the person did to the server markup before this script arrived.

    A checkbox is a checkbox with or without JavaScript: tick one on the
    server-rendered table and it shows ticked. Type into the search box and the
    text is there. Throwing that away when the live table takes over would be
    the one visible seam in server rendering, so it is read off the old markup
    first and folded into the state the live table starts from.
  */
  const adopted = readInteractions(host)

  /*
    What the body is currently showing.

    Kept so that a render which only adds rows to the end can add them, rather
    than building the table again from nothing.

    That is the shape of every append-paginated table: an infinite list holds
    every page loaded so far, so reaching the sentinel on page ten meant
    rebuilding two hundred and fifty rows to show twenty-five new ones — every
    cell formatted again, every element allocated again, every open menu and
    every focused control thrown away, and a scroll position that lands
    wherever the browser puts it. The new rows are the only new work there is.

    `renderedRows` holds the row objects rather than their ids, because a
    caller who replaced a row's contents but kept its id has changed what the
    cells should say. Identity is the signal, which is the same contract every
    memoising renderer works by.
  */
  let renderedRows: readonly TRow[] = []
  let renderedIds: string[] = []
  /** Of those, the ones that may be selected — what the header checkbox and a shift-range act on. */
  let renderedSelectable: readonly string[] = []
  /**
   * The `<tr>` for each of those, in order.
   *
   * Held rather than read back off the body, because the body is not only
   * rows: an error renders a row of its own above them, and counting children
   * would then be off by one for every row beneath it.
   */
  let renderedNodes: HTMLElement[] = []
  let renderedSelection = new Set<string>()
  let renderedShape = ""
  /** Bumped by `setOptions`, so a change to columns, types or renderers rebuilds. */
  let generation = 0
  let selectAllBox: HTMLInputElement | undefined

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
  const caption = el("caption", { class: "tpz-caption" })
  const head = el("thead", { class: "tpz-thead" })
  const body = el("tbody", { class: "tpz-tbody" })
  const footer = el("div", { class: "tpz-footer" })
  const paginationBar = el("div", { class: "tpz-pagination" })

  toolbarStart.append(count, chips)
  toolbar.append(toolbarStart, toolbarEnd)
  table.append(head, body)
  scroll.append(table)
  frame.append(toolbar, scroll, footer, paginationBar)
  root.append(frame)

  /*
    Whatever the host already holds is server-rendered markup for this table —
    `renderToString` writes the same bytes this render produces, so swapping
    the one for the other moves nothing on screen. An empty host is the plain
    case, and the table is simply added to it.
  */
  if (host.childNodes.length > 0) host.replaceChildren(root)
  else host.append(root)

  /* ── Toolbar, built once so the search box keeps focus ─────────────────── */

  let searchInput: HTMLInputElement | undefined
  let searchTimer: ReturnType<typeof setTimeout> | undefined

  function buildToolbar() {
    fill(toolbarEnd, [])
    searchInput = undefined

    // The caller's controls come first, as they do in every other adapter.
    if (settings.toolbar) toolbarEnd.append(settings.toolbar)

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

      searchInput.addEventListener("keydown", (event) => {
        // Enter applies without waiting out the debounce; Escape clears.
        if (event.key === "Enter") {
          clearTimeout(searchTimer)
          update(setSearch(state, searchInput?.value ?? ""))
        }
        if (event.key === "Escape" && searchInput?.value) {
          event.stopPropagation()
          clearTimeout(searchTimer)
          searchInput.value = ""
          update(setSearch(state, ""))
        }
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

    if (settings.densityControl) {
      const button = el("button", {
        type: "button",
        class: "tpz-btn tpz-btn-icon",
        "aria-label": "Row height",
        "aria-haspopup": "true",
      })
      const glyph = icon("longText")
      if (glyph) button.append(glyph)

      button.addEventListener("click", () => {
        const choices: Array<[Density, string]> = [
          ["compact", "Compact"],
          ["normal", "Normal"],
          ["relaxed", "Relaxed"],
        ]

        openMenuAt({ anchor: button, align: "end", label: "Row height", theme: settings.theme }, (close) =>
          choices.map(([value, label]) =>
            menuItem(
              label,
              () => {
                close()
                update(setDensity(state, value))
              },
              // A tick beside the current one, and a gap where the tick would
              // be beside the others, so the labels stay in one column.
              { icon: (settings.density ?? state.density) === value ? icon("check") : undefined },
            ),
          ),
        )
      })

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
              const { rows, matched, columns } = current()
              // Everything the filters and search leave, not the page on
              // screen: an export of twenty-five of four hundred rows is not
              // an export, and nobody notices until the spreadsheet is wrong.
              const onHand = config.scope === "page" ? rows : matched
              close()

              void (async () => {
                /*
                  A selection wins over everything matched, for the file as
                  for the clipboard. The selected rows are usually on hand;
                  only when some are not — a server-side table whose selection
                  spans pages — or when nothing is selected and the caller can
                  see more than this page, are the caller's rows asked for.
                */
                const fetchRows = config.fetchRows ?? source()?.all
                if (!fetchRows && settings.server && !config.onExport) warnAboutServerExport()
                const chosen = rowsToExport(onHand, state.selection, settings.getRowId)
                const exported =
                  fetchRows && !chosen.complete
                    ? rowsToExport(await fetchRows(state), state.selection, settings.getRowId).rows
                    : chosen.rows

                if (config.onExport) {
                  config.onExport(state, exported)
                  return
                }

                downloadText(
                  toCsv(exported, { columns, types: registry(), format: formatting(), getRowId: settings.getRowId }),
                  `${config.filename ?? "table"}.csv`,
                )
              })()
            },
            { icon: icon("download") },
          ),
          config.clipboard === false ? null : menuItem(
            "Copy to clipboard",
            () => {
              const { rows, matched, columns } = current()
              const exported = config.scope === "page" ? rows : matched

              // The selection when there is one, and only what is on hand:
              // the clipboard has to be written inside the click, so there is
              // no room to fetch.
              const chosen = rowsToExport(exported, state.selection, settings.getRowId).rows

              void copyText(
                toDelimitedText(chosen, {
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
      toolbarEnd.childNodes.length === 0 && state.filters.length === 0 ? "none" : ""
  }

  /* ── Model ─────────────────────────────────────────────────────────────── */

  /** Selection as configured, with the mode decided. Undefined when it is off. */
  function selectionOf(): ResolvedSelection<TRow> | undefined {
    return resolveSelection(settings.selection, settings.onSelectionChange)
  }

  /** How each slot is classed, after the caller's additions. */
  function classes() {
    return createClasses(settings.classNames, settings.unstyled)
  }

  /** Where server-side answers come from, if the caller said. */
  function source(): ServerSource<TRow> | undefined {
    return typeof settings.server === "object" ? settings.server : undefined
  }

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
      server: Boolean(settings.server),
      serverDistinct: Boolean(source()?.distinct),
      total: settings.total,
      accumulate: pagination?.mode === "infinite" || pagination?.mode === "loadMore",
    })

    return { columns: visible, hidden, pagination, ...result }
  }

  function update(next: TableState) {
    state = next
    render()
    notify()
  }

  /** Tells the caller about the state, and about the selection if it moved. */
  function notify() {
    settings.onStateChange?.(state)

    const key = state.selection.join(",")
    if (key !== lastSelection) {
      lastSelection = key
      const { rows } = current()
      const byId = new Map(rows.map((row, index) => [resolveRowId(row, index, settings.getRowId), row]))
      selectionOf()?.onChange?.(
        state.selection,
        state.selection.map((id) => byId.get(id)).filter((row): row is TRow => row !== undefined),
      )
    }
  }

  /** Folds what was done to the server markup into the starting state. */
  function adoptInteractions(): boolean {
    if (!adopted) return false
    const before = state

    // The boxes were in the server's row order, so they are matched against
    // the rows as the server had them — before any search typed since applies.
    const { rows } = current()
    const ids = rows.map((row, index) => resolveRowId(row, index, settings.getRowId))
    const selection = selectionOf()

    if (selection) {
      if (adopted.header !== undefined && selection.mode === "multiple") {
        state = setSelected(state, selectableIds(rows, ids, selection.isSelectable), adopted.header)
      }
      for (const { index, checked } of adopted.toggled) {
        const id = ids[index]
        if (id === undefined) continue
        if (selection.isSelectable && !selection.isSelectable(rows[index]!, index)) continue
        if (selection.mode === "single") {
          state = { ...state, selection: checked ? [id] : state.selection.filter((entry) => entry !== id) }
        } else {
          state = setSelected(state, [id], checked)
        }
      }
    }

    if (adopted.search !== undefined && settings.search) state = setSearch(state, adopted.search)

    return state !== before
  }

  // Shift-click selects a range, which is the one selection gesture people
  // expect from a table and almost never get.
  let lastToggled: string | undefined

  /* ── Render ────────────────────────────────────────────────────────────── */

  function render() {
    const { columns, hidden, rows, total, pageCount, filtered, pagination } = current()
    const types = registry()
    const format = formatting()
    const cls = classes()
    const selection = selectionOf()
    const selectionMode = selection?.mode
    const columnCount = columns.length + (selectionMode ? 1 : 0)
    const rowIds = rows.map((row, index) => resolveRowId(row, index, settings.getRowId))
    const selectable = selectableIds(rows, rowIds, selection?.isSelectable)

    root.className = cls("root", settings.className)
    frame.className = cls("frame")
    toolbar.className = cls("toolbar")
    scroll.className = cls("scroll")
    table.className = cls("table")
    head.className = cls("thead")
    body.className = cls("tbody")
    footer.className = cls("footer")
    paginationBar.className = cls("pagination")

    root.dataset["density"] = settings.density ?? state.density
    root.dataset["responsive"] = settings.responsive ?? "scroll"
    if (settings.theme) root.dataset["theme"] = settings.theme
    else delete root.dataset["theme"]
    if (settings.stickyHeader !== false) root.dataset["stickyHeader"] = "true"
    else delete root.dataset["stickyHeader"]
    if (settings.loading) root.dataset["loading"] = "true"
    else delete root.dataset["loading"]
    if (settings.maxHeight !== undefined) {
      root.style.setProperty(
        "--tpz-max-height",
        typeof settings.maxHeight === "number" ? `${String(settings.maxHeight)}px` : settings.maxHeight,
      )
    } else {
      root.style.removeProperty("--tpz-max-height")
    }

    /*
      Both modes wrap; a number additionally pins the height and clips, so it
      is a mode of its own rather than only a different value for the token.
    */
    if (settings.rowHeight === "auto") root.dataset["rowHeight"] = "auto"
    else if (typeof settings.rowHeight === "number") root.dataset["rowHeight"] = "exact"
    else delete root.dataset["rowHeight"]

    if (typeof settings.rowHeight === "number") {
      root.style.setProperty("--tpz-row-height", `${String(settings.rowHeight)}px`)
    } else {
      root.style.removeProperty("--tpz-row-height")
    }

    if (settings.ariaLabel) table.setAttribute("aria-label", settings.ariaLabel)
    else table.removeAttribute("aria-label")

    if (settings.caption) {
      caption.textContent = settings.caption
      if (!table.contains(caption)) table.prepend(caption)
    } else {
      caption.remove()
    }

    if (settings.footer) {
      fill(footer, [settings.footer])
      if (!frame.contains(footer)) paginationBar.before(footer)
    } else {
      footer.remove()
    }

    count.textContent =
      state.selection.length > 0
        ? `${state.selection.length.toLocaleString()} selected`
        : `${total.toLocaleString()} ${total === 1 ? "row" : "rows"}`

    renderChips(columns)

    const shape = shapeOf(columns, selection)
    const build: RowBuild = { columns, types, format, cls, selection, pinEdges: pinEdgesOf(columns) }

    /*
      The cheap path.

      Nothing about the arrangement changed and the rows on screen are still
      the first however-many of the rows to show, so the difference between
      the two renders is entirely at the end of the list. Build that, and
      leave the rest of the DOM alone — which also leaves alone the header's
      focus, the browser's scroll anchoring, and any text the user had
      selected.
    */
    if (shape === renderedShape && renderedRows.length > 0 && extendsRendered(rows)) {
      if (rows.length > renderedRows.length) {
        const offsets = measurePinOffsets()
        const batch = fragment()
        const added: HTMLElement[] = []

        for (let index = renderedRows.length; index < rows.length; index += 1) {
          const tr = buildRow(rows[index]!, rowIds[index]!, index, build)
          added.push(tr)
          batch.append(tr)
        }

        // Positioned before they are in the document, so a frozen column does
        // not spend a frame in the wrong place.
        applyPinOffsets(batch, offsets)

        // After the last data row rather than at the end of the body: a
        // caller's appended row sits below the data and must stay there.
        const last = renderedNodes[renderedNodes.length - 1]
        if (last) last.after(batch)
        else body.append(batch)

        renderedNodes.push(...added)
        renderedRows = rows
        renderedIds = rowIds
        renderedSelectable = selectable
      }

      syncSelection()
      renderPagination(pagination, total, pageCount, rows.length)
      void hidden
      return
    }

    /* Header */
    const headerRow = el("tr", { class: cls("headerRow") })
    if (selectionMode) headerRow.append(selectionHeader(selectionMode))
    for (const column of columns) headerRow.append(headerCell(column, columns, cls))
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
      rendered.push(
        el("tr", { class: "tpz-sr" }, [
          el("td", { colspan: columnCount, "aria-live": "polite", text: "Loading rows" }),
        ]),
      )
    }

    if (settings.error) {
      rendered.push(
        el("tr", {}, [
          el("td", { class: "tpz-td", colspan: columnCount, "data-wrap": "true" }, [
            el("div", { class: cls("empty"), "data-tone": "danger", role: "alert" }, [
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
            settings.emptyState ??
              el("div", { class: cls("empty") }, [
                icon("empty", 22, "tpz-state-icon"),
                filtered ? "No rows match" : (settings.emptyMessage ?? "Nothing to show"),
              ]),
          ]),
        ]),
      )
    }

    const nodes = rows.map((row, index) => buildRow(row, rowIds[index]!, index, build))
    rendered.push(...nodes)

    if (settings.appendRow) {
      rendered.push(
        el("tr", { class: cls("row") }, [el("td", { class: "tpz-td", colspan: columnCount }, [settings.appendRow])]),
      )
    }

    fill(body, rendered)

    renderedRows = rows
    renderedIds = rowIds
    renderedSelectable = selectable
    renderedNodes = nodes
    renderedSelection = new Set(state.selection)
    renderedShape = shape
    syncSelectAll()

    applyPinOffsets()
    renderPagination(pagination, total, pageCount, rows.length)
    void hidden
  }

  /** Everything a row is built from that is not the row itself. */
  type RowBuild = {
    columns: ResolvedColumn<TRow, Node | string>[]
    types: ReturnType<typeof createTypeRegistry>
    format: FormatContext
    cls: ReturnType<typeof classes>
    selection: ResolvedSelection<TRow> | undefined
    /** Keys of the last pinned column on each side, which carry the frozen edge. */
    pinEdges: Set<string>
  }

  /** One row, built the same way whether the body is being filled or extended. */
  function buildRow(row: TRow, id: string, index: number, build: RowBuild): HTMLElement {
    const { columns, types, format, cls, selection, pinEdges } = build
    const selectionMode = selection?.mode
    const selected = state.selection.includes(id)
    const tr = el("tr", {
      class: cls("row", settings.rowClassName?.(row, index)),
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
      // The attribute as well as the property, so a server render — which can
      // only write attributes — says the same thing as the live table.
      box.defaultChecked = selected
      box.checked = selected
      box.disabled = selection?.isSelectable ? !selection.isSelectable(row, index) : false

      // The change event does not carry the modifier keys; the click before
      // it does, so that is where shift is read.
      let shift = false
      box.addEventListener("click", (event) => {
        event.stopPropagation()
        shift = event.shiftKey
      })
      box.addEventListener("change", () => {
        if (shift && lastToggled !== undefined && selectionMode !== "single") {
          /*
            Over the selectable rows on screen *now*, not the ones there when
            this row was built. An appended page leaves the earlier rows and
            their handlers in place, and a range has to be able to reach the
            rows that arrived after them. Disabled rows in between are stepped
            over rather than swept up.
          */
          update(selectRange(state, renderedSelectable, lastToggled, id, !state.selection.includes(id)))
          return
        }
        lastToggled = id
        update(toggleSelection(state, id, selectionMode === "single"))
      })
      tr.append(el("td", { class: cls("selectCell"), "data-pin": "start", "data-key": "__select" }, [box]))
    }

    columns.forEach((column, columnIndex) => {
      const context = cellContext(row, id, index, column, types, format)
      const content = renderCell(context, settings)
      const cell = el("td", {
        class: cls("cell", column.className),
        "data-align": column.align,
        "data-mono": column.mono ? undefined : "false",
        "data-wrap": wrapAttribute(column.wrap),
        "data-pin": column.pin,
        "data-pin-edge": pinEdges.has(column.key) ? column.pin : undefined,
        "data-key": column.key,
        "data-label": column.header,
      })
      if (column.width) cell.style.width = `${String(column.width)}px`

      const node = typeof content === "string" ? text(content) : content

      /*
        A table cell has to go on being a table cell, so anything that bounds
        its content needs an element of its own inside it: `-webkit-box` for a
        line clamp, and a plain block for an exact row height, whose cap
        `height` alone cannot enforce.
      */
      let host: Node = cell
      if (typeof column.wrap === "number") {
        const clamp = el("span", { class: "tpz-clamp" })
        clamp.style.setProperty("--tpz-cell-lines", String(column.wrap))
        cell.append(clamp)
        host = clamp
      } else if (typeof settings.rowHeight === "number") {
        const fit = el("span", { class: "tpz-fit" })
        cell.append(fit)
        host = fit
      }

      if (columnIndex === 0 && settings.rowHref) {
        const link = el("a", { class: "tpz-link tpz-lead", href: settings.rowHref(row) })
        link.append(node)
        host.appendChild(link)
      } else {
        host.appendChild(node)
      }

      tr.append(cell)
    })

    return tr
  }

  /**
   * True when the rows to show start with exactly the rows already on screen.
   *
   * By identity, not by id: a caller who swapped a row for a new object with
   * the same id has changed what its cells say, and that is a rebuild.
   */
  function extendsRendered(rows: readonly TRow[]): boolean {
    if (rows.length < renderedRows.length) return false
    for (let index = 0; index < renderedRows.length; index += 1) {
      if (renderedRows[index] !== rows[index]) return false
    }
    return true
  }

  /**
   * Everything about a render other than which rows are in it.
   *
   * If this is unchanged, a row built now is identical to the one built last
   * time, so rows that were already there do not need building again. It has
   * to name everything `buildRow` and the header read — a missing field here
   * is a cell that quietly stops updating, which is the worst kind of bug to
   * find later, so it errs towards rebuilding.
   */
  function shapeOf(
    columns: ResolvedColumn<TRow, Node | string>[],
    selection: ResolvedSelection<TRow> | undefined,
  ): string {
    return JSON.stringify({
      generation,
      selectionMode: selection?.mode ?? null,
      selectable: Boolean(selection?.isSelectable),
      // Only the skeleton, which needs an empty body, depends on loading —
      // and the cheap path never runs with an empty body.
      error: settings.error ?? null,
      classNames: settings.classNames ?? null,
      unstyled: Boolean(settings.unstyled),
      appendRow: Boolean(settings.appendRow),
      href: Boolean(settings.rowHref),
      click: Boolean(settings.onRowClick),
      rowClass: Boolean(settings.rowClassName),
      // `buildRow` puts a bounding element in every cell for an exact height.
      fit: typeof settings.rowHeight === "number",
      format: settings.format ?? null,
      sort: state.sort,
      filters: state.filters,
      match: state.match,
      search: state.search,
      pageSize: state.pageSize,
      columns: columns.map((column) => [
        column.key,
        column.header,
        column.type,
        column.align,
        column.mono,
        column.wrap ?? null,
        column.pin ?? null,
        column.width ?? null,
        column.className ?? null,
        column.sortable,
      ]),
    })
  }

  /**
   * Brings the rows on screen into line with the selection, touching only the
   * ones whose answer changed.
   *
   * Selecting a row in a list of five thousand is otherwise a full rebuild for
   * the sake of one attribute and one checkbox.
   */
  function syncSelection() {
    const selection = new Set(state.selection)
    const changed = new Set<string>()

    for (const id of selection) if (!renderedSelection.has(id)) changed.add(id)
    for (const id of renderedSelection) if (!selection.has(id)) changed.add(id)

    if (changed.size > 0) {
      renderedIds.forEach((id, index) => {
        if (!changed.has(id)) return

        const tr = renderedNodes[index]
        if (!tr) return

        const selected = selection.has(id)
        if (selected) tr.dataset["selected"] = "true"
        else delete tr.dataset["selected"]

        const box = tr.querySelector<HTMLInputElement>("input.tpz-checkbox")
        if (box) box.checked = selected
      })
    }

    renderedSelection = selection
    syncSelectAll()
  }

  /** The header checkbox, after the rows or the selection beneath it moved. */
  function syncSelectAll() {
    if (!selectAllBox) return

    const selectedHere = renderedSelectable.filter((id) => state.selection.includes(id)).length
    const all = renderedSelectable.length > 0 && selectedHere === renderedSelectable.length

    selectAllBox.defaultChecked = all
    selectAllBox.checked = all
    selectAllBox.indeterminate = selectedHere > 0 && !all
    selectAllBox.setAttribute("aria-label", all ? "Clear selection" : "Select all rows on this page")
  }

  /**
   * Hands a plain click on one of the table's links to `onNavigate`, when the
   * caller gave one. Anything else — a modifier, the middle button — is the
   * browser's, so a new tab still opens.
   */
  function routed<T extends HTMLElement>(link: T): T {
    link.addEventListener("click", (event) => {
      const onNavigate = settings.onNavigate
      if (!onNavigate || !isPlainLinkClick(event, link.getAttribute("target"))) return
      event.preventDefault()
      onNavigate(link.getAttribute("href") ?? "", event)
    })
    return link
  }

  /** Frozen columns need real pixel offsets, and only layout knows them. */
  function measurePinOffsets(): Record<string, number> {
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

    return offsets
  }

  /**
   * Writes those offsets onto the cells under `scope`.
   *
   * Taking a scope is what lets an appended page position its own frozen
   * columns without walking every row already on screen — which, on the tenth
   * page of an infinite list, is the difference between touching twenty-five
   * rows and touching two hundred and fifty.
   */
  function applyPinOffsets(scope: ParentNode = root, offsets = measurePinOffsets()) {
    /*
      Matched by reading the attribute rather than by building a selector from
      it: a column key can contain a dot (`customer.name`), and `CSS.escape`
      is not available everywhere the core is — including some test
      environments.
    */
    for (const cell of scope.querySelectorAll<HTMLElement>("[data-pin][data-key]")) {
      const offset = offsets[cell.dataset["key"] ?? ""]
      if (offset === undefined) continue
      cell.style[cell.dataset["pin"] === "end" ? "right" : "left"] = `${String(offset)}px`
    }
  }

  /**
   * The header cell above the checkboxes.
   *
   * It reads the selectable rows on screen when it is clicked rather than
   * when it was built. The header outlives the body now — an appended page
   * leaves it exactly where it was — so a handler that closed over the rows
   * it was built with would go on selecting page one after page four arrived.
   */
  function selectionHeader(mode: "single" | "multiple"): HTMLElement {
    const cell = el("th", {
      scope: "col",
      class: "tpz-th tpz-select-cell",
      "data-pin": "start",
      "data-key": "__select",
    })

    selectAllBox = undefined
    if (mode !== "multiple") return cell

    const box = el("input", {
      type: "checkbox",
      class: "tpz-checkbox",
    }) as HTMLInputElement

    box.addEventListener("change", () => {
      const ids = [...renderedSelectable]
      const selectedHere = ids.filter((id) => state.selection.includes(id)).length
      update(setSelected(state, ids, !(ids.length > 0 && selectedHere === ids.length)))
    })

    cell.append(box)
    selectAllBox = box
    return cell
  }

  function headerCell(
    column: ResolvedColumn<TRow, Node | string>,
    columns: ResolvedColumn<TRow, Node | string>[],
    cls: ReturnType<typeof classes>,
  ): HTMLElement {
    const sort = state.sort.find((entry) => entry.key === column.key)
    const filter = state.filters.find((entry) => entry.key === column.key)
    const sortable = settings.sortable !== false && column.sortable
    const keys = columns.map((entry) => entry.key)

    const cell = el("th", {
      scope: "col",
      class: cls("headerCell", column.headerClassName),
      "data-align": column.align,
      "data-pin": column.pin,
      "data-pin-edge": isPinEdge(columns, column.key) ? column.pin : undefined,
      "data-key": column.key,
      "data-filtered": filter ? "true" : undefined,
      "aria-sort": sort ? (sort.direction === "asc" ? "ascending" : "descending") : "none",
    })
    if (column.width) cell.style.width = `${String(column.width)}px`
    if (column.minWidth) cell.style.minWidth = `${String(column.minWidth)}px`
    if (column.maxWidth) cell.style.maxWidth = `${String(column.maxWidth)}px`

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

    const labelChildren = [
      el("span", { class: "tpz-th-label", text: column.header }),
      sort ? icon(sort.direction === "asc" ? "sortAscending" : "sortDescending", 12, "tpz-th-marker") : null,
    ]

    // The class goes on the anchor itself rather than on a span inside it, or
    // the browser's own link styling underlines every column header.
    //
    // A link is draggable on its own — the browser lets a person drag a URL
    // to another tab or the desktop — and inside a draggable header that
    // native drag wins, because a drag starts at the innermost draggable
    // element. The header's handlers still fire as it bubbles, so the drop
    // indicator moves as if a column were coming, but what lands is a URL and
    // the browser opens it. Turning the link's own drag off lets the header
    // be the thing that is dragged.
    const label =
      sortable && settings.buildHref
        ? routed(
            el(
              "a",
              {
                href: settings.buildHref(toggleSort(state, column.key)),
                class: "tpz-th-button",
                "aria-label": `Sort by ${column.header}`,
                draggable: "false",
              },
              labelChildren,
            ),
          )
        : el(sortable ? "button" : "span", { class: "tpz-th-button", type: sortable ? "button" : undefined }, labelChildren)
    if (sortable && !settings.buildHref) label.addEventListener("click", () => update(toggleSort(state, column.key)))
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
      inner.append(resizeHandle(cell, column))
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

  const distinctProviders = new Map<string, () => Promise<SelectOption[]>>()

  function distinctProvider(key: string): (() => Promise<SelectOption[]>) | undefined {
    const ask = source()?.distinct
    if (!ask) return undefined

    let provider = distinctProviders.get(key)
    if (!provider) {
      provider = async () => {
        // Read when it runs, so a fetch reflects the filters in force at that
        // moment rather than the ones in force when it was bound.
        return toSelectOptions(await ask(key, state))
      }
      distinctProviders.set(key, provider)
    }
    return provider
  }

  function resizeHandle(cell: HTMLElement, column: ResolvedColumn<TRow, Node | string>): HTMLElement {
    const key = column.key
    const handle = el("button", { type: "button", class: "tpz-resizer", "aria-label": `Resize ${column.header}` })

    // A double-click forgets the dragged width, so the column sizes itself again.
    handle.addEventListener("dblclick", () => update(clearWidth(state, key)))

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
    const sort = state.sort.find((entry) => entry.key === column.key)

    openMenuAt({ anchor, label: `${column.header} column`, theme: settings.theme }, (close) => {
      const items: Array<Node | null> = []

      /**
       * An action that changes the view: a link when the table has URLs, a
       * button otherwise — the same choice the React adapter makes.
       */
      const action = (label: string, next: TableState, glyph: Node | null) =>
        settings.buildHref
          ? routed(menuLink(label, settings.buildHref(next), { icon: glyph }))
          : menuItem(label, () => {
              update(next)
              close()
            }, { icon: glyph })

      if (settings.sortable !== false && column.sortable) {
        items.push(
          action("Sort ascending", { ...state, sort: [{ key: column.key, direction: "asc" }], page: 1 }, icon("sortAscending")),
          action("Sort descending", { ...state, sort: [{ key: column.key, direction: "desc" }], page: 1 }, icon("sortDescending")),
          sort ? action("Clear sort", { ...state, sort: [] }, icon("close")) : null,
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
        action("Hide column", hideColumn(state, column.key), icon("eyeOff")),
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
      // Labelled the way the column labels its cells, so a set filter offers
      // "Blocker" rather than "blocker" — including for a custom type, whose
      // formatter is the only thing that knows the difference.
      const label = (value: unknown) =>
        formatWithType(registry().get(column.type), value, { ...formatting(), ...column.formatOptions })

      /*
        Three places choices can come from, in order of how much they know: the
        column's own list (or one it fetches), the labels it renders cells with,
        and — failing both — the values in the data, which is everything in
        client mode and one page in server mode.
      */
      const fromData = () =>
        distinctValues(settings.data.map((row) => column.accessor(row))).map((entry) => ({
          value: entry.value,
          label: label(entry.value) || entry.value,
        }))

      const asChoices = (options: readonly SelectOption[]) =>
        options.map((option) => ({ value: option.value, label: option.label ?? option.value }))

      /*
        A set-filter column with nothing of its own asks the server, if the
        table was told how to ask. Bound per column and remembered by identity,
        so the panel fetches once and reopening it is free.
      */
      const asking = column.filterOptions ?? distinctProvider(column.key)

      const given = Array.isArray(asking)
        ? asking
        : asking === undefined
          ? column.formatOptions?.options
          : rememberedOptions.get(asking)

      let choices = given?.length ? asChoices(given) : fromData()

      /*
        A column whose choices are fetched: asked for once, remembered against
        the function itself, so opening the panel again is free.
      */
      if (typeof asking === "function" && !rememberedOptions.has(asking)) {
        const provider = asking
        choices = []

        void Promise.resolve(provider())
          .then((options) => {
            const fetched = toSelectOptions(options)
            rememberedOptions.set(provider, fetched)
            choices = asChoices(fetched)
            note.textContent = ""
            draw(searchBox?.value ?? "")
          })
          .catch(() => {
            // Left unremembered, so opening the panel again tries once more.
            note.textContent = "Could not load the values"
            note.style.display = ""
          })
      }

      const chosen = new Set(
        filter && Array.isArray(filter.value)
          ? filter.value.map(String)
          : filter?.value !== undefined
            ? [String(filter.value)]
            : [],
      )

      const list = el("div", { class: "tpz-menu-scroll tpz-filter-list" })
      const note = el("p", { class: "tpz-menu-label" })
      let searchBox: HTMLInputElement | undefined

      /**
       * Draws the choices matching what has been typed.
       *
       * Filtered over every distinct value and then cut down to what is worth
       * drawing. Cutting the other way round — capping the list and searching
       * the cap — is what makes a rare value impossible to find, which is the
       * one thing a set filter must never do.
       */
      const draw = (query: string) => {
        const needle = query.trim().toLowerCase()
        const matching = needle
          ? choices.filter(
              (choice) =>
                choice.label.toLowerCase().includes(needle) || choice.value.toLowerCase().includes(needle),
            )
          : choices

        const visible = matching.slice(0, RENDER_LIMIT)
        const nodes: Node[] = []

        if (visible.length === 0) {
          const pending = typeof asking === "function" && !rememberedOptions.has(asking)
          nodes.push(el("p", { class: "tpz-menu-label", text: pending ? "Loading values…" : "No values" }))
        }

        for (const choice of visible) {
          const box = el("input", { type: "checkbox", class: "tpz-checkbox" }) as HTMLInputElement
          box.checked = chosen.has(choice.value)
          box.addEventListener("change", () => {
            if (box.checked) chosen.add(choice.value)
            else chosen.delete(choice.value)

            if (chosen.size === 0) onClear()
            else onApply({ key: column.key, operator: chosen.size === 1 ? "eq" : "in", value: [...chosen] })
          })

          nodes.push(
            el("label", { class: "tpz-filter-option" }, [
              box,
              el("span", { class: "tpz-filter-option-label", text: choice.label }),
            ]),
          )
        }

        fill(list, nodes)

        const hidden = matching.length - visible.length
        note.textContent = hidden > 0 ? `${hidden.toLocaleString()} more — keep typing to narrow them down` : ""
        note.style.display = hidden > 0 ? "" : "none"
      }

      // The same threshold as the other adapters: a panel's worth fits without
      // one, and anything more wants a way to be narrowed.
      if (choices.length > 8 || typeof asking === "function") {
        searchBox = el("input", {
          class: "tpz-input",
          type: "search",
          "aria-label": `Search ${column.header} values`,
          placeholder: "Search values",
        }) as HTMLInputElement
        searchBox.addEventListener("input", () => draw(searchBox?.value ?? ""))
        wrap.append(searchBox)
      }

      draw("")
      wrap.append(list, note)
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

    if (state.filters.length > 1) {
      // Reads as the rule being applied, not as a setting to decode.
      const match = el("button", { type: "button", class: "tpz-btn", text: state.match === "all" ? "Match all" : "Match any" })
      match.addEventListener("click", () => update(setMatch(state, state.match === "all" ? "any" : "all")))
      nodes.push(match)
    }

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
    sentinel.remove()

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
      // Chosen by attribute rather than by setting `value`, so the markup
      // carries the choice — a server render has nothing else.
      const select = el(
        "select",
        { class: "tpz-input" },
        pagination.pageSizeOptions.map((size) =>
          el("option", { value: size, text: `${String(size)} per page`, selected: size === state.pageSize }),
        ),
      ) as HTMLSelectElement
      select.addEventListener("change", () => update(setPageSize(state, Number(select.value))))

      start.append(
        el("label", { class: "tpz-count" }, [el("span", { class: "tpz-sr", text: "Rows per page" }), select]),
      )
    }

    const nav = el("nav", { class: "tpz-pages", "aria-label": "Pagination" })

    const pageButton = (page: number, label: string, content: Node | string, disabled = false, isCurrent = false) => {
      // A real link when the table has URLs, so paging works before any script
      // arrives and middle-click opens a page in a new tab.
      if (settings.buildHref && !disabled) {
        return routed(
          el("a", {
            href: settings.buildHref(setPage(state, page)),
            class: "tpz-btn tpz-page",
            "aria-label": label,
            "aria-current": isCurrent ? "page" : undefined,
          }, [content]),
        )
      }

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

    // Present only while infinite scrolling is on, so the markup matches the
    // other adapters exactly — an element nobody else renders is the beginning
    // of four packages drifting into four products.
    if (!scroll.contains(sentinel)) scroll.append(sentinel)

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

  const changed = adoptInteractions()
  buildToolbar()
  render()

  if (adopted?.searchFocused && searchInput) {
    // Back where the person was typing, caret and all.
    searchInput.focus()
    const end = searchInput.value.length
    searchInput.setSelectionRange(end, end)
  }
  if (changed) notify()

  return {
    element: root,
    setData(data) {
      settings = { ...settings, data }
      render()
    },
    setOptions(next) {
      const previous = settings
      settings = { ...settings, ...next }

      /*
        Most of what can change here is not visible from the outside of a
        resolved column — a custom type, a cell renderer, a class map — so a
        changed option makes the next render rebuild rather than trying to work
        out whether it needs to. The exceptions are the options that never reach
        a row's markup. `loading` is the one that matters: flipping it while the
        next page is fetched is how every server-side append works, and the Vue
        and Svelte adapters route it through here, so treating it as a change
        would throw away the rows on screen at exactly the moment the cheap path
        exists for.
      */
      if (changedKeys(next, previous).some((key) => !PASSIVE_OPTIONS.has(key))) generation += 1

      /*
        Two settings also live in the state, which is the table's to change once
        it is running — so they are followed only when the caller changes them,
        rather than being reapplied on every call and undoing what the user
        just did with the page-size picker.
      */
      if (next.state && next.state !== previous.state) state = { ...state, ...next.state }

      const pageSize = paginationOf(settings)?.pageSize
      if (pageSize !== undefined && pageSize !== paginationOf(previous)?.pageSize) {
        // Back to the first page: page four of a twenty-five-row list is not
        // page four of a hundred-row one.
        state = { ...state, pageSize, page: 1 }
      }

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

/** What a person did to server-rendered markup before the script arrived. */
type Interactions = {
  /** The search text, when it is not what the server wrote. */
  search: string | undefined
  searchFocused: boolean
  /** Row checkboxes whose state is not what the server wrote, by row position. */
  toggled: Array<{ index: number; checked: boolean }>
  /** The header checkbox, when it was toggled. */
  header: boolean | undefined
}

/**
 * Reads the interactions off whatever the host holds.
 *
 * A control's default — the attribute the server wrote — against its current
 * state is exactly the record of what was done to it. The selection cells are
 * found by their key rather than a class, which `unstyled` may have removed.
 */
function readInteractions(host: HTMLElement): Interactions | undefined {
  const previous = host.firstElementChild
  if (!previous) return undefined

  const search = previous.querySelector<HTMLInputElement>('input[type="search"]')
  const boxes = [...previous.querySelectorAll<HTMLInputElement>('tbody [data-key="__select"] input')]
  const header = previous.querySelector<HTMLInputElement>('thead [data-key="__select"] input')

  return {
    search: search && search.value !== search.defaultValue ? search.value : undefined,
    searchFocused: search !== null && search === currentDocument().activeElement,
    toggled: boxes.flatMap((box, index) => (box.checked !== box.defaultChecked ? [{ index, checked: box.checked }] : [])),
    header: header && header.checked !== header.defaultChecked ? header.checked : undefined,
  }
}

/**
 * Options that a row's markup never depends on, so changing one of them does
 * not force the rows already on screen to be rebuilt. Anything not listed here
 * is assumed to matter, because a cell that quietly stops updating is the worse
 * failure. `data` is decided by row identity, not by being passed again.
 */
const PASSIVE_OPTIONS: ReadonlySet<string> = new Set([
  "data",
  "defaultState",
  "onNavigate",
  "loading",
  "error",
  "total",
  "state",
  "onStateChange",
  "onSelectionChange",
  "density",
  "densityControl",
  "columnControl",
  "export",
  "search",
  "theme",
  "responsive",
  "stickyHeader",
  "maxHeight",
  "rowHeight",
  "ariaLabel",
  "caption",
  "footer",
  // Read from the settings when the click happens, not when the row was built,
  // and whether there is one at all is part of the shape. The Vue adapter
  // hands over a fresh function on every change, so identity means nothing here.
  "onRowClick",
])

/** The keys whose value is not the one already held, compared by identity. */
function changedKeys<T extends object>(next: Partial<T>, previous: T): string[] {
  const keys: string[] = []
  for (const key in next) {
    if (next[key] !== previous[key]) keys.push(key)
  }
  return keys
}

/** The last pinned column on each side gets the shadow that marks the frozen edge. */
function isPinEdge(columns: ReadonlyArray<{ key: string; pin?: "start" | "end" }>, key: string): boolean {
  return pinEdgesOf(columns).has(key)
}

/** Keys of the last pinned column on each side, worked out once per render rather than per cell. */
function pinEdgesOf(columns: ReadonlyArray<{ key: string; pin?: "start" | "end" }>): Set<string> {
  const starts = columns.filter((column) => column.pin === "start")
  const ends = columns.filter((column) => column.pin === "end")
  const edges = new Set<string>()
  const first = starts[starts.length - 1]?.key
  const last = ends[0]?.key
  if (first) edges.add(first)
  if (last) edges.add(last)
  return edges
}

/**
 * `true` and a line count both mean "wrap"; `false` means "stay on one line
 * even though the table is set to wrap", which is a different thing from
 * saying nothing at all.
 */
function wrapAttribute(wrap: boolean | number | undefined): "true" | "false" | undefined {
  if (wrap === undefined) return undefined
  return wrap === false ? "false" : "true"
}

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

/**
 * Choices fetched on demand, remembered against the function that fetched them.
 *
 * A server-side table cannot know a column's domain — it holds one page — so
 * the caller supplies a function, it is called the first time the panel opens,
 * and opening it again is free. Changing the function fetches afresh.
 */
const rememberedOptions = new WeakMap<object, SelectOption[]>()

/**
 * How many set-filter choices are drawn at once.
 *
 * Enough that a normal column shows all of it, few enough that a column of ten
 * thousand distinct values does not put ten thousand checkboxes in the
 * document. Everything beyond it is still searchable.
 */
const RENDER_LIMIT = 200

/** Which page numbers to show: first, last, the current one and its neighbours. */
/*
  In server mode the table holds one page, so an export can only contain that
  page. The rest are the caller's rows to fetch, and this says where.
*/
let warnedAboutExport = false

function warnAboutServerExport(): void {
  if (warnedAboutExport) return
  if (typeof process !== "undefined" && process.env["NODE_ENV"] === "production") return

  warnedAboutExport = true
  console.warn(
    "[trapezium] Exporting in server mode can only include the rows the table has, which is one " +
      "page. Say where the rest come from — server: { all: (state) => … } — and the table will " +
      "write the file from whatever you fetch. See " +
      "https://github.com/Gregaly/trapezium/blob/main/docs/server-data.md#exporting",
  )
}

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
