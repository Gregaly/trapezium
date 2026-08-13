import type { ReactNode } from "react"
import type {
  AnyRow,
  CellContext,
  ColumnDef,
  Density,
  FormatContext,
  GetRowId,
  HeaderContext,
  PaginationOptions,
  PartialTableState,
  ResolvedColumn,
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

/** A column, with React nodes for `render` and `renderHeader`. */
export type Column<TRow = AnyRow> = ColumnDef<TRow, ReactNode>

/** A column definition, or just the key of one. */
export type ColumnInput<TRow = AnyRow> = Column<TRow> | (keyof TRow & string) | (string & {})

export type TableCellContext<TRow = AnyRow> = CellContext<TRow, ReactNode>
export type TableHeaderContext<TRow = AnyRow> = HeaderContext<TRow, ReactNode>
export type TableColumn<TRow = AnyRow> = ResolvedColumn<TRow, ReactNode>

/**
 * The parts of the table a caller can restyle.
 *
 * Every slot takes a class name that is *added* to the default, so a Tailwind
 * user overrides what they care about and inherits the rest. `unstyled` drops
 * the defaults entirely for anyone who wants to start from nothing.
 */
export type TableSlots = {
  root: string
  frame: string
  toolbar: string
  search: string
  scroll: string
  table: string
  thead: string
  tbody: string
  headerRow: string
  headerCell: string
  row: string
  cell: string
  selectCell: string
  pagination: string
  empty: string
  loading: string
  footer: string
}

export type SelectionMode = "single" | "multiple"

export type TableSelection<TRow = AnyRow> = {
  mode?: SelectionMode
  /** Rows that cannot be selected — a disabled record, a group header. */
  isSelectable?: (row: TRow, index: number) => boolean
  /** Fires with the ids and the rows behind them, whenever the selection changes. */
  onChange?: (ids: string[], rows: TRow[]) => void
}

export type SearchOptions = {
  placeholder?: string
  /** Milliseconds to wait before applying a keystroke. Defaults to 150. */
  debounce?: number
  /** Start with the box visible rather than behind its button. Defaults to true. */
  alwaysVisible?: boolean
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
   * Takes over the export entirely.
   *
   * The escape hatch for server-side data, where the table holds one page and
   * cannot honestly export the rest: given the current state, fetch what you
   * need and write the file yourself.
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
  title?: string
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
   */
  server?: boolean
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
  /** Column sorting. Defaults to true. */
  sortable?: boolean
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

  /** Custom types, merged over the built-ins. */
  types?: Record<string, TypeDef>
  /** Locale, timezone, currency and the empty placeholder. */
  format?: Partial<FormatContext>

  /** Makes each row a link. The leading cell becomes an anchor. */
  rowHref?: (row: TRow) => string
  /** Fires on a click anywhere in the row that was not a control. */
  onRowClick?: (row: TRow, event: React.MouseEvent) => void
  /** Extra class names per row — a tone for overdue, archived, unread. */
  rowClassName?: (row: TRow, index: number) => string | undefined

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
