import {
  DEFAULT_FORMAT,
  DEFAULT_STATE,
  addSort,
  createPipelineCache,
  warmSearchWhenIdle,
  canResetSort,
  columnSearchText,
  copyText,
  createTypeRegistry,
  defaultTypeRegistry,
  distinctValues,
  downloadText,
  editValuesEqual,
  editorKind,
  editorOptions,
  editorStep,
  fromEditorText,
  hasEditableColumns,
  isCellEditable,
  toEditorText,
  typedCharacter,
  validateEdit,
  entryCell,
  expandableIds,
  focusCell,
  isNavigationKey,
  nextCell,
  INTERACTIVE_SELECTOR,
  isDetailOpen,
  isInteractiveTarget,
  cellDisplayText,
  columnSizing,
  pinWhenToken,
  responsivePinStyles,
  clearSelection,
  rangeSelection,
  startDragSelect,
  applyRowMove,
  canReorderRows,
  moveRowTo,
  startRowDrag,
  stepRow,
  pinnedOffset,
  pinnedRowId,
  setExpanded,
  toggleCollapsed,
  toggleExpanded,
  filterInputType,
  formatWithType,
  getRows,
  hideColumn,
  isEmpty,
  isListOperator,
  moveColumn,
  needsValue,
  rangeFilter,
  optionLabel,
  poof,
  removeFilter,
  removeFilterAt,
  removeSort,
  reorderColumnTo,
  resetSort,
  resolveColumns,
  resolveHeaderSearch,
  resolveRowId,
  resolveSorting,
  rowsToExport,
  setColumnSearch,
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
  sortLevels,
  sortPriority,
  toBoolean,
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
  type CellEdit,
  type CellSizing,
  type ColumnDef,
  type ColumnFilter,
  type Density,
  type DetailOptions,
  type FilterOperator,
  type FormatContext,
  type GetRowId,
  type HeaderSearchOptions,
  type PaginationOptions,
  type PartialTableState,
  type PinnedRows,
  type PinnedSide,
  type ResolvedColumn,
  type ResolvedSelection,
  type RowHeight,
  type RowContextMenuInfo,
  type RowInfo,
  type RowMove,
  type RowReorderOptions,
  type SelectOption,
  type SelectionInput,
  type ServerSource,
  type Sort,
  type SortOptions,
  type TableSlots,
  type TableState,
  type TypeDef,
} from "@trapezium/core"

import { currentDocument, el, fill, fragment, icon, text } from "./dom.js"
import { closeMenu, menuItem, menuLabel, menuLink, menuSeparator, openMenuAt } from "./menu.js"
import { buildComboboxEditor, buildInputEditor, openPopup, type CommitReason, type EditorHandle } from "./editor.js"

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
  /**
   * Search each column from its header, without opening its menu.
   *
   * A magnifier appears in a header on hover and turns it into a text box;
   * what is typed filters that column as "contains", against the text its
   * cells show. `true` switches it on for every column that can be filtered,
   * and the object form sets how long it waits after a keystroke. Off by
   * default — and a single column can opt in or out with its own
   * `headerSearch`, whatever is said here.
   */
  headerSearch?: boolean | HeaderSearchOptions
  /**
   * Column sorting. Defaults to true.
   *
   * A shift-click on a header adds a level to the sort rather than replacing
   * it, and a reset control appears in the toolbar while a sort is applied.
   * Pass an object to change either: `{ multiple: false }` for a backend that
   * orders by one column only, `{ reset: false }` to leave the control out, or
   * `{ reset: [{ key, direction }] }` to name the order the table rests in.
   */
  sortable?: boolean | SortOptions
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
  /**
   * Fires on a click anywhere in the row that was not on a control — a link,
   * a button, an input, a label or a menu inside the row is left to itself.
   */
  onRowClick?: (row: TRow, event: MouseEvent) => void
  /**
   * Fires when a context menu is asked for on a row, with the row and the cell
   * under the pointer — its column and the text it shows. Call
   * `event.preventDefault()` to keep the browser's own menu closed.
   */
  onRowContextMenu?: (row: TRow, event: MouseEvent, info: RowContextMenuInfo<TRow, Node | string>) => void
  /** Extra class names per row. With child rows, `info` says where the row sits. */
  rowClassName?: (row: TRow, index: number, info?: RowInfo) => string | undefined

  /**
   * One level of child rows: the id of the row this one belongs under, or
   * `null`. Children are drawn under their parent with a toggle on the parent
   * that folds them away (`state.collapsed`), stay with it through sorting,
   * filtering and paging — pages and totals count parents — and are selected,
   * edited and exported like any other row, under their parent.
   */
  getParentId?: (row: TRow) => string | null | undefined

  /**
   * Rows held at the top or bottom of the table, outside `data` — an
   * editable "new entry" row, a totals row. Drawn through the same columns,
   * renderers and editors, kept in view while the body scrolls, and never
   * filtered, sorted, paged, counted, selected or exported. An edit of one
   * says so with `edit.pinned`.
   */
  pinnedRows?: PinnedRows<TRow>

  /**
   * Rows moved by hand: a drag handle leads each row, and Alt with the up or
   * down arrow moves the row from the keyboard. The table never reorders
   * `data`: `onReorder` gets the row and its new neighbours, and — if it
   * returns a promise — the new order shows until it settles. Offered only
   * while the table is unsorted; a child moves among its siblings, and a
   * parent takes its children with it.
   */
  rowReorder?: RowReorderOptions<TRow>

  /**
   * Detail rows: content that opens below a row and spans the table's width.
   *
   * An expander column leads the table, with a button per row and one in the
   * header for every row on the page. Which rows are open is
   * `state.expanded`, so it can be controlled, saved, and carried in the URL
   * with `include: ["expanded"]`; a server render shows open rows open. A
   * detail row is never counted, paged, sorted, selected or exported, and is
   * as tall as its content. `render` returns a node or a string.
   */
  detail?: DetailOptions<TRow, Node | string>

  /**
   * Cells the keyboard can move between: the table is one stop in the tab
   * order, and the arrows, Home, End (with Control for the whole table), Page
   * Up and Page Down move from cell to cell. Enter or F2 goes into a cell's
   * link or button and Escape comes back; Space or Enter works the checkbox
   * and the expander. The active cell is `state.focus`, so setting it from
   * outside scrolls to that cell and puts the keyboard there. Off by default,
   * because it makes the table a `role="grid"`; on when a column is editable.
   */
  cellNavigation?: boolean

  /**
   * Receives every committed edit of an `editable` column. The table never
   * changes `data`: update your rows with `edit.value` and call `setData`.
   * Return a promise and the cell shows that it is saving until it settles;
   * if it rejects, the cell goes back to what the data says and is marked as
   * having failed.
   */
  onCellEdit?: (edit: CellEdit<TRow>) => void | Promise<unknown>

  /**
   * What opens an editable cell with the mouse: a double click (the default)
   * or a single click. Enter, F2 and typing open it from the keyboard either way.
   */
  editTrigger?: "click" | "doubleClick"

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
   *
   * One modified click is the table's: a shift-click on a sortable header,
   * which adds that column to the sort. It fires this with the URL of that
   * view, since no link on the page points at it.
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
  /**
   * Base for the ids the table gives its own elements — a detail row, which
   * its expander names in `aria-controls`. Give each table on a page its own
   * when more than one has detail rows. Defaults to `"tpz"`.
   */
  id?: string
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
  /** With child rows, where each of those sits. */
  let renderedInfo: RowInfo[] | undefined
  /** The pinned rows on screen, top then bottom. */
  let pinnedRendered: Array<{ id: string; row: TRow; node: HTMLElement; side: PinnedSide; index: number }> = []
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
  /**
   * The detail row in the document for each row id, open or — under
   * `keepMounted` — closed and hidden. Kept across a rebuild for the hidden
   * ones and the open ones alike when their row is the same object, so a
   * detail that loads its own data is not built, and does not load, again
   * because the table was sorted.
   */
  let detailNodes = new Map<string, { row: TRow; tr: HTMLElement }>()
  let renderedShape = ""
  /** Bumped by `setOptions`, so a change to columns, types or renderers rebuilds. */
  let generation = 0
  let selectAllBox: HTMLInputElement | undefined
  let expandAllButton: HTMLButtonElement | undefined
  /** The columns the keyboard moves across, the table's own first, as last rendered. */
  let navColumns: string[] = []
  /** The one cell in the tab order, as last rendered, and the row last drawn as active. */
  let renderedEntry: HTMLElement | undefined
  let renderedFocusRow: string | undefined
  /** The active row last brought onto the page, so it is brought there once, not every render. */
  let lastRevealed: string | undefined
  /** What `state.focus` said when it was last acted on — see `applyFocus`. */
  let appliedFocus: string | undefined
  /** A rebuild took the focus out of the document with the rows it was in. */
  let restoreFocus = false
  /** Whether the columns last rendered include an editable one. */
  let renderedEditable = false
  /** The cell being edited, if one is. Never on a server: an editor is opened by a person. */
  let editing: { rowId: string; key: string; editor: EditorHandle } | undefined
  /** A move still being saved, shown by applying it to the data it was made on. */
  let pendingMove: { data: readonly TRow[]; move: RowMove<TRow> } | undefined
  /** Says where a moved row went, for a screen reader. In the frame only while rows can be moved. */
  const announcer = el("div", { class: "tpz-sr", role: "status", "aria-live": "polite" })
  /** Edits still being saved, with the value each is saving, and the ones that failed, with why. */
  const pendingEdits = new Map<string, unknown>()
  const failedEdits = new Map<string, string>()

  const root = el("div", { class: "tpz" })
  // The container queries that freeze columns pinned by width, in the root only while some column is.
  const pinStyle = el("style", {})
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
  // Bodies of their own for the pinned rows, above and below the data, in the document only while they have rows.
  const pinnedTopBody = el("tbody", { class: "tpz-tbody tpz-pinned-body", "data-pinned": "top" })
  const pinnedBottomBody = el("tbody", { class: "tpz-tbody tpz-pinned-body", "data-pinned": "bottom" })
  const footer = el("div", { class: "tpz-footer" })
  const paginationBar = el("div", { class: "tpz-pagination" })
  const headerRow = el("tr", { class: "tpz-tr" })

  toolbarStart.append(count, chips)
  toolbar.append(toolbarStart, toolbarEnd)
  head.append(headerRow)
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
  /** Whether the toolbar holds any control at all, the caller's or the table's own. */
  let hasControls = false
  /** The sort's reset, kept between renders so it arrives once rather than on every one. */
  let sortResetControl: HTMLElement | undefined

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
          // Stopped and prevented: a native dialog closes on the key's default
          // action, which stopping its propagation does not touch.
          event.stopPropagation()
          event.preventDefault()
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

    hasControls = toolbarEnd.childNodes.length > 0
  }

  /**
   * The way back from a sort, present only while there is somewhere to go
   * back from.
   *
   * It leads the toolbar's controls: the group is aligned to the far edge, so
   * arriving at its near end moves nothing, where arriving at the far one
   * would push the search box and every button along each time a column was
   * sorted. And it goes only into a toolbar that is there anyway — conjuring
   * one up for it would shove the header down from under the pointer on the
   * very click that sorted it.
   *
   * A link when the table's controls are links, so a server-rendered table
   * can be put back in order before its script has arrived.
   */
  function renderSortReset() {
    const sorting = resolveSorting(settings.sortable)
    const resting = sorting?.reset

    if (!hasControls || !resting || !canResetSort(state.sort, sorting)) {
      sortResetControl?.remove()
      sortResetControl = undefined
      return
    }

    const href = settings.buildHref?.(resetSort(state, resting))
    const isLink = sortResetControl?.hasAttribute("href") ?? false

    if (!sortResetControl || isLink !== (href !== undefined)) {
      sortResetControl?.remove()
      const attributes = {
        class: "tpz-btn tpz-btn-icon tpz-sort-reset",
        "aria-label": "Reset sort",
        title: "Reset sort",
      }

      if (href !== undefined) {
        sortResetControl = routed(el("a", { href, ...attributes }, [icon("reset")]))
      } else {
        const button = el("button", { type: "button", ...attributes }, [icon("reset")])
        button.addEventListener("click", () => {
          /*
            Pressing it takes it off the screen, and focus with it. For someone
            working the keyboard that is being dropped at the top of the
            document, so focus is handed to the control beside it first. A
            mouse has no such problem, and would only be puzzled by the search
            box lighting up.
          */
          const next = isKeyboardFocused(button) ? controlAfter(button) : undefined
          // Read when it is pressed: the resting sort is the caller's to change.
          update(resetSort(state, resolveSorting(settings.sortable)?.reset ?? []))
          next?.focus()
        })
        sortResetControl = button
      }
    } else if (href !== undefined) {
      sortResetControl.setAttribute("href", href)
    }

    if (toolbarEnd.firstChild !== sortResetControl) toolbarEnd.prepend(sortResetControl)
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

  /*
    Built once per `types` and `format` the caller passes, not on every call:
    the pipeline remembers its work until the registry or the formatting
    changes, and a new one on every render would be a change on every render.
  */
  let builtRegistry: { from: TableOptions<TRow>["types"]; registry: ReturnType<typeof createTypeRegistry> } | undefined
  let builtFormat: { from: TableOptions<TRow>["format"]; format: FormatContext } | undefined

  function registry() {
    if (!settings.types) return defaultTypeRegistry
    let built = builtRegistry
    if (!built || built.from !== settings.types) {
      built = { from: settings.types, registry: createTypeRegistry(settings.types) }
      builtRegistry = built
    }
    return built.registry
  }

  function formatting(): FormatContext {
    let built = builtFormat
    if (!built || built.from !== settings.format) {
      built = { from: settings.format, format: { ...DEFAULT_FORMAT, ...settings.format } }
      builtFormat = built
    }
    return built.format
  }

  // What the pipeline worked out last time, so a page turn, a tick or a moved cursor costs nothing.
  const pipelineCache = createPipelineCache<TRow>()

  /*
    With a search box over a large table of its own data, every row's search
    text is built in idle time, so the first keystroke costs what the next
    does. Started again only when what it builds from changes.
  */
  let warming: { data: readonly TRow[]; columns: unknown; stop: () => void } | undefined

  function warmSearchIfWanted(columns: ResolvedColumn<TRow, Node | string>[]) {
    const wanted = Boolean(settings.search) && !settings.server
    const data = viewData()
    if (warming && warming.data === data && warming.columns === columnsKey(columns) && wanted) return
    warming?.stop()
    warming = wanted
      ? { data, columns: columnsKey(columns), stop: warmSearchWhenIdle(data, columns, registry(), formatting()) }
      : undefined
  }

  function columnsKey(columns: ResolvedColumn<TRow, Node | string>[]): string {
    return columns.map((column) => `${column.key}:${column.type}:${String(column.searchable)}`).join("|")
  }

  /** The data, with a move that is still being saved applied to it. */
  function viewData(): readonly TRow[] {
    const data = settings.data
    if (!pendingMove || pendingMove.data !== data) return data
    const ids = data.map((row, index) => resolveRowId(row, index, settings.getRowId))
    return applyRowMove(data, ids, pendingMove.move)
  }

  function current(reveal?: string) {
    const pagination = paginationOf(settings)
    const data = viewData()
    const { visible, hidden } = resolveColumns<TRow, Node | string>({
      columns: settings.columns,
      rows: data,
      state,
      types: registry(),
      resizable: settings.resizable,
      reorderable: settings.reorderable,
      headerSearch: resolveHeaderSearch(settings.headerSearch).enabled,
      server: Boolean(settings.server),
    })

    const result = getRows<TRow, Node | string>({
      rows: data,
      columns: visible,
      state: pagination ? state : { ...state, pageSize: 0 },
      types: registry(),
      format: formatting(),
      server: Boolean(settings.server),
      serverDistinct: Boolean(source()?.distinct),
      total: settings.total,
      accumulate: pagination?.mode === "infinite" || pagination?.mode === "loadMore",
      reveal: pagination ? reveal : undefined,
      getRowId: settings.getRowId,
      getParentId: settings.getParentId,
      cache: pipelineCache,
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

  /** Whether the keyboard moves between cells. */
  function navigable(): boolean {
    // Editing needs the keyboard to reach cells, so editable columns switch it on unless told otherwise.
    return settings.cellNavigation ?? renderedEditable
  }

  /**
   * Draws the table, and says whether doing so moved the page — to bring an
   * active row set from outside onto the page it is on — so that a caller who
   * is not already reporting the state can report it.
   */
  function render(): boolean {
    /*
      Only when the active row has changed: once revealed, paging away from it
      must not drag the table back.
    */
    const focusRow = state.focus?.rowId
    const reveal = !settings.server && focusRow !== undefined && focusRow !== lastRevealed ? focusRow : undefined
    lastRevealed = focusRow

    const revealed = renderView(reveal)
    syncFocus()
    applyFocus()
    return revealed
  }

  function renderView(reveal: string | undefined): boolean {
    const { columns, hidden, rows, total, pageCount, filtered, pagination, page, info } = current(reveal)
    renderedEditable = hasEditableColumns(columns)
    warmSearchIfWanted(columns)

    // The page shown is the revealed row's, so the state says so from here on.
    const revealed = pagination !== undefined && page !== state.page
    if (revealed) state = { ...state, page }
    const types = registry()
    const format = formatting()
    const cls = classes()
    const selection = selectionOf()
    const selectionMode = selection?.mode
    const columnCount = columns.length + (selectionMode ? 1 : 0) + (settings.detail ? 1 : 0) + (settings.rowReorder ? 1 : 0)
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

    // How much of the scroll area the pinned rows cover, so a cell brought into view is not left under them.
    for (const side of ["top", "bottom"] as const) {
      const count = settings.pinnedRows?.[side]?.length ?? 0
      if (count > 0) root.style.setProperty(`--tpz-pinned-${side}`, `calc(${String(count)} * var(--tpz-row-height))`)
      else root.style.removeProperty(`--tpz-pinned-${side}`)
    }

    if (settings.ariaLabel) table.setAttribute("aria-label", settings.ariaLabel)
    else table.removeAttribute("aria-label")

    if (navigable()) {
      // A table of parents and children is a tree grid, whose rows say their level.
      table.setAttribute("role", info ? "treegrid" : "grid")
      table.setAttribute("aria-readonly", renderedEditable ? "false" : "true")
    } else {
      table.removeAttribute("role")
      table.removeAttribute("aria-readonly")
    }

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
    renderSortReset()

    // Decided on every render rather than when the toolbar was built: the
    // chips arrive later than the controls do, and a toolbar hidden for having
    // no controls would go on hiding them.
    toolbar.style.display = !hasControls && state.filters.length === 0 ? "none" : ""

    const shape = shapeOf(columns, selection)
    navColumns = [
      ...(settings.rowReorder ? ["__drag"] : []),
      ...(selectionMode ? ["__select"] : []),
      ...(settings.detail ? ["__expand"] : []),
      ...columns.map((column) => column.key),
    ]

    if (settings.rowReorder) {
      if (announcer.parentNode !== frame) frame.append(announcer)
    } else {
      announcer.remove()
    }
    const pinnedIds = (side: PinnedSide) =>
      (settings.pinnedRows?.[side] ?? []).map((row, index) => pinnedRowId(row, index, side, settings.getRowId))
    const gridIds = [...pinnedIds("top"), ...rowIds, ...pinnedIds("bottom")]
    const build: RowBuild = {
      columns,
      types,
      format,
      cls,
      selection,
      pinEdges: pinEdgesOf(columns),
      columnCount,
      entry: navigable() ? entryCell({ rows: gridIds, columns: navColumns }, state.focus) : undefined,
      sizing: columnSizing(columns),
    }

    const pinCss = responsivePinStyles(columns)
    if (pinCss === "") {
      pinStyle.remove()
    } else {
      if (pinStyle.textContent !== pinCss) pinStyle.textContent = pinCss
      if (pinStyle.parentNode !== root) root.prepend(pinStyle)
    }
    watchWidth(pinCss !== "")

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
          const tr = buildRow(rows[index]!, rowIds[index]!, index, build, info?.[index])
          added.push(tr)
          batch.append(tr)
        }

        // Positioned before they are in the document, so a frozen column does
        // not spend a frame in the wrong place.
        applyPinOffsets(batch, offsets)

        // After the last data row — and its detail, if it has one open —
        // rather than at the end of the body: a caller's appended row sits
        // below the data and must stay there.
        const lastId = renderedIds[renderedIds.length - 1]
        const last = (lastId !== undefined ? detailNodes.get(lastId)?.tr : undefined) ?? renderedNodes[renderedNodes.length - 1]
        if (last) last.after(batch)
        else body.append(batch)

        renderedNodes.push(...added)
        renderedRows = rows
        renderedIds = rowIds
        renderedInfo = info
        renderedSelectable = selectable
      }

      // Nothing in the header is rebuilt by this, only brought up to date: a
      // link in it carries the whole state, and the page has just changed.
      renderHeader(columns, cls, selectionMode)
      syncSelection()
      syncDetails(build)
      renderPagination(pagination, total, pageCount, rows.length)
      void hidden
      return revealed
    }

    renderHeader(columns, cls, selectionMode)

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

    const nodes = rows.map((row, index) => buildRow(row, rowIds[index]!, index, build, info?.[index]))

    // Each row, then its detail when it has one open or kept.
    const previousDetails = detailNodes
    detailNodes = new Map()
    nodes.forEach((tr, index) => {
      rendered.push(tr)
      const detail = detailFor(rows[index]!, rowIds[index]!, index, build, previousDetails)
      if (detail) rendered.push(detail)
    })

    if (settings.appendRow) {
      rendered.push(
        el("tr", { class: cls("row") }, [el("td", { class: "tpz-td", colspan: columnCount }, [settings.appendRow])]),
      )
    }

    // The rows are about to be replaced; if the focus is in one, it goes back to the active cell after.
    const focusedNow = currentDocument().activeElement
    if (body.contains(focusedNow) || pinnedTopBody.contains(focusedNow) || pinnedBottomBody.contains(focusedNow)) {
      restoreFocus = true
    }
    // An editor open in a row being replaced is opened again in the new one, with what was typed.
    const reopen = editing ? { rowId: editing.rowId, key: editing.key, text: editing.editor.text() } : undefined
    if (editing) closeEditor()
    fill(body, rendered)
    renderPinned(build)

    renderedRows = rows
    renderedIds = rowIds
    renderedInfo = info
    renderedSelectable = selectable
    renderedNodes = nodes
    renderedSelection = new Set(state.selection)
    renderedShape = shape
    syncSelectAll()
    syncExpandAll()

    applyPinOffsets()
    renderPagination(pagination, total, pageCount, rows.length)
    if (reopen) {
      restoreFocus = false
      startEdit(reopen.rowId, reopen.key, reopen.text)
    }
    void hidden
    return revealed
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
    /** Every column a full-width row spans, the table's own included. */
    columnCount: number
    /** With cell navigation, the cell in the tab order; absent when the keyboard does not move between cells. */
    entry: { rowId: string; key: string } | undefined
    /** How wide each column's cells are — `columnSizing(columns)`. */
    sizing: Record<string, CellSizing>
  }

  /** One row, built the same way whether the body is being filled or extended. */
  function buildRow(
    row: TRow,
    id: string,
    index: number,
    build: RowBuild,
    info?: RowInfo,
    /** A pinned row: held against an edge, and nothing in the table's own columns. */
    pinned?: { side: PinnedSide; offset: string },
  ): HTMLElement {
    const { columns, types, format, cls, selection, pinEdges } = build
    const selectionMode = selection?.mode
    const selected = state.selection.includes(id)
    const detail = settings.detail
    const expandable = !pinned && detail !== undefined && (detail.canExpand ? detail.canExpand(row) : true)
    const open = !pinned && isDetailOpen(state, row, id, detail)
    const togglesDetail = expandable && detail?.toggleOnRowClick === true
    const clicks = !pinned && (settings.onRowClick !== undefined || togglesDetail)

    const treegrid = info !== undefined && navigable()
    const tr = el("tr", {
      class: cls("row", settings.rowClassName?.(row, index, info)),
      "data-selected": selected ? "true" : undefined,
      "data-clickable": clicks ? "true" : undefined,
      "data-expanded": open ? "true" : undefined,
      "data-focused": state.focus?.rowId === id ? "true" : undefined,
      "data-row-id": id,
      "data-depth": info?.depth,
      "data-parent": info && info.childCount > 0 ? "true" : undefined,
      "data-context": info?.context ? "true" : undefined,
      "aria-level": treegrid ? info.depth + 1 : undefined,
      "aria-expanded": treegrid && info.childCount > 0 ? String(!(state.collapsed ?? []).includes(id)) : undefined,
      "data-pinned": pinned?.side,
    })
    if (pinned) tr.style.setProperty("--tpz-pinned-offset", pinned.offset)

    // Read from the settings when it happens, so a handler passed later is the one called.
    tr.addEventListener("contextmenu", (event) => {
      const handler = settings.onRowContextMenu
      if (!handler) return
      const cell = event.target instanceof Element ? event.target.closest<HTMLElement>("td[data-key]") : null
      const key = cell && tr.contains(cell) ? cell.dataset["key"] : undefined
      const column = headerColumns.find((entry) => entry.key === key)
      handler(row, event, {
        rowId: id,
        columnKey: column ? column.key : null,
        column,
        text: column ? cellDisplayText(row, column, { types: registry(), format: formatting(), rowId: id }) : null,
        rowText: toDelimitedText([row], {
          columns: headerColumns,
          types: registry(),
          format: formatting(),
          delimiter: "\t",
          header: false,
          getRowId: () => id,
        }),
        ...(pinned ? { pinned: pinned.side } : {}),
      })
    })

    // Only the active cell is in the tab order; the rest are reached by arrow.
    const entry = build.entry
    const tabindex = (key: string) => (entry === undefined ? undefined : entry.rowId === id && entry.key === key ? 0 : -1)

    const reorder = settings.rowReorder
    if (reorder) {
      const cell = el("td", { class: cls("dragCell"), "data-pin": "start", "data-key": "__drag", tabindex: tabindex("__drag") })
      const draggable = !pinned && (reorder.canDrag ? reorder.canDrag(row) : true)
      if (draggable) {
        const disabled = !canReorderRows(state.sort)
        const handle = el(
          "button",
          {
            type: "button",
            class: "tpz-drag-handle",
            tabindex: entry ? -1 : undefined,
            "aria-label": `Move row ${String(index + 1)}`,
            "aria-disabled": disabled ? "true" : undefined,
            title: disabled ? "Clear the sort to move rows" : "Drag to move, or Alt with an arrow key",
          },
          [icon("grip", 14)],
        )
        handle.addEventListener("click", (event) => event.stopPropagation())
        handle.addEventListener("pointerdown", (event) => {
          if (event.button !== 0 || !canReorderRows(state.sort)) return
          beginRowDrag(id, tr, event)
        })
        handle.addEventListener("keydown", (event) => {
          if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return
          event.preventDefault()
          event.stopPropagation()
          stepRowBy(id, event.key === "ArrowUp" ? -1 : 1)
        })
        cell.append(handle)
      }
      tr.append(cell)
    }

    if (clicks) {
      tr.addEventListener("click", (event) => {
        // A link, a button, a checkbox in the row is what was meant, not the row.
        if (isInteractiveTarget(event.target, tr)) return
        settings.onRowClick?.(row, event)
        if (togglesDetail) update(toggleExpanded(state, id))
      })
    }

    if (selectionMode && pinned) {
      tr.append(el("td", { class: cls("selectCell"), "data-pin": "start", "data-key": "__select", tabindex: tabindex("__select") }))
    } else if (selectionMode) {
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
      // The table's own controls are worked from their cell, so they leave the tab order to it.
      if (entry) box.tabIndex = -1
      tr.append(
        el("td", { class: cls("selectCell"), "data-pin": "start", "data-key": "__select", tabindex: tabindex("__select") }, [
          box,
        ]),
      )
    }

    if (detail) {
      const cell = el("td", {
        class: cls("expandCell"),
        "data-pin": "start",
        "data-key": "__expand",
        tabindex: tabindex("__expand"),
      })
      if (expandable) {
        const button = el(
          "button",
          {
            type: "button",
            class: "tpz-expander",
            tabindex: entry ? -1 : undefined,
            "aria-expanded": open ? "true" : "false",
            "aria-controls": open ? detailId(id) : undefined,
            "aria-label": `${open ? "Hide" : "Show"} details for row ${String(index + 1)}`,
          },
          [icon("chevronRight", 14)],
        )
        button.addEventListener("click", (event) => {
          event.stopPropagation()
          update(toggleExpanded(state, id))
        })
        cell.append(button)
      }
      tr.append(cell)
    }

    const editable = hasEditableColumns(columns)

    columns.forEach((column, columnIndex) => {
      const cellEditable = editable && isCellEditable(column, row)
      const cell = el("td", {
        class: cls("cell", column.className),
        "data-align": column.align,
        "data-mono": column.mono ? undefined : "false",
        "data-wrap": wrapAttribute(column.wrap),
        "data-pin": column.pin,
        "data-pin-edge": pinEdges.has(column.key) ? column.pin : undefined,
        "data-pin-when": column.pinWhen ? pinWhenToken(column.pinWhen) : undefined,
        "data-size": build.sizing[column.key]?.size,
        "data-key": column.key,
        "data-label": column.header,
        tabindex: tabindex(column.key),
        "data-editable": cellEditable ? "true" : undefined,
        "aria-readonly": editable && !cellEditable ? "true" : undefined,
      })
      applySizing(cell, build.sizing[column.key])

      fillCell(cell, row, id, index, column, columnIndex, build, info)
      tr.append(cell)
    })

    return tr
  }

  /** The key a cell's pending or failed edit is kept under. */
  function editId(rowId: string, key: string): string {
    return `${rowId}\u0000${key}`
  }

  /**
   * Puts a cell's content in it: the value — or the one being saved, while an
   * edit is — formatted and rendered, inside whatever bounds the cell.
   * Separate from building the cell so one cell can be redrawn on its own
   * when its edit closes, saves or fails.
   */
  function fillCell(
    cell: HTMLElement,
    row: TRow,
    id: string,
    index: number,
    column: ResolvedColumn<TRow, Node | string>,
    columnIndex: number,
    build: Pick<RowBuild, "types" | "format" | "sizing">,
    info?: RowInfo,
  ) {
    const editKey = editId(id, column.key)
    const pending = pendingEdits.has(editKey)
    const failed = failedEdits.get(editKey)

    const context = cellContext(row, id, index, column, build.types, build.format, pending ? { value: pendingEdits.get(editKey) } : undefined)
    const content = renderCell(context, settings)
    const node = typeof content === "string" ? text(content) : content

    cell.replaceChildren()
    delete cell.dataset["editing"]
    if (pending) {
      cell.dataset["pending"] = "true"
      cell.setAttribute("aria-busy", "true")
    } else {
      delete cell.dataset["pending"]
      cell.removeAttribute("aria-busy")
    }
    if (failed !== undefined) {
      cell.dataset["failed"] = "true"
      cell.setAttribute("title", failed)
    } else {
      delete cell.dataset["failed"]
      cell.removeAttribute("title")
    }

    /*
      A table cell has to go on being a table cell, so anything that bounds
      its content needs an element of its own inside it: `-webkit-box` for a
      line clamp, and a plain block for an exact row height, whose cap
      `height` alone cannot enforce.
    */
    let host: Node = cell
    // The box that holds the column to its width, or caps it — see `columnSizing`.
    if (build.sizing[column.key]?.box) {
      const box = el("span", { class: "tpz-box" })
      cell.append(box)
      host = box
    }
    if (typeof column.wrap === "number") {
      const clamp = el("span", { class: "tpz-clamp" })
      clamp.style.setProperty("--tpz-cell-lines", String(column.wrap))
      host.appendChild(clamp)
      host = clamp
    } else if (typeof settings.rowHeight === "number") {
      const fit = el("span", { class: "tpz-fit" })
      host.appendChild(fit)
      host = fit
    }

    /*
      With child rows the leading cell carries the row's place in the tree: a
      toggle for a parent, the same width of nothing for a row on its own, and
      an indent with a connector for a child.
    */
    if (columnIndex === 0 && info) host.appendChild(treeSlot(id, index, info))

    if (columnIndex === 0 && settings.rowHref) {
      const link = el("a", { class: "tpz-link tpz-lead", href: settings.rowHref(row) })
      link.append(node)
      host.appendChild(link)
    } else {
      host.appendChild(node)
    }

    if (failed !== undefined) cell.append(el("span", { class: "tpz-sr", text: `, not saved: ${failed}` }))
  }

  /** The start of a leading cell in a table with child rows. */
  function treeSlot(id: string, index: number, info: RowInfo): HTMLElement {
    const slot = el("span", { class: "tpz-tree", "data-depth": info.depth })
    if (info.childCount === 0) return slot

    const folded = (state.collapsed ?? []).includes(id)
    const count = info.childCount
    const button = el(
      "button",
      {
        type: "button",
        class: "tpz-tree-toggle",
        tabindex: navigable() ? -1 : undefined,
        "aria-expanded": folded ? "false" : "true",
        "aria-label": `${folded ? "Show" : "Hide"} ${String(count)} child ${count === 1 ? "row" : "rows"} of row ${String(index + 1)}`,
      },
      [icon("chevronRight", 12)],
    )
    button.addEventListener("click", (event) => {
      event.stopPropagation()
      const hadFocus = currentDocument().activeElement === button
      update(toggleCollapsed(state, id))
      // The rows were drawn again; the press stays with the same parent's toggle.
      if (hadFocus) cellElement(id, undefined)?.querySelector<HTMLElement>(".tpz-tree-toggle")?.focus()
    })
    slot.append(button)
    return slot
  }

  /** Redraws one cell where it is, if it is on screen. */
  function refillCell(rowId: string, key: string) {
    const found = lookupRow(rowId)
    const column = headerColumns.find((entry) => entry.key === key)
    const cell = cellElement(rowId, key)
    if (!found || !column || !cell) return
    fillCell(
      cell,
      found.row,
      rowId,
      found.index,
      column,
      headerColumns.indexOf(column),
      { types: registry(), format: formatting(), sizing: columnSizing(headerColumns) },
      found.info,
    )
  }

  /** A rendered row by id — one of the data's, or a pinned one. */
  function lookupRow(
    id: string,
  ): { row: TRow; index: number; node: HTMLElement; info?: RowInfo; pinned?: PinnedSide } | undefined {
    const at = renderedIds.indexOf(id)
    const node = renderedNodes[at]
    const row = renderedRows[at]
    if (at !== -1 && node && row !== undefined) return { row, index: at, node, info: renderedInfo?.[at] }
    const pinned = pinnedRendered.find((entry) => entry.id === id)
    return pinned ? { row: pinned.row, index: pinned.index, node: pinned.node, pinned: pinned.side } : undefined
  }

  /** Every row a person can land on, pinned and data, in the order they are on screen. */
  function gridRowIds(): string[] {
    return [
      ...pinnedRendered.filter((entry) => entry.side === "top").map((entry) => entry.id),
      ...renderedIds,
      ...pinnedRendered.filter((entry) => entry.side === "bottom").map((entry) => entry.id),
    ]
  }

  /**
   * Builds the pinned bodies, and puts each in the table only while it has
   * rows. Rebuilt with the data's rows, so a pinned row follows the columns.
   */
  function renderPinned(build: RowBuild) {
    pinnedRendered = []
    for (const side of ["top", "bottom"] as const) {
      const target = side === "top" ? pinnedTopBody : pinnedBottomBody
      const rows = settings.pinnedRows?.[side] ?? []
      if (rows.length === 0) {
        target.remove()
        continue
      }
      target.className = build.cls("tbody", "tpz-pinned-body")
      const nodes = rows.map((row, index) => {
        const id = pinnedRowId(row, index, side, settings.getRowId)
        const node = buildRow(row, id, index, build, undefined, { side, offset: pinnedOffset(index, rows.length, side) })
        pinnedRendered.push({ id, row, node, side, index })
        return node
      })
      fill(target, nodes)
      if (side === "top" && target.parentNode !== table) head.after(target)
      if (side === "bottom" && target.parentNode !== table) body.after(target)
    }
    measurePinned()
  }

  /*
    How far each pinned row sits from its edge, once there is a layout to ask:
    the rows were built a row height apart, which is right for rows of one line
    and is what a server writes. A row that wraps is taller, and the rows past
    it would overlap it. Nothing is written where nothing was measured — on a
    server, or in a test without layout — so the markup stays what the server sent.
  */
  function measurePinned() {
    for (const side of ["top", "bottom"] as const) {
      const entries = pinnedRendered.filter((entry) => entry.side === side)
      if (side === "bottom") entries.reverse()
      const heights = entries.map((entry) => entry.node.getBoundingClientRect().height)
      if (heights.every((height) => height === 0)) continue
      let offset = 0
      entries.forEach((entry, index) => {
        entry.node.style.setProperty("--tpz-pinned-offset", `${String(offset)}px`)
        offset += heights[index] ?? 0
      })
    }
  }

  /* ── Editing ───────────────────────────────────────────────────────────── */

  /** Opens a cell's editor, if the cell can be edited. `seed` replaces the value, as typing does. */
  function startEdit(rowId: string, key: string, seed?: string): boolean {
    const row = lookupRow(rowId)?.row
    const column = headerColumns.find((entry) => entry.key === key)
    const cell = cellElement(rowId, key)
    if (row === undefined || !column || !cell || !isCellEditable(column, row)) return false

    const types = registry()
    const format = formatting()
    const kind = editorKind(column, types)
    if (kind === "none") return false

    if (editing) closeEditor()
    if (failedEdits.delete(editId(rowId, key))) refillCell(rowId, key)

    const value = column.accessor(row)
    const label = `Edit ${column.header}`
    const id = `${settings.id ?? "tpz"}-edit-${encodeURIComponent(rowId)}-${encodeURIComponent(key)}`
    const callbacks = {
      onCommit: (input: string, reason: CommitReason) => finishEdit({ text: input }, reason),
      onCancel: cancelEdit,
    }

    let editor: EditorHandle
    if (kind === "custom" && column.renderEditor) {
      const host = el("div", { class: "tpz-editor", "data-kind": "custom" })
      const content = column.renderEditor({
        value,
        initialText: seed ?? "",
        row,
        rowId,
        column,
        commit: (next) => finishEdit({ value: next }, "custom"),
        cancel: cancelEdit,
      })
      if (content !== undefined && content !== null) host.append(typeof content === "string" ? text(content) : content)
      editor = { element: host, focus: () => undefined, text: () => seed ?? "", setError: () => undefined, dispose: () => undefined }
    } else if (kind === "select" || kind === "boolean") {
      editor = buildComboboxEditor({
        kind,
        choices: editorOptions(column, kind, format),
        current: toEditorText(value, kind, column, format),
        seed,
        label,
        theme: settings.theme,
        id,
        ...callbacks,
      })
    } else {
      editor = buildInputEditor({
        kind,
        initial: seed ?? toEditorText(value, kind, column, format),
        seeded: seed !== undefined,
        step: kind === "number" ? editorStep(column) : undefined,
        label,
        theme: settings.theme,
        id,
        ...callbacks,
      })
    }

    editing = { rowId, key, editor }
    cell.dataset["editing"] = "true"
    cell.replaceChildren(editor.element)
    editor.focus()
    return true
  }

  /** Takes the editor out of its cell and puts the cell's content back. */
  function closeEditor() {
    const open = editing
    if (!open) return
    editing = undefined
    open.editor.dispose()
    refillCell(open.rowId, open.key)
  }

  function cancelEdit() {
    const open = editing
    if (!open) return
    closeEditor()
    cellElement(open.rowId, open.key)?.focus({ preventScroll: true })
  }

  /** The next editable cell after this one, or before it, in reading order across the page. */
  function nextEditable(rowId: string, key: string, backwards: boolean): { rowId: string; key: string } | undefined {
    const cells: Array<{ rowId: string; key: string; row: TRow; column: ResolvedColumn<TRow, Node | string> }> = []
    for (const id of gridRowIds()) {
      const row = lookupRow(id)?.row
      if (row === undefined) continue
      for (const column of headerColumns) cells.push({ rowId: id, key: column.key, row, column })
    }
    if (backwards) cells.reverse()

    const from = cells.findIndex((cell) => cell.rowId === rowId && cell.key === key)
    const types = registry()
    return cells
      .slice(from + 1)
      .find((cell) => isCellEditable(cell.column, cell.row) && editorKind(cell.column, types) !== "none")
  }

  function finishEdit(input: { text: string } | { value: unknown }, reason: CommitReason) {
    const open = editing
    if (!open) return
    const found = lookupRow(open.rowId)
    const row = found?.row
    const column = headerColumns.find((entry) => entry.key === open.key)
    if (row === undefined || !column) {
      closeEditor()
      return
    }

    const previous = column.accessor(row)
    let value = "text" in input ? fromEditorText(input.text, editorKind(column, registry()), column, previous, formatting()) : input.value
    if (column.parse) value = column.parse(value, row)

    // Refused: the editor stays open, marked, with the reason beside it. Leaving the cell changes nothing.
    const error = validateEdit(column, value, row)
    if (error !== undefined) {
      if (reason === "blur") closeEditor()
      else open.editor.setError(error)
      return
    }

    const { rowId, key } = open
    const changed = !editValuesEqual(value, previous)
    if (changed && settings.onCellEdit) pendingEdits.set(editId(rowId, key), value)
    closeEditor()

    if (changed) {
      const pinned = found?.pinned
      const result = settings.onCellEdit?.({ rowId, row, key, value, previousValue: previous, ...(pinned ? { pinned } : {}) })
      if (isPromiseLike(result)) {
        refillCell(rowId, key)
        result.then(
          () => {
            pendingEdits.delete(editId(rowId, key))
            refillCell(rowId, key)
          },
          (failure: unknown) => {
            pendingEdits.delete(editId(rowId, key))
            failedEdits.set(editId(rowId, key), failure instanceof Error && failure.message ? failure.message : "Could not save")
            refillCell(rowId, key)
          },
        )
      } else if (pendingEdits.delete(editId(rowId, key))) {
        // Nothing to wait for: the cell shows what the data says now.
        refillCell(rowId, key)
      }
    }

    // Tab carries on editing in the next editable cell, as a spreadsheet does.
    if (reason === "tab" || reason === "shift-tab") {
      const next = nextEditable(rowId, key, reason === "shift-tab")
      if (next && startEdit(next.rowId, next.key)) {
        const focused = focusCell(state, next.rowId, next.key)
        if (focused !== state) update(focused)
        return
      }
    }

    if (reason !== "blur") cellElement(rowId, key)?.focus({ preventScroll: true })
  }

  function onEditPointer(event: MouseEvent) {
    const target = event.target
    if (!(target instanceof Element)) return
    const cell = target.closest<HTMLElement>('td[data-editable="true"]')
    if (!cell || !table.contains(cell) || head.contains(cell) || cell.dataset["editing"] === "true") return
    if (isInteractiveTarget(target, cell)) return
    const rowId = cell.parentElement?.dataset["rowId"]
    const key = cell.dataset["key"]
    if (rowId !== undefined && key !== undefined) startEdit(rowId, key)
  }

  table.addEventListener("dblclick", (event) => {
    if (settings.editTrigger !== "click") onEditPointer(event)
  })
  table.addEventListener("click", (event) => {
    if (settings.editTrigger === "click") onEditPointer(event)
  })

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

  /** The rendered `<td>` for a cell, or the `<tr>` when no column is named. */
  function cellElement(rowId: string, key: string | undefined): HTMLElement | undefined {
    const row = lookupRow(rowId)?.node
    if (!row) return undefined
    if (key === undefined) return row
    // By attribute rather than by building a selector from the key, which may hold a dot or a quote;
    // and without `instanceof`, which a server's elements are not.
    return [...row.querySelectorAll<HTMLElement>("td[data-key]")].find(
      (cell) => cell.parentNode === row && cell.dataset["key"] === key,
    )
  }

  /**
   * Brings the active row's highlight and the one tab stop into line with the
   * state, touching only the cells and rows whose answer changed — moving the
   * keyboard one cell must not rebuild a table to do it.
   */
  function syncFocus() {
    const focusRow = state.focus?.rowId
    if (focusRow !== renderedFocusRow) {
      for (const id of gridRowIds()) {
        const tr = lookupRow(id)?.node
        if (!tr) continue
        if (id === focusRow) tr.dataset["focused"] = "true"
        else if (id === renderedFocusRow) delete tr.dataset["focused"]
      }
      renderedFocusRow = focusRow
    }

    if (!navigable()) {
      renderedEntry = undefined
      return
    }

    const entry = entryCell({ rows: gridRowIds(), columns: navColumns }, state.focus)
    const cell = entry ? cellElement(entry.rowId, entry.key) : undefined
    if (cell !== renderedEntry || cell?.getAttribute("tabindex") !== "0") {
      for (const stop of table.querySelectorAll<HTMLElement>('tbody td[tabindex="0"]')) {
        if (stop !== cell) stop.setAttribute("tabindex", "-1")
      }
      cell?.setAttribute("tabindex", "0")
      renderedEntry = cell
    }
  }

  /**
   * Acts on an active cell set from outside: scrolls to it and, with cell
   * navigation on, puts the focus there. Compared by what it says, so a
   * wrapper handing over a fresh object with the same cell does not keep
   * moving the page. The first render only scrolls — the page has just
   * arrived, and taking the focus from wherever the browser put it would be
   * rude — and a server, which cannot scroll, does nothing.
   */
  function applyFocus() {
    const focus = state.focus
    const signature = focus ? JSON.stringify([focus.rowId, focus.key ?? null, focus.align ?? null]) : ""
    const first = appliedFocus === undefined
    const restoring = restoreFocus
    restoreFocus = false

    if (restoring && renderedEntry && navigable()) renderedEntry.focus({ preventScroll: true })
    if (!first && signature === appliedFocus) return
    appliedFocus = signature
    if (!focus) return

    // The tab stop falls back to the first row when the active one is not on screen; that is not "there".
    const target = navigable()
      ? renderedEntry?.parentElement?.dataset["rowId"] === focus.rowId
        ? renderedEntry
        : undefined
      : cellElement(focus.rowId, undefined)
    // Already there — or inside it, in the editor that cell has just opened.
    if (!target || target.contains(currentDocument().activeElement)) return

    if (typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ block: focus.align ?? "nearest", inline: "nearest" })
    }
    if (!first && navigable()) target.focus({ preventScroll: true })
  }

  /** A cell taking the focus — by click, Tab or arrow — makes it the active one. */
  table.addEventListener("focusin", (event) => {
    if (!navigable()) return
    const cell = event.target
    if (!(cell instanceof HTMLElement) || cell.tagName !== "TD" || !cell.hasAttribute("tabindex")) return
    const rowId = cell.parentElement?.dataset["rowId"]
    const key = cell.dataset["key"]
    if (rowId === undefined || key === undefined) return
    const next = focusCell(state, rowId, key)
    if (next !== state) update(next)
  })

  /*
    A range built by the keyboard or by a sweep of the pointer: the rows
    between an anchor and wherever the gesture has reached, on top of what was
    selected when it began — recomputed each time, so going back gives rows up.
  */
  let range: { anchor: string; base: string[] } | undefined

  function extendRange(target: string, start: string, extend: boolean) {
    if (!range) {
      const anchor = extend ? (lastToggled ?? start) : start
      range = { anchor, base: extend ? [...state.selection] : [] }
    }
    lastToggled = range.anchor
    update({ ...state, selection: rangeSelection(range.base, renderedSelectable, range.anchor, target) })
  }

  /*
    Keys that belong to the selection, whether or not the keyboard moves
    between cells: Shift with an arrow extends it a row at a time, and Escape
    clears it. Only from a cell or a row's checkbox — an editor, or a control
    of the caller's, keeps its keys.
  */
  function selectionKeys(event: KeyboardEvent): boolean {
    const selection = selectionOf()
    if (!selection || event.defaultPrevented) return false
    const target = event.target
    if (!(target instanceof HTMLElement) || !body.contains(target)) return false
    const tr = target.closest<HTMLElement>("tr[data-row-id]")
    if (!tr || tr.classList.contains("tpz-detail-row")) return false
    if (!(target.tagName === "TD" || target.matches("input.tpz-checkbox"))) return false

    if (event.key === "Escape" && state.selection.length > 0) {
      event.preventDefault()
      range = undefined
      update(clearSelection(state))
      return true
    }

    if (event.shiftKey && !event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown") && selection.mode === "multiple") {
      const id = tr.dataset["rowId"] ?? ""
      const next = renderedIds[renderedIds.indexOf(id) + (event.key === "ArrowDown" ? 1 : -1)]
      event.preventDefault()
      if (next === undefined) return true
      range ??= { anchor: id, base: [...state.selection] }
      extendRange(next, id, false)

      // The keyboard goes with the range: to the same column of the next row, or its checkbox.
      const key = target.tagName === "TD" ? target.dataset["key"] : "__select"
      const cell = key === undefined ? undefined : cellElement(next, key)
      const focusable = target.tagName === "TD" ? cell : cell?.querySelector<HTMLElement>("input.tpz-checkbox")
      focusable?.focus({ preventScroll: true })
      if (typeof focusable?.scrollIntoView === "function") focusable.scrollIntoView({ block: "nearest" })
      return true
    }

    if (event.key !== "Shift") range = undefined
    return false
  }

  /* A press on a row that moves becomes a sweep that selects every row it crosses. */
  body.addEventListener("pointerdown", (event) => {
    const selection = selectionOf()
    if (!selection?.dragSelect || selection.mode !== "multiple" || event.button !== 0) return
    const target = event.target
    if (!(target instanceof Element)) return
    const tr = target.closest<HTMLElement>("tr[data-row-id]")
    if (!tr || isInteractiveTarget(target, tr) || target.closest('[data-editing="true"]')) return
    const start = tr.dataset["rowId"] ?? ""
    if (!renderedSelectable.includes(start)) return
    const extend = event.shiftKey

    range = undefined
    startDragSelect({
      event,
      row: tr,
      rowFor: (element) => {
        const over = element.closest<HTMLElement>("tr[data-row-id]")
        return over && body.contains(over) && renderedSelectable.includes(over.dataset["rowId"] ?? "") ? over : undefined
      },
      onSweep: (_, to) => extendRange(to.dataset["rowId"] ?? start, start, extend),
    })
  })

  table.addEventListener("keydown", (event) => {
    if (selectionKeys(event)) return
    if (!navigable() || event.defaultPrevented) return
    const target = event.target
    if (!(target instanceof HTMLElement)) return

    const cell = target.closest<HTMLElement>("td[tabindex]")
    if (!cell || !table.contains(cell) || head.contains(cell)) return

    // From a control inside a cell, Escape goes back to the cell.
    if (cell !== target) {
      if (event.key === "Escape") {
        event.preventDefault()
        cell.focus()
      }
      return
    }

    const rowId = cell.parentElement?.dataset["rowId"]
    const key = cell.dataset["key"]
    if (rowId === undefined || key === undefined) return

    // An editable cell opens its editor on Enter or F2, and on typing — seeded with what was typed.
    if (cell.dataset["editable"] === "true") {
      const typed = typedCharacter(event)
      const seed =
        event.key === "Enter" || event.key === "F2"
          ? null
          : event.key === "Backspace" || event.key === "Delete"
            ? ""
            : typed
      if (seed !== undefined) {
        event.preventDefault()
        startEdit(rowId, key, seed ?? undefined)
        return
      }
    }

    // Alt with an arrow moves the row, from any of its cells.
    if (settings.rowReorder && event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault()
      stepRowBy(rowId, event.key === "ArrowUp" ? -1 : 1)
      return
    }

    if (isNavigationKey(event.key) && !event.altKey && !event.shiftKey) {
      const next = nextCell({ rows: gridRowIds(), columns: navColumns }, { rowId, key }, event.key, {
        ctrlKey: event.ctrlKey || event.metaKey,
        pageRows: pageRowsFrom(cell),
        rtl: getComputedStyle(cell).direction === "rtl",
      })
      event.preventDefault()
      if (!next) return
      const element = cellElement(next.rowId, next.key)
      element?.focus({ preventScroll: true })
      if (typeof element?.scrollIntoView === "function") element.scrollIntoView({ block: "nearest", inline: "nearest" })
      return
    }

    if (event.key === "Enter" || event.key === "F2" || event.key === " ") {
      const own = cell.querySelector<HTMLElement>("input.tpz-checkbox, button.tpz-expander")
      if ((key === "__select" || key === "__expand") && own) {
        event.preventDefault()
        own.click()
        return
      }

      if (event.key !== " ") {
        const control = cell.querySelector<HTMLElement>(INTERACTIVE_SELECTOR)
        if (control) {
          event.preventDefault()
          control.focus()
        }
      }
    }
  })

  /* ── Moving rows ───────────────────────────────────────────────────────── */

  /** A row's parent among the data, for a table with child rows. */
  function parentOf(row: TRow, dataIds: ReadonlySet<string>): string | undefined {
    const parent = settings.getParentId?.(row)
    return parent !== null && parent !== undefined && parent !== "" && dataIds.has(String(parent)) ? String(parent) : undefined
  }

  /**
   * The rows a row moves among: every matching row at its level, not only
   * this page — the other children of its parent, for a child. In server mode
   * the page is all there is.
   */
  function siblingsOf(rowId: string): { ids: string[]; parentId: string | undefined } {
    const data = settings.data
    const dataIds = new Set(data.map((row, index) => resolveRowId(row, index, settings.getRowId)))
    const row = lookupRow(rowId)?.row
    const parentId = row === undefined ? undefined : parentOf(row, dataIds)
    const pool = settings.server ? renderedRows : current().matched
    const ids: string[] = []
    pool.forEach((candidate, index) => {
      if (parentOf(candidate, dataIds) === parentId) ids.push(resolveRowId(candidate, index, settings.getRowId))
    })
    return { ids, parentId }
  }

  function reportMove(rowId: string, result: { afterId: string | null; beforeId: string | null; order: string[] }, parentId: string | undefined) {
    const reorder = settings.rowReorder
    const row = lookupRow(rowId)?.row
    if (!reorder || row === undefined) return
    const move: RowMove<TRow> = { rowId, row, afterId: result.afterId, beforeId: result.beforeId, ...(parentId ? { parentId } : {}) }
    announcer.textContent = `Moved to position ${String(result.order.indexOf(rowId) + 1)} of ${String(result.order.length)}`

    const outcome = reorder.onReorder(move)
    if (!isPromiseLike(outcome)) return

    const made = { data: settings.data, move }
    pendingMove = made
    render()
    const settle = () => {
      if (pendingMove !== made) return
      pendingMove = undefined
      render()
    }
    outcome.then(settle, () => {
      settle()
      announcer.textContent = "The move was not saved"
    })
  }

  function beginRowDrag(id: string, tr: HTMLElement, event: PointerEvent) {
    const { ids, parentId } = siblingsOf(id)
    const draggedIsChild = parentId !== undefined
    startRowDrag({
      event,
      row: tr,
      targetFor: (element) => {
        const over = element.closest<HTMLElement>("tr[data-row-id]")
        if (!over || !body.contains(over)) return undefined
        const overId = over.dataset["rowId"] ?? ""
        if (ids.includes(overId)) return over
        // A parent is dropped beside a parent: a child row it passes over stands for its own parent.
        if (!draggedIsChild && over.dataset["depth"] === "1") {
          let previous = over.previousElementSibling
          while (previous instanceof HTMLElement && previous.dataset["depth"] === "1") previous = previous.previousElementSibling
          return previous instanceof HTMLElement && ids.includes(previous.dataset["rowId"] ?? "") ? previous : undefined
        }
        return undefined
      },
      onDrop: (target, position) => {
        const result = moveRowTo(ids, id, target.dataset["rowId"] ?? "", position)
        if (result) reportMove(id, result, parentId)
      },
    })
  }

  function stepRowBy(id: string, delta: -1 | 1) {
    if (!canReorderRows(state.sort)) return
    const { ids, parentId } = siblingsOf(id)
    const result = stepRow(ids, id, delta)
    if (!result) return
    reportMove(id, result, parentId)
    // The keyboard stays on the row it moved, wherever the rows were drawn again.
    const cell = cellElement(id, "__drag")
    const handle = cell?.querySelector<HTMLElement>(".tpz-drag-handle")
    ;(handle ?? cell)?.focus()
  }

  /** The id of a row's detail, which its expander points at. */
  function detailId(id: string): string {
    return `${settings.id ?? "tpz"}-detail-${encodeURIComponent(id)}`
  }

  /**
   * A row's detail row, when it should be in the document: open, or closed
   * but kept by `keepMounted` after being opened once. One already built for
   * the same row object is reused rather than built again.
   */
  function detailFor(
    row: TRow,
    id: string,
    index: number,
    build: RowBuild,
    previous: Map<string, { row: TRow; tr: HTMLElement }>,
  ): HTMLElement | undefined {
    const detail = settings.detail
    if (!detail) return undefined

    const open = isDetailOpen(state, row, id, detail)
    const kept = previous.get(id)
    const reusable = kept && kept.row === row ? kept.tr : undefined

    if (!open && !(detail.keepMounted && reusable)) return undefined

    const tr = reusable ?? buildDetailRow(row, id, index, build)
    tr.hidden = !open
    // A kept row may have been built when the table had another column count.
    tr.firstElementChild?.setAttribute("colspan", String(build.columnCount))
    detailNodes.set(id, { row, tr })
    return tr
  }

  function buildDetailRow(row: TRow, id: string, index: number, build: RowBuild): HTMLElement {
    const content = settings.detail?.render({
      row,
      rowId: id,
      rowIndex: index,
      collapse: () => update(setExpanded(state, [id], false)),
    })
    const inner = el("div", { class: "tpz-detail" })
    if (content !== undefined && content !== null) inner.append(typeof content === "string" ? text(content) : content)

    return el("tr", { class: build.cls("detailRow"), id: detailId(id), "data-detail-for": id }, [
      el("td", { class: build.cls("detailCell"), colspan: build.columnCount, "data-wrap": "true" }, [inner]),
    ])
  }

  /**
   * Brings the detail rows on screen into line with the state, without
   * rebuilding the rows around them — so the expander just pressed keeps its
   * focus, and every other open detail keeps whatever is in it.
   */
  function syncDetails(build: RowBuild) {
    const detail = settings.detail
    if (!detail && detailNodes.size === 0) return

    const previous = detailNodes
    detailNodes = new Map()

    renderedRows.forEach((row, index) => {
      const id = renderedIds[index]!
      const tr = renderedNodes[index]
      if (!tr) return

      const open = isDetailOpen(state, row, id, detail)
      if (open) tr.dataset["expanded"] = "true"
      else delete tr.dataset["expanded"]

      const button = tr.querySelector<HTMLButtonElement>(".tpz-expander")
      if (button) {
        button.setAttribute("aria-expanded", open ? "true" : "false")
        if (open) button.setAttribute("aria-controls", detailId(id))
        else button.removeAttribute("aria-controls")
        button.setAttribute("aria-label", `${open ? "Hide" : "Show"} details for row ${String(index + 1)}`)
      }

      const node = detailFor(row, id, index, build, previous)
      const current = previous.get(id)?.tr
      if (current && current !== node) current.remove()
      if (node && tr.nextSibling !== node) tr.after(node)
    })

    // Details whose rows have gone — scrolled off by a page that replaced them.
    for (const [id, entry] of previous) {
      if (!detailNodes.has(id) || detailNodes.get(id)?.tr !== entry.tr) entry.tr.remove()
    }

    syncExpandAll()
  }

  /** The header's expander, after the rows or the open details beneath it moved. */
  function syncExpandAll() {
    const button = expandAllButton
    if (!button) return

    const ids = expandableIds(renderedRows, renderedIds, settings.detail)
    const open = ids.filter((id) => (state.expanded ?? []).includes(id)).length
    const all = ids.length > 0 && open === ids.length

    // Present only while there is a row to open, as it is in every adapter.
    const cell = expandHeader
    if (ids.length === 0) button.remove()
    else if (cell && button.parentNode !== cell) cell.append(button)

    button.setAttribute("aria-expanded", all ? "true" : "false")
    button.setAttribute(
      "aria-label",
      all ? "Hide details for every row on this page" : "Show details for every row on this page",
    )
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
      detail: Boolean(settings.detail),
      navigable: navigable(),
      editable: renderedEditable,
      tree: Boolean(settings.getParentId),
      reorder: Boolean(settings.rowReorder),
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
        column.pinWhen ?? null,
        column.width ?? null,
        column.minWidth ?? null,
        column.maxWidth ?? null,
        column.grow ?? null,
        column.className ?? null,
        column.sortable,
        column.headerSearch,
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

    const { scope, all, matching, total } = headerSelection()
    const selectedHere = scope.filter((id) => state.selection.includes(id)).length

    selectAllBox.defaultChecked = all
    selectAllBox.checked = all
    selectAllBox.indeterminate = selectedHere > 0 && !all
    selectAllBox.setAttribute(
      "aria-label",
      all ? "Clear selection" : matching ? `Select all ${total.toLocaleString()} matching rows` : "Select all rows on this page",
    )
  }

  /**
   * What the header checkbox speaks for: the selectable rows on screen, or —
   * with `selectAll: "matching"` — every selectable row the filters leave,
   * which in server mode the table can only count, not list.
   */
  function headerSelection(): { scope: string[]; all: boolean; matching: boolean; total: number } {
    const selection = selectionOf()
    const matching = selection?.selectAll === "matching"
    if (!matching) {
      const scope = [...renderedSelectable]
      return { scope, all: scope.length > 0 && scope.every((id) => state.selection.includes(id)), matching, total: scope.length }
    }

    const { matched, total } = current()
    if (settings.server) {
      const scope = [...renderedSelectable]
      const all = scope.length > 0 && scope.every((id) => state.selection.includes(id)) && state.selection.length >= total
      return { scope, all, matching, total }
    }

    const scope = selectableIds(matched, matched.map((row, index) => resolveRowId(row, index, settings.getRowId)), selection?.isSelectable)
    return { scope, all: scope.length > 0 && scope.every((id) => state.selection.includes(id)), matching, total }
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
    // Filtered rather than selected with a list: a server's elements understand one compound selector at a time.
    const cells = [...head.querySelectorAll<HTMLElement>("th[data-key]")].filter(
      (cell) => cell.dataset["pin"] !== undefined || cell.dataset["pinWhen"] !== undefined,
    )
    const offsets: Record<string, number> = {}
    const sideOf = (cell: HTMLElement) => cell.dataset["pin"] ?? (cell.dataset["pinWhen"]?.startsWith("end") ? "end" : "start")
    /*
      A column frozen by width is counted only while its container query has
      frozen it, which the browser says by its position. A server has no
      layout to ask, and nothing is frozen there but the columns always pinned.
    */
    const frozen = (cell: HTMLElement) =>
      cell.dataset["pin"] !== undefined ||
      (typeof getComputedStyle === "function" && cell instanceof Element && getComputedStyle(cell).position === "sticky")

    let start = 0
    for (const cell of cells.filter((entry) => sideOf(entry) === "start")) {
      offsets[cell.dataset["key"] ?? ""] = start
      if (frozen(cell)) start += cell.getBoundingClientRect().width
    }

    let end = 0
    for (const cell of cells.filter((entry) => sideOf(entry) === "end").reverse()) {
      offsets[cell.dataset["key"] ?? ""] = end
      if (frozen(cell)) end += cell.getBoundingClientRect().width
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
    // A column frozen by width reads its offset from a custom property: `left` would move it while it is not frozen.
    for (const cell of scope.querySelectorAll<HTMLElement>("[data-pin-when][data-key]")) {
      const offset = offsets[cell.dataset["key"] ?? ""]
      if (offset !== undefined) cell.style.setProperty("--tpz-pin-offset", `${String(offset)}px`)
    }
  }

  /**
   * A column's width on one of its cells: written only where it differs, so a
   * cell built a moment ago is left exactly as it was, and taken off when the
   * column no longer has it.
   */
  function applySizing(cell: HTMLElement, sizing: CellSizing | undefined) {
    const properties: Record<string, string> = { width: "width", minWidth: "min-width", maxWidth: "max-width", "--tpz-col-cap": "--tpz-col-cap" }
    for (const [name, css] of Object.entries(properties)) {
      const wanted = sizing?.style[name] ?? ""
      if (cell.style.getPropertyValue(css) === wanted) continue
      if (wanted === "") cell.style.removeProperty(css)
      else cell.style.setProperty(css, wanted)
    }
    if (sizing?.size) cell.dataset["size"] = sizing.size
    else delete cell.dataset["size"]
  }

  /*
    A width of the table that freezes or frees a column moves the offsets of
    the others, so while any column is pinned by width the root is watched.
  */
  let widthObserver: ResizeObserver | undefined
  function watchWidth(wanted: boolean) {
    if (!wanted || typeof ResizeObserver === "undefined") {
      widthObserver?.disconnect()
      widthObserver = undefined
      return
    }
    if (widthObserver) return
    widthObserver = new ResizeObserver(() => applyPinOffsets())
    widthObserver.observe(root)
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
      const { scope, all, matching } = headerSelection()
      if (all) {
        update(matching ? clearSelection(state) : setSelected(state, scope, false))
        return
      }
      if (!matching || !settings.server) {
        update(setSelected(state, scope, true))
        return
      }

      // Every matching row lives on the server; ask for them.
      const ask = source()?.all
      if (!ask) {
        warnAboutServerSelectAll()
        update(setSelected(state, scope, true))
        return
      }
      box.disabled = true
      box.setAttribute("aria-busy", "true")
      void Promise.resolve(ask(state))
        .then((everyRow) => {
          const ids = selectableIds(everyRow, everyRow.map((row, index) => resolveRowId(row, index, settings.getRowId)), selectionOf()?.isSelectable)
          update(setSelected(state, ids, true))
        })
        .finally(() => {
          box.disabled = false
          box.removeAttribute("aria-busy")
        })
    })

    cell.append(box)
    selectAllBox = box
    return cell
  }

  /**
   * The header cell above the expanders, with a button that opens or closes
   * every row on the page. Like the selection header it reads the rows on
   * screen when it is pressed, not when it was built.
   */
  function expandHeaderCell(): HTMLElement {
    const cell = el("th", {
      scope: "col",
      class: "tpz-th tpz-expand-cell",
      "data-pin": "start",
      "data-key": "__expand",
    })

    const button = el(
      "button",
      { type: "button", class: "tpz-expander", "aria-expanded": "false", "aria-label": "" },
      [icon("chevronRight", 14)],
    )
    button.addEventListener("click", () => {
      const ids = expandableIds(renderedRows, renderedIds, settings.detail)
      const all = ids.length > 0 && ids.every((id) => (state.expanded ?? []).includes(id))
      update(setExpanded(state, ids, !all))
    })

    expandAllButton = button
    expandHeader = cell
    syncExpandAll()
    return cell
  }

  /* ── Header ────────────────────────────────────────────────────────────── */

  /** What a header cell was built from, and the parts of it that change with the state. */
  type HeaderParts = {
    signature: string
    /** The sort control: a button, a link, or a plain span on a column that cannot be sorted. */
    label: HTMLElement
    /** Whether that control is a link, whose address follows the state. */
    link: boolean
    /** The magnifier, on a column that can be searched from its header. */
    search: HTMLElement | undefined
    /** The slot for the column's own controls, on a column with `renderHeaderControls`. */
    controls: HTMLElement | undefined
  }

  /** The header cell on screen for each column, by key. */
  let headerCells = new Map<string, HTMLElement>()
  const headerParts = new WeakMap<HTMLElement, HeaderParts>()
  /** The columns the header was last drawn from, for handlers that run long after. */
  let headerColumns: ResolvedColumn<TRow, Node | string>[] = []
  /** The sort levels those columns can speak for — see `sortLevels`. */
  let headerLevels: Sort[] = []
  /**
   * True for the one render that follows a state handed in through
   * `setOptions` — by a wrapper, from a URL or a parent — as distinct from a
   * change the table made itself. An open search box needs to know which.
   */
  let stateHandedIn = false
  let selectionCell: { mode: "single" | "multiple"; cell: HTMLElement } | undefined
  /** The header cell above the expanders, kept across renders like the selection's. */
  let expandHeader: HTMLElement | undefined
  /** The header cell above the drag handles. */
  let dragHeader: HTMLElement | undefined

  /**
   * Brings the header into line with the state, keeping every cell it can.
   *
   * The body is rebuilt because its rows change; the header's cells almost
   * never do. What changes is small — an arrow, a number, a tint, the address
   * a link points at — so those are patched onto the cell that is already
   * there, and a cell is only built again when something structural about its
   * column has moved.
   *
   * That is not an economy. A header control thrown away and replaced under
   * somebody's hand loses their focus, loses the click they were half-way
   * through, and — for a column being searched from its header — loses the
   * box they were typing into, word and caret and all.
   */
  function renderHeader(
    columns: ResolvedColumn<TRow, Node | string>[],
    cls: ReturnType<typeof classes>,
    selectionMode: "single" | "multiple" | undefined,
  ) {
    headerColumns = columns
    // The levels that really order the rows, which is what the headers number:
    // not one on a column hidden since, or named twice in a link.
    headerLevels = sortLevels(state.sort, columns)
    headerRow.className = cls("headerRow")

    const cells: HTMLElement[] = []

    if (settings.rowReorder) {
      dragHeader ??= el("th", { scope: "col", class: "tpz-th tpz-drag-cell", "data-pin": "start", "data-key": "__drag" }, [
        el("span", { class: "tpz-sr", text: "Move" }),
      ])
      cells.push(dragHeader)
    } else {
      dragHeader = undefined
    }

    if (selectionMode) {
      if (selectionCell?.mode !== selectionMode) {
        selectionCell = { mode: selectionMode, cell: selectionHeader(selectionMode) }
      }
      cells.push(selectionCell.cell)
    } else {
      selectionCell = undefined
      selectAllBox = undefined
    }

    if (settings.detail) {
      expandHeader ??= expandHeaderCell()
      cells.push(expandHeader)
    } else {
      expandHeader = undefined
      expandAllButton = undefined
    }

    // A search box open over a column that is no longer shown has nothing to
    // be open over.
    if (headerSearch && !columns.some((column) => column.key === headerSearch?.key)) {
      clearTimeout(headerSearch.timer)
      headerSearch.dispose()
      headerSearch = undefined
    }

    const next = new Map<string, HTMLElement>()

    for (const column of columns) {
      const existing = headerCells.get(column.key)
      const parts = existing ? headerParts.get(existing) : undefined
      const searching = headerSearch?.key === column.key && headerSearch.cell === existing

      /*
        The cell being typed into is kept whatever has changed around it — a
        wrapper that hands over fresh options on every keystroke must not cost
        the person their place — and is built afresh when the box closes.
      */
      const kept = existing && parts && (searching || parts.signature === headerSignature(column, columns, cls))
      const cell = kept ? existing : headerCell(column, columns, cls)

      if (kept) syncHeaderCell(cell, column)
      next.set(column.key, cell)
      cells.push(cell)
    }

    headerCells = next

    placeHeaderCells(cells)

    const open = headerSearch
    if (!open) return

    /*
      The state's word on what the column is searched for, and what to make of
      it when it is not what the box last asked for.

      Usually that is somebody else's doing — the chip removed, the back button
      pressed — and the box follows. But a wrapper whose state is held
      elsewhere, in a URL or a parent component, hands it back late: by the
      time "ada" comes back the box may have been emptied, and taking the late
      answer as news would undo the Escape that emptied it. So a state handed
      in from outside that says something this box sent earlier is not
      followed; it is answered with what is wanted now.
    */
    const text = columnSearchText(state, open.key)
    const handedIn = stateHandedIn

    if (text === open.committed) {
      // The answer to the latest thing asked: nothing earlier is still on its way.
      if (handedIn) open.sent = []
      return
    }

    if (handedIn && open.sent.includes(text)) {
      open.sent = open.sent.filter((earlier) => earlier !== text)
      const wanted = open.committed
      // After this render, not inside it.
      setTimeout(() => {
        if (headerSearch === open) update(setColumnSearch(state, open.key, wanted))
      }, 0)
      return
    }

    open.committed = text
    open.sent = []
    open.input.value = text
  }

  /**
   * Puts the header's cells in the row, moving as little as it can.
   *
   * Taking an element out of the document drops its focus, even if it is put
   * straight back — so when the cells are already the right ones in the right
   * order nothing is touched, and when they are not, the cell that holds the
   * focus stays exactly where it is and the others are arranged around it.
   * That is what lets a column be hidden, or every other header be rebuilt,
   * while somebody is typing into this one.
   */
  function placeHeaderCells(cells: HTMLElement[]) {
    const current = [...headerRow.children]
    if (current.length === cells.length && cells.every((cell, index) => current[index] === cell)) return

    const focused = currentDocument().activeElement
    const index = focused ? cells.findIndex((cell) => cell.contains(focused)) : -1
    const anchor = cells[index]

    if (!anchor || anchor.parentNode !== headerRow) {
      fill(headerRow, cells)
      return
    }

    for (const child of current) {
      if (child !== anchor) child.remove()
    }
    anchor.before(...cells.slice(0, index))
    anchor.after(...cells.slice(index + 1))
  }

  /**
   * Everything about a header cell that is decided when it is built.
   *
   * If this is unchanged the cell on screen is still the right cell, and only
   * what `syncHeaderCell` writes can have moved. A field missing here is a
   * header that quietly stops following its column, so it names everything
   * the cell is built from.
   *
   * It does not include `generation`, which `shapeOf` uses to rebuild the rows
   * whenever an option changes identity. A row may depend on any function the
   * caller passes; a header depends on none of them — its handlers read the
   * settings when they run, not when they were made. That matters most to the
   * wrappers: a Vue template writes `:get-row-id="(row) => row.id"` inline,
   * which is a new function on every render of the parent, and if that rebuilt
   * the header then every sort would drop the focus of the header just sorted.
   *
   * Nor does it include the column's widths, which `syncHeaderCell` writes. A
   * column is resized by dragging a handle inside its own header cell: if a
   * new width rebuilt the cell, the first movement of the drag would throw
   * away the handle being dragged, and the rest of the drag with it.
   */
  function headerSignature(
    column: ResolvedColumn<TRow, Node | string>,
    columns: ResolvedColumn<TRow, Node | string>[],
    cls: ReturnType<typeof classes>,
  ): string {
    const sorting = resolveSorting(settings.sortable)

    return JSON.stringify([
      cls("headerCell", column.headerClassName),
      column.header,
      column.icon,
      column.align,
      column.pin ?? null,
      isPinEdge(columns, column.key),
      sorting !== undefined && column.sortable,
      Boolean(settings.buildHref),
      settings.columnMenu !== false,
      settings.resizable !== false && column.resizable !== false,
      settings.reorderable !== false && column.reorderable !== false,
      settings.filters !== false && column.headerSearch,
      column.description ?? null,
      Boolean(column.renderHeader),
      Boolean(column.renderHeaderControls),
    ])
  }

  function headerCell(
    column: ResolvedColumn<TRow, Node | string>,
    columns: ResolvedColumn<TRow, Node | string>[],
    cls: ReturnType<typeof classes>,
  ): HTMLElement {
    const key = column.key
    const sortable = resolveSorting(settings.sortable) !== undefined && column.sortable

    /*
      The attributes that follow the state are given their places here and
      their values by `syncHeaderCell`, so that a cell built fresh — which is
      every cell a server writes, and every cell the browser first draws —
      always carries its attributes in the same order.
    */
    const cell = el("th", {
      scope: "col",
      class: cls("headerCell", column.headerClassName),
      "data-align": column.align,
      "data-pin": column.pin,
      "data-pin-edge": isPinEdge(columns, key) ? column.pin : undefined,
      "data-pin-when": column.pinWhen ? pinWhenToken(column.pinWhen) : undefined,
      "data-key": key,
      "data-filtered": state.filters.some((entry) => entry.key === key) ? "true" : undefined,
      "aria-sort": "none",
    })

    const inner = el("div", { class: "tpz-th-inner" })
    const reorderable = settings.reorderable !== false && column.reorderable !== false && !column.pin

    if (reorderable) {
      // The whole header is the handle. A grip inside it is a 28px target for
      // something as physical as moving a column, and every table people have
      // used lets them grab the header itself.
      cell.draggable = true
      cell.dataset["draggable"] = "true"
      attachColumnDrag(cell, key)
    }

    /*
      A column that can be searched from its header has the magnifier where its
      icon would be — the same slot, as a button, drawing both and leaving the
      stylesheet to decide which is seen. Otherwise the icon announces nothing:
      dragging is a pointer affordance, and its keyboard equivalent is "Move
      left" and "Move right" in the column panel.
    */
    let search: HTMLElement | undefined
    if (settings.filters !== false && column.headerSearch) {
      const type = icon(column.icon, 14, "tpz-th-type")
      search = el(
        "button",
        {
          type: "button",
          class: "tpz-th-icon tpz-th-search",
          // With no icon to stand in for, the magnifier is the slot's resting state.
          "data-bare": type ? undefined : "true",
        },
        [type, icon("search", 14, "tpz-th-glass")],
      )
      search.addEventListener("click", () => openHeaderSearch(cell, key))
      inner.append(search)
    } else {
      inner.append(el("span", { class: "tpz-th-icon", "aria-hidden": "true" }, [icon(column.icon)]))
    }

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
    // Filled by `syncHeaderCell`: a header renderer is handed the column's sort, which moves.
    const labelText = el("span", { class: "tpz-th-label" })
    const link = sortable && settings.buildHref !== undefined
    const describedBy = column.description ? `${settings.id ?? "tpz"}-desc-${encodeURIComponent(key)}` : undefined
    const label =
      link
        ? routed(
            el("a", { href: "", class: "tpz-th-button", "aria-label": "", "aria-describedby": describedBy, draggable: "false" }, [
              labelText,
            ]),
          )
        : el(
            sortable ? "button" : "span",
            {
              class: "tpz-th-button",
              type: sortable ? "button" : undefined,
              // Named for the column, whatever a header renderer draws inside it.
              "aria-label": sortable && column.renderHeader && column.header ? column.header : undefined,
              "aria-describedby": sortable ? describedBy : undefined,
            },
            [labelText],
          )

    if (sortable) {
      /*
        A shift-click adds a level instead of replacing the sort. A plain click
        on a link is the link's, and `routed` has it.

        A shift-click on a link is caught before the browser can answer it
        with a new window, and sent where it means to go. A table whose
        controls are links keeps its view in an address, so that is the
        address of the view with this column added to the sort: by the
        caller's router when it gave one, and by the browser when nothing at
        all is listening — the table with no script wired up. In between, a
        caller that listens for state is already turning state into addresses,
        and is left to.
      */
      label.addEventListener("click", (event) => {
        const additive =
          event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey && event.button === 0 &&
          resolveSorting(settings.sortable)?.multiple === true

        if (!settings.buildHref) {
          update(toggleSort(state, key, additive))
          return
        }

        if (!additive) return
        event.preventDefault()
        event.stopImmediatePropagation()

        const next = toggleSort(state, key, true)
        if (settings.onNavigate) settings.onNavigate(settings.buildHref(next), event)
        else if (settings.onStateChange) update(next)
        else window.location.assign(settings.buildHref(next))
      })

      // A shift-click also stretches the page's text selection to wherever
      // was clicked, which paints half the table blue for a gesture that meant
      // "sort by this as well".
      label.addEventListener("mousedown", (event) => {
        if (event.shiftKey && resolveSorting(settings.sortable)?.multiple) event.preventDefault()
      })
    }
    inner.append(label)

    /*
      The column's own controls, outside the sort control so they can be
      controls, and marked interactive so nothing of the table's reads a click
      in them as its own. Filled by `syncHeaderCell`, which hands the renderer
      the sort as it stands and keeps a node it is given back.

      A press in them turns the header's dragging off until it is released:
      the whole header is the handle for moving the column, and a draggable
      ancestor takes the mouse away from a text box — the reason the header
      search does the same.
    */
    let controls: HTMLElement | undefined
    if (column.renderHeaderControls) {
      const slot = el("span", { class: "tpz-th-controls", "data-tpz-interactive": "" })
      slot.addEventListener("pointerdown", () => {
        if (!cell.draggable) return
        cell.draggable = false
        const release = () => {
          if (headerSearch?.cell !== cell) cell.draggable = reorderable
          window.removeEventListener("pointerup", release)
          window.removeEventListener("pointercancel", release)
        }
        window.addEventListener("pointerup", release)
        window.addEventListener("pointercancel", release)
      })
      // A backstop for a drag the browser starts before the header has
      // stopped being draggable.
      slot.addEventListener("dragstart", (event) => {
        event.preventDefault()
        event.stopPropagation()
      })
      inner.append(slot)
      controls = slot
    }

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
      trigger.addEventListener("click", () => openHeaderMenu(trigger, key))
      inner.append(trigger)
    }

    if (settings.resizable !== false && column.resizable !== false) {
      inner.append(resizeHandle(cell, column))
    }

    cell.append(inner)

    /*
      A column's description: always in the header for a screen reader, linked
      by `aria-describedby`, and a tooltip beside the header while it is hovered
      or has the keyboard — for the eye only, since it is already announced.
    */
    if (column.description && describedBy) {
      const text = column.description
      cell.dataset["described"] = "true"
      cell.setAttribute("aria-describedby", describedBy)
      cell.append(el("span", { id: describedBy, class: "tpz-sr", text }))

      let tip: { dispose(): void } | undefined
      let timer: ReturnType<typeof setTimeout> | undefined
      const show = (delay: number) => {
        clearTimeout(timer)
        timer = setTimeout(() => {
          if (tip) return
          tip = openPopup(labelText, el("div", { class: "tpz-tooltip", "aria-hidden": "true", text }), settings.theme)
        }, delay)
      }
      const hide = () => {
        clearTimeout(timer)
        tip?.dispose()
        tip = undefined
      }
      cell.addEventListener("mouseenter", () => show(400))
      cell.addEventListener("mouseleave", hide)
      cell.addEventListener("focusin", () => show(0))
      cell.addEventListener("focusout", hide)
      cell.addEventListener("keydown", (event) => {
        if (event.key === "Escape") hide()
      })
    }

    headerParts.set(cell, { signature: headerSignature(column, columns, cls), label, link, search, controls })
    syncHeaderCell(cell, column)
    return cell
  }

  /**
   * Writes onto a header cell everything that follows the state: whether and
   * how its column is sorted, whether it is filtered, where its link goes, and
   * what its magnifier says. The one place any of that is written, whether the
   * cell was built a moment ago or an hour ago.
   */
  function syncHeaderCell(cell: HTMLElement, column: ResolvedColumn<TRow, Node | string>) {
    const parts = headerParts.get(cell)
    if (!parts) return

    const key = column.key
    const sort = headerLevels.find((entry) => entry.key === key)
    const priority = sortPriority(headerLevels, key)

    cell.setAttribute("aria-sort", sort ? (sort.direction === "asc" ? "ascending" : "descending") : "none")

    // The column's width, which follows a drag without the cell being built again.
    applySizing(cell, columnSizing(headerColumns)[key])

    if (state.filters.some((entry) => entry.key === key)) cell.dataset["filtered"] = "true"
    else delete cell.dataset["filtered"]

    /*
      The arrow and the number after the label. The label itself is left where
      it is: it is what a person is most likely pressing on, and a node swapped
      out between a press and its release is a click that never arrives.
    */
    const marks: Array<Node | null> = sort
      ? [icon(sort.direction === "asc" ? "sortAscending" : "sortDescending", 12, "tpz-th-marker")]
      : []

    if (priority !== undefined) {
      marks.push(
        el("span", { class: "tpz-th-order", "aria-hidden": "true", text: String(priority) }),
        el("span", { class: "tpz-sr", text: `, sort level ${String(priority)}` }),
      )
    }

    while (parts.label.childNodes.length > 1) parts.label.lastChild?.remove()
    parts.label.append(...marks.filter((mark): mark is Node => mark !== null))

    // The header's text, or what its renderer draws for the sort as it now stands.
    const labelText = parts.label.firstElementChild
    if (labelText) {
      const drawn = column.renderHeader ? column.renderHeader({ column, sort }) : column.header
      labelText.replaceChildren(typeof drawn === "string" ? text(drawn) : drawn)
    }

    /*
      The column's own controls, drawn for the sort as it now stands. A node
      already in the slot is left exactly where it is — that is what keeps a
      control's focus, and what was typed in it, while the table changes
      around it — so a renderer that hands back the same node keeps its
      control. Nothing to draw empties the slot, and the text has the header.
    */
    if (parts.controls && column.renderHeaderControls) {
      const drawn = column.renderHeaderControls({ column, sort })
      const slot = parts.controls
      // A renderer may hand back nothing at all, whatever its type says.
      if (!drawn) {
        slot.replaceChildren()
        slot.setAttribute("hidden", "")
        delete cell.dataset["controls"]
      } else {
        slot.removeAttribute("hidden")
        cell.dataset["controls"] = "true"
        if (typeof drawn === "string") {
          if (slot.childNodes.length !== 1 || slot.textContent !== drawn) slot.replaceChildren(text(drawn))
        } else if (slot.childNodes.length !== 1 || slot.firstChild !== drawn) {
          slot.replaceChildren(drawn)
        }
      }
    }

    if (parts.link && settings.buildHref) {
      parts.label.setAttribute("href", settings.buildHref(toggleSort(state, key)))
      // Replaces the link's own text as its name, so the level has to be said here.
      parts.label.setAttribute(
        "aria-label",
        priority === undefined ? `Sort by ${column.header}` : `Sort by ${column.header}, sort level ${String(priority)}`,
      )
    }

    if (parts.search) {
      const text = columnSearchText(state, key)
      const name = text === "" ? `Search ${column.header}` : `Search ${column.header}, searching for ${text}`
      parts.search.setAttribute("aria-label", name)
      parts.search.setAttribute("title", name)
      if (text === "") delete parts.search.dataset["active"]
      else parts.search.dataset["active"] = "true"
    }
  }

  /* ── Searching a column from its header ────────────────────────────────── */

  /**
   * The search box that is open, if one is.
   *
   * At most one, and never on a server: a box is opened by a click. It is laid
   * over its header cell rather than put in place of the cell's contents, so
   * the label underneath goes on holding the column to the width it was.
   */
  let headerSearch:
    | {
        key: string
        cell: HTMLElement
        input: HTMLInputElement
        /** What the table has been told, so that the same text is not told to it twice. */
        committed: string
        /** Searches sent before that one, which a table whose state lives elsewhere may yet report back. */
        sent: string[]
        timer: ReturnType<typeof setTimeout> | undefined
        /** Takes away what the box was listening for outside itself. */
        dispose: () => void
      }
    | undefined

  function openHeaderSearch(cell: HTMLElement, key: string) {
    closeHeaderSearch(false)

    const column = headerColumns.find((entry) => entry.key === key)
    if (!column) return

    const text = columnSearchText(state, key)

    const input = el("input", {
      type: "text",
      role: "searchbox",
      class: "tpz-th-search-input",
      placeholder: column.header,
      "aria-label": `Search ${column.header}`,
      autocomplete: "off",
      spellcheck: "false",
      enterkeyhint: "search",
      value: text,
    })
    const clear = el(
      "button",
      { type: "button", class: "tpz-th-search-clear", "aria-label": `Clear search on ${column.header}` },
      [icon("close", 12)],
    )
    const box = el("div", { class: "tpz-th-searchbox" }, [
      el("span", { class: "tpz-th-icon", "aria-hidden": "true" }, [icon("search")]),
      input,
      clear,
    ])

    /*
      Whether the pointer is being pressed somewhere outside the box. A press
      is the first half of a click, and it is also what takes the focus away —
      see the `focusout` handler for why the two have to be told apart.
    */
    let pressedOutside = false
    const page = currentDocument()
    const onPress = (event: Event) => {
      pressedOutside = !(event.target instanceof Node && box.contains(event.target))
    }
    page.addEventListener("pointerdown", onPress, true)

    const open: NonNullable<typeof headerSearch> = {
      key,
      cell,
      input,
      committed: text,
      sent: [],
      timer: undefined,
      dispose: () => page.removeEventListener("pointerdown", onPress, true),
    }
    headerSearch = open

    /** Tells the table what has been typed, unless it already knows. */
    const commit = () => {
      clearTimeout(open.timer)
      const query = input.value.trim()
      if (query === open.committed) return
      open.committed = query
      open.sent.push(query)
      update(setColumnSearch(state, key, query))
    }

    const schedule = () => {
      clearTimeout(open.timer)
      open.timer = setTimeout(commit, resolveHeaderSearch(settings.headerSearch).debounce)
    }

    // Typing is local until it settles, the same way the toolbar's search is:
    // the wait belongs to a person typing, not to the table. Half a composed
    // character is not something to search for, so an input method is waited
    // out as well.
    input.addEventListener("input", (event) => {
      if (event instanceof InputEvent && event.isComposing) clearTimeout(open.timer)
      else schedule()
    })
    input.addEventListener("compositionend", schedule)

    /*
      A press anywhere in the box but the text keeps the focus where it is.
      Safari does not focus a button that is clicked, so without this a press
      on the clear button reads as focus leaving — the box would keep the
      search and close before the click that was meant to clear it arrived.
    */
    box.addEventListener("mousedown", (event) => {
      if (event.target !== input) event.preventDefault()
    })

    input.addEventListener("keydown", (event) => {
      // The Enter that confirms a composed character belongs to the input
      // method, not to the box. Safari reports it as an ordinary key.
      if (event.isComposing || event.keyCode === 229) return

      if (event.key === "Enter") {
        // Prevented, or the key carries on to wherever focus lands. Focus goes
        // back to the magnifier, and Enter on a button presses it: the box
        // would close and open again in one keystroke.
        event.preventDefault()
        commit()
        closeHeaderSearch(true)
      }

      if (event.key === "Escape") {
        // Handled here either way, so whatever the table sits in does not
        // close because somebody dismissed a search box. Stopped *and*
        // prevented: a native dialog closes on the key's default action,
        // which stopping its propagation does nothing about.
        event.stopPropagation()
        event.preventDefault()

        // Empties a box with something in it and closes one without — the
        // same two steps the toolbar's search takes.
        if (input.value === "") {
          commit()
          closeHeaderSearch(true)
          return
        }
        input.value = ""
        commit()
      }
    })

    clear.addEventListener("click", () => {
      input.value = ""
      commit()
      closeHeaderSearch(true)
    })

    // Focus leaving the box closes it and keeps what was typed.
    box.addEventListener("focusout", (event) => {
      if (headerSearch !== open) return
      const next = event.relatedTarget
      if (next instanceof Node && box.contains(next)) return
      // The window lost focus, not the box: it is still where the person will
      // be typing when they come back.
      if (!currentDocument().hasFocus()) return

      /*
        Focus left because something else was pressed, and what was typed has
        not been applied yet. Applying it now would rebuild the rows — and the
        chips, and the pagination — between the press and its release, and a
        click whose two halves land on different elements is a click that
        never happens: the box would have eaten it. So the box closes now,
        which touches nothing but its own header, and the search is applied
        once the click has had its turn.
      */
      if (pressedOutside && input.value.trim() !== open.committed) {
        const typed = input.value
        closeHeaderSearch(false)

        const finish = () => {
          page.removeEventListener("pointerup", finish, true)
          page.removeEventListener("pointercancel", finish, true)
          // A turn later, so the click that follows the release goes first.
          setTimeout(() => update(setColumnSearch(state, key, typed)), 0)
        }
        page.addEventListener("pointerup", finish, true)
        page.addEventListener("pointercancel", finish, true)
        return
      }

      commit()
      closeHeaderSearch(false)
    })

    cell.dataset["searching"] = "true"
    // A draggable ancestor takes the mouse away from a text box: dragging to
    // select what was typed would pick the column up instead.
    cell.draggable = false
    cell.append(box)

    input.focus()
    input.setSelectionRange(text.length, text.length)
  }

  /**
   * Closes the search box and puts an ordinary header back.
   *
   * The cell is built again rather than tidied up: it may have been kept
   * through changes that would have rebuilt any other, so a fresh one is the
   * only way to be sure it is the header its column now has.
   */
  function closeHeaderSearch(returnFocus: boolean) {
    const open = headerSearch
    if (!open) return

    headerSearch = undefined
    clearTimeout(open.timer)
    open.dispose()

    const column = headerColumns.find((entry) => entry.key === open.key)
    if (!column || headerCells.get(open.key) !== open.cell) return

    const fresh = headerCell(column, headerColumns, classes())
    open.cell.replaceWith(fresh)
    headerCells.set(open.key, fresh)
    applyPinOffsets(head)

    // Back to the magnifier when the keyboard closed it, or the person is left
    // at the top of the document.
    if (returnFocus) headerParts.get(fresh)?.search?.focus()
  }

  /**
   * Reordering by drag, and removing by dragging out.
   *
   * Which side of the middle the pointer is on decides where the column lands,
   * so a drop is never a guess. Letting go outside the table removes the
   * column — the same gesture as dragging something off the macOS dock, with
   * the same puff of smoke, because a removal with no animation reads as a bug.
   */
  function attachColumnDrag(cell: HTMLElement, key: string) {
    let edge: "before" | "after" = "before"
    // Read when something is dropped: a header cell outlives the render that
    // built it, and the columns may have been rearranged since.
    const keys = () => headerColumns.map((column) => column.key)

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
      if (keys().length <= 1) return

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
      update(setOrder(state, reorderColumnTo(keys(), dragged, key, edge)))
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

  function openHeaderMenu(anchor: HTMLElement, key: string) {
    // Looked up now rather than held from when the header was built: the cell
    // persists across renders, and its column's arrangement may not have.
    const column = headerColumns.find((entry) => entry.key === key)
    if (!column) return

    const keys = headerColumns.map((entry) => entry.key)
    const filter = state.filters.find((entry) => entry.key === column.key)
    const sort = state.sort.find((entry) => entry.key === column.key)
    const sorting = resolveSorting(settings.sortable)

    openMenuAt({ anchor, label: `${column.header} column`, theme: settings.theme }, (close) => {
      const items: Array<Node | null> = []

      /**
       * An action that changes the view: a link when the table has URLs, a
       * button otherwise — the same choice the React adapter makes.
       */
      const action = (label: string, next: (current: TableState) => TableState, glyph: Node | null) =>
        settings.buildHref
          ? routed(menuLink(label, settings.buildHref(next(state)), { icon: glyph }))
          : menuItem(label, () => {
              // From the state as it is when the item is chosen, not as it was
              // when the menu opened: a set filter ticked in this same menu
              // has changed it since, and must not be undone by sorting.
              update(next(state))
              close()
            }, { icon: glyph })

      if (sorting && column.sortable) {
        items.push(
          action("Sort ascending", (current) => ({ ...current, sort: [{ key: column.key, direction: "asc" }], page: 1 }), icon("sortAscending")),
          action("Sort descending", (current) => ({ ...current, sort: [{ key: column.key, direction: "desc" }], page: 1 }), icon("sortDescending")),
        )

        /*
          Adding a level without a shift key: the keyboard's way to a sort of
          several columns, and the way anybody finds out there is one. Offered
          once some other column is sorted, because until then "then" has
          nothing to follow.
        */
        if (sorting.multiple && state.sort.some((entry) => entry.key !== column.key)) {
          items.push(
            action("Then sort ascending", (current) => addSort(current, column.key, "asc"), icon("sortAscending")),
            action("Then sort descending", (current) => addSort(current, column.key, "desc"), icon("sortDescending")),
          )
        }

        items.push(
          // This column's level only: the others are somebody's deliberate
          // choice, and the reset is there for all of them.
          sort ? action("Clear sort", (current) => removeSort(current, column.key), icon("close")) : null,
          menuSeparator(),
        )
      }

      if (settings.filters !== false && column.filterKind !== "none") {
        items.push(
          filterControl(column, filter, (next) => {
            update(setFilter(state, next))
            if (column.filterKind !== "set") close()
          }, () => update(removeFilter(state, column.key)), close),
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
        action("Hide column", (current) => hideColumn(current, column.key), icon("eyeOff")),
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
    /** Called after the control's own "Clear" button, for a panel that should close behind it. */
    onDone: () => void,
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

      /*
        Only a filter this panel could have made is read back as ticks. A
        column searched from its header carries `contains "act"`, and reading
        that as a choice called "act" would tick nothing — and then fold the
        stray word into the list the moment a real box was ticked.
      */
      const made = filter && (filter.operator === "eq" || filter.operator === "in") ? filter.value : undefined
      const chosen = new Set(Array.isArray(made) ? made.map(String) : made !== undefined ? [String(made)] : [])

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
        clear.addEventListener("click", () => {
          onClear()
          onDone()
        })
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
      // "Any" unless the filter is one this control makes: a search typed
      // into the header is not a yes or a no.
      select.value = filter?.operator === "eq" && filter.value !== undefined ? String(filter.value) : ""
      select.addEventListener("change", () => {
        if (select.value === "") onClear()
        else onApply({ key: column.key, operator: "eq", value: select.value })
      })
      wrap.append(select)
      return wrap
    }

    /*
      The filter on the column may be one its type does not list — a link
      somebody edited, or a `contains` a header search made before the column's
      configuration changed. It is offered here anyway: a panel that silently
      showed a different operator from the one in force would be describing a
      filter that is not the one applied.
    */
    const offered =
      filter && !column.operators.includes(filter.operator) ? [...column.operators, filter.operator] : column.operators

    const operators = el("select", { class: "tpz-input", "aria-label": `How to filter ${column.header}` }) as HTMLSelectElement
    for (const operator of offered) {
      // An operator nobody defined can still arrive in a link; it is shown as written.
      operators.append(el("option", { value: operator, text: OPERATOR_LABELS[operator] ?? operator }))
    }
    operators.value = filter?.operator ?? column.operators[0] ?? "contains"

    // A range keeps its bounds in two boxes; a list shares one, comma separated.
    const given = filter?.value
    const firstValue =
      given === undefined || given === null
        ? ""
        : !Array.isArray(given)
          ? String(given)
          : filter?.operator === "between"
            ? String(given[0] ?? "")
            : given.map(String).join(", ")
    const secondValue = Array.isArray(given) && given.length > 1 ? String(given[1]) : ""

    const value = el("input", {
      class: "tpz-input",
      "aria-label": `Filter ${column.header} by`,
      value: firstValue,
    }) as HTMLInputElement

    const second = el("input", {
      class: "tpz-input",
      "aria-label": `Filter ${column.header} up to`,
      placeholder: "and",
      value: secondValue,
    }) as HTMLInputElement

    const apply = () => {
      const operator = operators.value as FilterOperator
      if (!needsValue(operator)) {
        onApply({ key: column.key, operator })
        return
      }
      if (operator === "between") {
        // One end filled in is "at least" or "at most"; neither is no filter.
        const range = rangeFilter(column.key, value.value, second.value)
        if (range) onApply(range)
        else onClear()
        return
      }
      if (value.value.trim() === "") {
        onClear()
        return
      }
      onApply({
        key: column.key,
        operator,
        value: isListOperator(operator)
          ? value.value.split(",").map((entry) => entry.trim()).filter(Boolean)
          : value.value.trim(),
      })
    }

    for (const input of [value, second]) {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") apply()
      })
    }

    const button = el("button", { type: "button", class: "tpz-btn", "data-variant": "primary", text: "Apply" })
    button.addEventListener("click", apply)

    const actions = el("div", { class: "tpz-filter-actions" }, [button])
    if (filter) {
      const clear = el("button", { type: "button", class: "tpz-btn", text: "Clear" })
      clear.addEventListener("click", () => {
        onClear()
        onDone()
      })
      actions.append(clear)
    }

    /**
     * Lays the panel out for the operator chosen: no box for "is empty", two
     * for "is between", and the kind of box the core says the value needs — a
     * date picker cannot hold "Aug", and a number box cannot hold "1,2" or a
     * time of day.
     */
    const arrange = () => {
      const operator = operators.value as FilterOperator
      const type = filterInputType(column, operator)

      for (const input of [value, second]) input.setAttribute("type", type)
      if (type === "number") value.setAttribute("inputmode", "decimal")
      else value.removeAttribute("inputmode")
      value.setAttribute("placeholder", isListOperator(operator) ? "Separate with commas" : "Value")

      /*
        The boxes come and go around the operator list; the list itself is
        never moved. Taking it out of the document and putting it back would
        drop its focus — and a closed list changes its value on every arrow
        key, so a keyboard would be thrown out of the panel one option in.
      */
      if (needsValue(operator)) {
        if (value.parentNode !== wrap) operators.after(value)
      } else {
        value.remove()
      }

      if (operator === "between") {
        if (second.parentNode !== wrap) value.after(second)
      } else {
        second.remove()
      }
    }

    wrap.append(operators, actions)
    operators.addEventListener("change", arrange)
    arrange()
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
  const revealedOnStart = render()

  if (adopted?.searchFocused && searchInput) {
    // Back where the person was typing, caret and all.
    searchInput.focus()
    const end = searchInput.value.length
    searchInput.setSelectionRange(end, end)
  }
  if (changed || revealedOnStart) notify()

  return {
    element: root,
    setData(data) {
      settings = { ...settings, data }
      if (render()) notify()
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
      if (next.state && next.state !== previous.state) {
        state = { ...state, ...next.state }
        stateHandedIn = true
      }

      const pageSize = paginationOf(settings)?.pageSize
      if (pageSize !== undefined && pageSize !== paginationOf(previous)?.pageSize) {
        // Back to the first page: page four of a twenty-five-row list is not
        // page four of a hundred-row one.
        state = { ...state, pageSize, page: 1 }
      }

      buildToolbar()
      const revealed = render()
      stateHandedIn = false
      if (revealed) notify()
    },
    getState: () => state,
    setState(partial) {
      update({ ...state, ...partial })
    },
    getRows: () => current().rows,
    getSelection: () => [...state.selection],
    refresh() {
      if (render()) notify()
    },
    destroy() {
      widthObserver?.disconnect()
      warming?.stop()
      warming = undefined
      if (editing) {
        editing.editor.dispose()
        editing = undefined
      }
      observer?.disconnect()
      clearTimeout(searchTimer)
      clearTimeout(headerSearch?.timer)
      headerSearch?.dispose()
      headerSearch = undefined
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
  // Likewise read when they happen, and drawing nothing of their own.
  "onRowContextMenu",
  "onCellEdit",
  "editTrigger",
])

/** Whether an element has the kind of focus a keyboard gives, as far as the browser will say. */
function isKeyboardFocused(element: Element): boolean {
  try {
    return element.matches(":focus-visible")
  } catch {
    // An engine that does not know the selector cannot tell, and then nothing is moved.
    return false
  }
}

/** The next control along in the same group that can take focus. */
function controlAfter(element: Element): HTMLElement | undefined {
  const focusable = "button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]"

  for (let sibling = element.nextElementSibling; sibling; sibling = sibling.nextElementSibling) {
    const control = sibling.matches(focusable) ? sibling : sibling.querySelector(focusable)
    if (control instanceof HTMLElement) return control
  }
  return undefined
}

/**
 * How many rows Page Up and Page Down move: as many as the scroll area shows,
 * less one so the row the keyboard was on stays in sight.
 */
function pageRowsFrom(cell: HTMLElement): number {
  const rowHeight = cell.getBoundingClientRect().height || 32
  const scroll = cell.closest<HTMLElement>(".tpz-scroll")
  const scrolls = scroll !== null && scroll.scrollHeight > scroll.clientHeight + 1
  const height = scrolls ? scroll.clientHeight : cell.ownerDocument.defaultView?.innerHeight ?? 0
  return Math.max(1, Math.floor(height / rowHeight) - 1)
}

let warnedAboutSelectAll = false

/* "Select every matching row" with the rows on a server and no way to ask for them selects one page. */
function warnAboutServerSelectAll(): void {
  if (warnedAboutSelectAll) return
  if (typeof process !== "undefined" && process.env["NODE_ENV"] === "production") return
  warnedAboutSelectAll = true
  console.warn(
    "[trapezium] selection.selectAll is \"matching\" in server mode, but the table has no server.all to fetch " +
      "the matching rows from, so the header checkbox selected the page on screen. Pass server: { all: (state) => … }.",
  )
}

/** Whether a handler returned something to wait for. */
function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof value === "object" && value !== null && "then" in value && typeof value.then === "function"
}

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
  /** Stands in for the row's own value — an edit still being saved shows what it is saving. */
  shown?: { value: unknown },
): CellContext<TRow, Node | string> {
  const value = shown ? shown.value : column.accessor(row)
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
    case "boolean": {
      // Read the way the type reads it, so a "false" out of a CSV is a No here
      // as it is in the sort and the filter.
      const yes = toBoolean(value)
      return el("span", { class: yes ? "tpz-boolean-true" : "tpz-boolean-false" }, [
        icon(yes ? "check" : "minus"),
        el("span", { class: "tpz-sr", text: yes ? "Yes" : "No" }),
      ])
    }

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
