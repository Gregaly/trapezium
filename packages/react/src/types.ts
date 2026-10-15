import type { ReactNode } from "react"
import type {
  AnyRow,
  CellContext,
  CellEdit,
  ColumnDef,
  Density,
  DetailOptions,
  FormatContext,
  GetRowId,
  HeaderContext,
  HeaderSearchOptions,
  PaginationOptions,
  PartialTableState,
  PinnedRows,
  ResolvedColumn,
  RowHeight,
  RowInfo,
  RowContextMenuInfo,
  RowReorderOptions,
  SelectionOptions,
  ServerSource,
  SortOptions,
  TableSlots,
  TableState,
  TypeDef,
} from "@trapezium/core"

/**
 * React's view of the model.
 *
 * The core's types are generic over the node a renderer produces; here that is
 * `ReactNode`. Re-exported so a caller imports everything from one place and
 * never has to write the generic themselves.
 */

/** A column, with React nodes for `render`, `renderHeader` and `renderHeaderControls`. */
export type Column<TRow = AnyRow> = ColumnDef<TRow, ReactNode>

/** A column definition, or just the key of one. */
export type ColumnInput<TRow = AnyRow> = Column<TRow> | (keyof TRow & string) | (string & {})

export type TableCellContext<TRow = AnyRow> = CellContext<TRow, ReactNode>
export type TableHeaderContext<TRow = AnyRow> = HeaderContext<TRow, ReactNode>
export type TableColumn<TRow = AnyRow> = ResolvedColumn<TRow, ReactNode>

export type { TableSlots } from "@trapezium/core"

export type SelectionMode = "single" | "multiple"

/** The selection options, as `<Table selection={…}>` takes them. */
export type TableSelection<TRow = AnyRow> = SelectionOptions<TRow>

export type SearchOptions = {
  placeholder?: string
  /** Milliseconds to wait before applying a keystroke. Defaults to 150. */
  debounce?: number
}

export type ExportOptions<TRow = AnyRow> = {
  /** Without the extension. Defaults to `"table"`. */
  filename?: string
  /** Offer "copy to clipboard" alongside the download. Defaults to true. */
  clipboard?: boolean
  /**
   * What goes in the file.
   *
   * `matching` — every row the filters and search leave, in order, however
   * many pages that is. This is the default, because an export that hands back
   * twenty-five of four hundred rows is not an export.
   *
   * `page` — only what is on screen.
   */
  scope?: "matching" | "page"
  /**
   * Fetches the rows to export.
   *
   * The answer for server-side data, where the table holds one page and cannot
   * honestly export the rest. You do the query — it is your database — and the
   * table writes the file, with the same columns, the same order and the same
   * rules about what belongs in a spreadsheet.
   *
   * ```tsx
   * export={{ fetchRows: (state) => api.invoices.all(state) }}
   * ```
   */
  fetchRows?: (state: TableState) => readonly TRow[] | Promise<readonly TRow[]>

  /**
   * Takes over the export entirely, file and all.
   *
   * For when the file should come from somewhere else — an endpoint that
   * already knows how to make it, or a format this library does not write.
   */
  onExport?: (state: TableState, rows: readonly TRow[]) => void
}

/**
 * Rendering a link.
 *
 * The library never imports a router. Give it your framework's link component
 * — `next/link`, `react-router`'s `Link` — and every href it produces goes
 * through that instead of a plain anchor.
 */
export type LinkComponent = (props: {
  href: string
  className?: string
  children: ReactNode
  "aria-current"?: "page" | undefined
  "aria-label"?: string
  /** Set on a sort link whose column has a `description`. Spread it onto the anchor. */
  "aria-describedby"?: string
  title?: string
  /**
   * `false` on a link inside a draggable header, so that dragging the header
   * moves the column rather than starting the browser's own drag of the URL.
   * Spread it onto the anchor along with everything else.
   */
  draggable?: false
}) => ReactNode

export type TableProps<TRow extends AnyRow = AnyRow> = {
  /**
   * The rows. In server mode this is the current page; otherwise it is
   * everything, and the table does the filtering, sorting and paging.
   */
  data: readonly TRow[]

  /**
   * Columns, as definitions or bare keys. Omit it and one is inferred per key
   * in the data, with types read from the values.
   */
  columns?: readonly ColumnInput<TRow>[]

  /**
   * Row identity, used for selection, React keys and expansion. Defaults to
   * `row.id`, then `row.uuid`, then the index — which is wrong the moment the
   * data sorts, so supply this whenever your rows have their own id.
   */
  getRowId?: GetRowId<TRow>

  /** Controlled state. Supply `onStateChange` alongside it. */
  state?: PartialTableState
  /** Starting state for an uncontrolled table — a saved view, or a URL. */
  defaultState?: PartialTableState
  /** Fires with the complete next state whenever anything changes. */
  onStateChange?: (state: TableState) => void

  /**
   * The rows have already been filtered, sorted and paginated by a server.
   * Supply `total` so the pagination knows how many there are.
   *
   * Pass an object instead of `true` to say where the answers the table cannot
   * work out for itself come from — the values behind a set filter, and the
   * rows behind an export:
   *
   * ```tsx
   * server={{
   *   distinct: (column) => api.invoices.distinct(column),
   *   all: (state) => api.invoices.all(state),
   * }}
   * ```
   *
   * Given once, every set-filter column and the export use it, so there is
   * nothing to configure per column and nothing to forget.
   */
  server?: boolean | ServerSource<TRow>
  /** Total matching rows. Required in server mode for numbered pagination. */
  total?: number

  /** Shows the loading state. Existing rows stay visible and dim while true. */
  loading?: boolean
  /** Shows the error state instead of rows. */
  error?: ReactNode

  /** Global search across every searchable column. */
  search?: boolean | SearchOptions
  /** Per-column filters. Defaults to true. */
  filters?: boolean
  /**
   * Search each column from its header, without opening its menu.
   *
   * A magnifier appears in a header on hover and turns it into a text box;
   * what is typed filters that column as "contains", against the text its
   * cells show. `true` switches it on for every column that can be filtered
   * and has a heading; the object form also sets how long it waits after a
   * keystroke. Off by default — and a single column can opt in or out with
   * its own `headerSearch`, whatever is said here. `filters={false}` switches
   * it off everywhere: a search is a filter.
   */
  headerSearch?: boolean | HeaderSearchOptions
  /**
   * Column sorting. Defaults to true.
   *
   * A shift-click on a header adds a level to the sort rather than replacing
   * it, and a reset control appears in the toolbar while a sort is applied.
   * Pass an object to change either: `{ multiple: false }` for a backend
   * that orders by one column only, `{ reset: false }` to leave the control
   * out, or `{ reset: [{ key, direction }] }` to name the order the table
   * rests in.
   */
  sortable?: boolean | SortOptions
  /** Drag column edges to resize. Defaults to true. */
  resizable?: boolean
  /** Drag headers to reorder. Defaults to true. */
  reorderable?: boolean
  /** The header menu — sort, filter, pin, hide. Defaults to true. */
  columnMenu?: boolean
  /** The "Columns" button that shows and hides columns. Defaults to true. */
  columnControl?: boolean

  /** `true` is numbered pages of 25. `false` shows every row. */
  pagination?: boolean | PaginationOptions

  /** `true` means multiple. */
  selection?: boolean | SelectionMode | TableSelection<TRow>
  /** Convenience for `selection.onChange`. */
  onSelectionChange?: (ids: string[], rows: TRow[]) => void

  /** CSV download and clipboard copy of the current view. */
  export?: boolean | ExportOptions<TRow>

  /** Row height. Also settable by the user when `densityControl` is on. */
  density?: Density
  /** Offer the density switch in the toolbar. Defaults to false. */
  densityControl?: boolean

  /**
   * What happens when the table is narrower than its content.
   * `scroll` keeps the table and scrolls sideways; `cards` stacks each row.
   */
  responsive?: "scroll" | "cards"

  /** Keep the header visible while the body scrolls. Defaults to true. */
  stickyHeader?: boolean
  /** Caps the scroll area, which is what makes a sticky header do anything. */
  maxHeight?: number | string

  /**
   * How tall a row is: `"fixed"` (the default), `"auto"`, or a number of
   * pixels.
   *
   * Both `"auto"` and a number let every cell wrap — including whatever a cell
   * renderer returns, because the browser is what measures it. They differ in
   * where the height comes from: `"auto"` follows the content, a number gives
   * every row that height and ends what will not fit in an ellipsis. Opt a column out with `wrap: false`, or cap one at
   * three lines with `wrap: 3`.
   */
  rowHeight?: RowHeight

  /** Custom types, merged over the built-ins. */
  types?: Record<string, TypeDef>
  /** Locale, timezone, currency and the empty placeholder. */
  format?: Partial<FormatContext>

  /**
   * Detail rows: content that opens below a row and spans the table's width.
   *
   * ```tsx
   * detail={{ render: ({ row }) => <InvoiceLines id={row.id} /> }}
   * ```
   *
   * An expander column leads the table, with a button per row and one in the
   * header that opens or closes every row on the page. Which rows are open is
   * `state.expanded`, so it can be controlled, saved, and put in the URL with
   * `include: ["expanded"]`; the server renders open rows open. A detail row
   * is never counted, paged, sorted, selected or exported, and it is as tall
   * as what is in it. `canExpand` leaves some rows without one, `keepMounted`
   * keeps a closed detail alive so it does not fetch again when reopened, and
   * `toggleOnRowClick` lets a click anywhere on the row open it.
   */
  detail?: DetailOptions<TRow, ReactNode>

  /**
   * Cells the keyboard can move between.
   *
   * The table becomes one stop in the tab order — the active cell — and the
   * arrow keys, Home, End (with Control for the whole table), Page Up and Page
   * Down move from cell to cell. Enter or F2 goes into a cell's link or
   * button, Escape comes back out, and Space or Enter works the checkbox and
   * the expander in their columns. The active cell is `state.focus`, so it can
   * also be set from outside: `focusCell(state, rowId, key)` scrolls the table
   * to that cell, highlights its row and puts the keyboard on it.
   *
   * Off by default, because it turns the table into a `role="grid"`, which a
   * screen reader works differently from a table. Switched on automatically
   * when a column is `editable`, since editing needs it.
   */
  cellNavigation?: boolean

  /**
   * Receives every committed edit of an `editable` column.
   *
   * The table never changes `data`: update your rows with `edit.value` and
   * the cell shows it. Return a promise and the cell shows that it is saving
   * until it settles; if it rejects, the cell goes back to what the data says
   * and is marked as having failed — so an optimistic update and its rollback
   * stay yours, where the data is.
   */
  onCellEdit?: (edit: CellEdit<TRow>) => void | Promise<unknown>

  /**
   * What opens an editable cell's editor with the mouse: a double click (the
   * default, so a single click still selects a cell and its text) or a single
   * click. Enter, F2 and typing open it from the keyboard either way.
   */
  editTrigger?: "click" | "doubleClick"

  /**
   * One level of child rows: the id of the row this one belongs under, or
   * `null` for a row that belongs under nothing.
   *
   * Children are drawn directly under their parent, with a toggle in the
   * parent's leading cell that folds them away (`state.collapsed`). They stay
   * with their parent through everything: sorted among themselves, a parent
   * shown for the sake of a matching child, never split from it across a
   * page — pages and totals count parents. Children are rows in every other
   * way: selected, edited and exported like any other, and exported under
   * their parent. A row whose parent is missing from `data` is shown as a row
   * of its own. One level only: deeper rows go under the top of their chain.
   */
  getParentId?: (row: TRow) => string | null | undefined

  /**
   * Rows held at the top or bottom of the table, outside `data` — an editable
   * "new entry" row above everything, a totals row below it.
   *
   * Drawn through the same columns, renderers and editors, and kept in view
   * while the body scrolls. Never filtered, sorted, paged, counted, selected
   * or exported. The keyboard reaches them: the up arrow from the first row of
   * the body lands on the last pinned row above it. An edit of one says so with
   * `edit.pinned`.
   */
  pinnedRows?: PinnedRows<TRow>

  /**
   * Rows moved by hand: a drag handle leads each row, and Alt with the up or
   * down arrow moves the row from the keyboard.
   *
   * ```tsx
   * rowReorder={{ onReorder: ({ rowId, afterId, beforeId }) => move(rowId, afterId, beforeId) }}
   * ```
   *
   * The table never reorders `data`: it reports the row and its new
   * neighbours, and shows the order the data then has — or, if `onReorder`
   * returns a promise, the new order until it settles. Offered only while the
   * table is unsorted. A child row moves among its siblings only, and a parent
   * takes its children with it. `canDrag` keeps some rows where they are.
   */
  rowReorder?: RowReorderOptions<TRow>

  /** Makes each row a link. The leading cell becomes an anchor. */
  rowHref?: (row: TRow) => string
  /** Fires on a click anywhere in the row that was not a control. */
  onRowClick?: (row: TRow, event: React.MouseEvent) => void
  /**
   * Fires when a context menu is asked for on a row — a right click, a long
   * press, the menu key — with the row and the cell under the pointer: its
   * column, and the text it shows (`cellDisplayText`). The browser's own menu
   * still opens unless you call `event.preventDefault()`, so open yours and
   * prevent it in the same handler.
   */
  onRowContextMenu?: (row: TRow, event: React.MouseEvent, info: RowContextMenuInfo<TRow, ReactNode>) => void
  /**
   * Extra class names per row — a tone for overdue, archived, unread. With
   * child rows, `info` says where the row sits: its depth, its parent, how
   * many children it has, and whether it is only shown for a child's sake.
   */
  rowClassName?: (row: TRow, index: number, info?: RowInfo) => string | undefined

  /** Replaces the "nothing here" state. */
  emptyState?: ReactNode
  /** Text for the default empty state. */
  emptyMessage?: string

  /** Extra controls in the toolbar, beside search and columns. */
  toolbar?: ReactNode
  /** A row pinned below the last one — an "add another" affordance, a total. */
  appendRow?: ReactNode
  /** Content below the table, inside the frame. */
  footer?: ReactNode

  /**
   * Renders every control as a link to this URL instead of a button.
   *
   * With it, a server-rendered table sorts, filters and pages with no client
   * JavaScript at all — the server re-renders from the query string.
   */
  buildHref?: (state: TableState) => string
  /** Your framework's link component, used for `buildHref` and `rowHref`. */
  linkComponent?: LinkComponent
  /**
   * Fires when one of the table's own links is clicked plainly, with the URL
   * it points at, and prevents the browser's navigation — for a router with a
   * `navigate` function rather than a link component. A click with a modifier
   * held, or with the middle button, is left to the browser. Ignored for plain
   * clicks when `linkComponent` is given, since the link then routes itself.
   *
   * One modified click is the table's: a shift-click on a sortable header,
   * which adds that column to the sort. It fires this with the URL of that
   * view, since no link on the page points at it.
   */
  onNavigate?: (href: string, event: React.MouseEvent) => void

  /** Added to the root element. */
  className?: string
  /** Added per slot, on top of the defaults. */
  classNames?: Partial<TableSlots>
  /** Drops the default classes so your own styling is the only styling. */
  unstyled?: boolean
  /** Forces a theme instead of following the page's `color-scheme`. */
  theme?: "light" | "dark"

  /** Base for generated element ids. Must be stable across a server and client render. */
  id?: string
  /** Describes the table to a screen reader. Use it, or `caption`. */
  "aria-label"?: string
  /** A visible caption above the table. */
  caption?: ReactNode
}
