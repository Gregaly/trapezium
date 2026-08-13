/**
 * The public model.
 *
 * Everything a caller writes — columns, state, options — is described here, and
 * nothing in this file knows about a framework or a DOM. Adapters re-export
 * these types with their own node type substituted in, so a React user gets
 * `ReactNode` where a Svelte user gets a snippet, from one definition.
 */

/** A row is whatever the caller has. Trapezium never requires a shape. */
export type AnyRow = Record<string, unknown>

/**
 * A column's key.
 *
 * Real keys of the row autocomplete; any other string is still accepted, which
 * is what allows dotted paths (`"org.name"`) and synthetic columns that have no
 * underlying field at all (an actions column, a computed total).
 */
export type ColumnKey<TRow> = (keyof TRow & string) | (string & {})

/** Horizontal alignment of a column's cells and its header. */
export type Align = "start" | "center" | "end"

/** Which edge a column is frozen to, if any. */
export type Pin = "start" | "end"

export type SortDirection = "asc" | "desc"

/** One level of sorting. Several may apply, in order. */
export type Sort = {
  key: string
  direction: SortDirection
}

/**
 * Every comparison a filter can make.
 *
 * Which of them a column offers is decided by its type — asking whether a
 * checkbox is "greater than" produces a question with no meaningful answer, and
 * a filter UI built from the type's operator list can only offer what will
 * actually work.
 */
export type FilterOperator =
  | "eq"
  | "ne"
  | "contains"
  | "notContains"
  | "startsWith"
  | "endsWith"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "in"
  | "notIn"
  | "empty"
  | "notEmpty"

/** What a filter compares against. `between` and the list operators take arrays. */
export type FilterValue = string | number | boolean | null | Array<string | number | boolean | null>

/** One condition applied to one column. */
export type ColumnFilter = {
  key: string
  operator: FilterOperator
  /** Omitted for `empty` and `notEmpty`, where the field's presence is the whole condition. */
  value?: FilterValue
}

/**
 * The control a column's filter is drawn as.
 *
 * `set` is the checkbox list of the distinct values actually present in the
 * data — the thing spreadsheet users reach for first, and the one most table
 * libraries leave out.
 */
export type FilterKind = "text" | "set" | "range" | "date" | "boolean" | "none"

/**
 * How a column is filtered.
 *
 * `true` picks the control the column's type deserves; a string forces one; an
 * object configures it.
 */
export type FilterOption =
  | boolean
  | FilterKind
  | {
      kind?: FilterKind
      /** Operators to offer, narrowing the type's default set. */
      operators?: FilterOperator[]
      /** Fixed choices for a `set` filter. Derived from the data when omitted. */
      options?: SelectOption[]
      /** Starting operator when the user opens an empty filter. */
      defaultOperator?: FilterOperator
    }

/** One choice in a `select`, `tags` or `badge` column, and in a set filter. */
export type SelectOption = {
  value: string
  label?: string
  /** Any CSS colour. Tints the chip; ignored by types that render as plain text. */
  colour?: string
}

/** Row height. Affects nothing but presentation. */
export type Density = "compact" | "normal" | "relaxed"

/**
 * Everything needed to turn a stored value into text.
 *
 * Set once on the table and overridable per column. Both `locale` and
 * `timeZone` default to fixed values rather than the runtime's, because a
 * server in UTC and a browser in Sydney formatting the same timestamp
 * differently is a hydration mismatch, and a silent one.
 */
export type FormatContext = {
  /** BCP 47. Defaults to `"en"`. */
  locale: string
  /** IANA zone used to render `datetime`. Defaults to `"UTC"`. */
  timeZone: string
  /** ISO 4217, for `currency` columns. Defaults to `"USD"`. */
  currency: string
  /**
   * Whether `currency` values are integer minor units (cents) rather than major
   * units. Defaults to `false`, because a plain `12.5` is what most APIs return.
   */
  currencyInMinorUnits: boolean
  /** Shown where a value is absent, so columns stay legible. Defaults to `"—"`. */
  emptyText: string
  /** Reference point for `relativeTime`. Injected so the output is testable. */
  now?: Date
}

/** Per-column overrides of the table's formatting. */
export type FormatOptions = Partial<FormatContext> & {
  /** Fixed decimal places for `number`, `percent` and `currency`. */
  decimals?: number
  /** Choices for `select`, `tags` and `badge`, so stored values render as labels. */
  options?: SelectOption[]
  /** Extra `Intl.DateTimeFormat` options merged over the default date rendering. */
  dateOptions?: Intl.DateTimeFormatOptions
}

/** What a cell renderer, formatter or exporter is given. */
export type CellContext<TRow = AnyRow, TNode = unknown> = {
  /** The raw value, exactly as it came off the row. */
  value: unknown
  row: TRow
  /** Index within the rows currently rendered, not within the whole dataset. */
  rowIndex: number
  /** The row's stable id, as resolved by `getRowId`. */
  rowId: string
  column: ResolvedColumn<TRow, TNode>
  /** The value already formatted as text, so a renderer can decorate rather than reimplement. */
  text: string
  format: FormatContext
}

/** What a header renderer is given. */
export type HeaderContext<TRow = AnyRow, TNode = unknown> = {
  column: ResolvedColumn<TRow, TNode>
  /** This column's current sort, if it has one. */
  sort: Sort | undefined
}

/**
 * A column.
 *
 * `key` is the only required property. Everything else has a default derived
 * from the data or the key, and exists so the exceptions are one line rather
 * than a new component.
 */
export type ColumnDef<TRow = AnyRow, TNode = unknown> = {
  /**
   * The row property to read, a dotted path into it (`"org.name"`), or any
   * unique id when `accessor` or `render` supplies the value instead.
   */
  key: ColumnKey<TRow>

  /**
   * Header text. Defaults to the humanised key — `created_at` becomes
   * "Created at" — which is right often enough that most columns never set it.
   * Pass `""` for a column that should have no visible header.
   */
  header?: string

  /**
   * The data type, which decides formatting, sorting, alignment, the filter
   * control and the header icon. Inferred from the data when omitted.
   */
  type?: string

  /** Reads the value. Defaults to the key, or the dotted path it describes. */
  accessor?: (row: TRow) => unknown

  /**
   * Replaces the cell's text. Sorting and filtering still use the raw value, so
   * a formatted column keeps sorting correctly.
   */
  format?: (context: CellContext<TRow, TNode>) => string

  /** Per-column formatting overrides — currency, decimals, options, timezone. */
  formatOptions?: FormatOptions

  /** Replaces the cell's markup entirely. Use `format` when the result is still text. */
  render?: (context: CellContext<TRow, TNode>) => TNode

  /** Replaces the header's markup. The sort and filter controls are yours to place. */
  renderHeader?: (context: HeaderContext<TRow, TNode>) => TNode

  /** Defaults to true for every type that can be ordered. */
  sortable?: boolean

  /** Comparator for ascending order. Defaults to the type's. */
  compare?: (a: unknown, b: unknown) => number

  /** Whether global search looks at this column. Defaults to true for text-bearing types. */
  searchable?: boolean

  /** `true` uses the type's control; a string forces one; an object configures it. */
  filter?: FilterOption

  /** Defaults to the type's alignment — numbers end, booleans centre, everything else start. */
  align?: Align

  /** Starting width in pixels. Columns are content-sized when omitted. */
  width?: number
  minWidth?: number
  maxWidth?: number

  /** Freeze this column against an edge while the rest scrolls. */
  pin?: Pin

  /** Start hidden. The user can still reveal it from the column menu. */
  hidden?: boolean

  /** Defaults to true when the table allows resizing at all. */
  resizable?: boolean

  /** Defaults to true when the table allows reordering at all. */
  reorderable?: boolean

  /** Let the cell wrap onto several lines instead of truncating. */
  wrap?: boolean

  /** Monospaced cell text. Defaults to the type's preference. */
  mono?: boolean

  /** Header icon name, or `false` for none. Defaults to the type's icon. */
  icon?: string | false

  /** Text for CSV export and clipboard copy. Defaults to the cell's formatted text. */
  exportValue?: (context: CellContext<TRow, TNode>) => string

  /** Excluded from CSV export and clipboard copy. Useful for an actions column. */
  exportable?: boolean

  /** Extra class names for this column's cells, on top of the defaults. */
  className?: string
  /** Extra class names for this column's header cell. */
  headerClassName?: string

  /** Anything the caller wants to reach from a renderer. Never read by the library. */
  meta?: Record<string, unknown>
}

/**
 * A column definition after defaults, inference and state have been applied.
 *
 * This is what renderers and the pipeline see: every optional property resolved
 * to a concrete value, so no consumer has to repeat the defaulting rules.
 */
export type ResolvedColumn<TRow = AnyRow, TNode = unknown> = Omit<
  ColumnDef<TRow, TNode>,
  "type" | "accessor" | "header"
> & {
  key: string
  header: string
  type: string
  accessor: (row: TRow) => unknown
  align: Align
  sortable: boolean
  searchable: boolean
  exportable: boolean
  mono: boolean
  filterKind: FilterKind
  operators: FilterOperator[]
  icon: string | false
  /** Position among the visible columns, after ordering and pinning. */
  index: number
  /** Resolved width in pixels, from state or the definition. Absent means content-sized. */
  width?: number
  pin?: Pin
}

/**
 * Everything about how a table is arranged, as one serialisable object.
 *
 * One object rather than a scatter of props is what makes controlled usage,
 * persistence, saved views and shareable links all the same feature.
 */
export type TableState = {
  /** Ordered: the first entry is the primary sort. */
  sort: Sort[]
  filters: ColumnFilter[]
  /** Whether a row must satisfy every filter or any of them. */
  match: "all" | "any"
  search: string
  /** One-based, because it is shown to people and put in URLs. */
  page: number
  pageSize: number
  /** Row ids, as resolved by `getRowId`. */
  selection: string[]
  /** Explicit column order. Columns not named here keep their natural position after those that are. */
  order: string[]
  hidden: string[]
  /** Pixel widths set by dragging, keyed by column. */
  widths: Record<string, number>
  /** Pinning set by the user, overriding the column definition. */
  pinned: Record<string, Pin>
  density: Density
}

/** Any subset of table state — what callers pass, and what updates carry. */
export type PartialTableState = Partial<TableState>

/** The result of running rows through the pipeline. */
export type TableRows<TRow = AnyRow> = {
  /** The rows to render, already filtered, sorted and paginated. */
  rows: TRow[]
  /**
   * Every row matching the filters and the search, in order, with pagination
   * not yet applied.
   *
   * This is what an export means: "the rows I am looking at" is the filtered,
   * sorted set, not the twenty-five of them that happen to be on screen. In
   * server mode it is whatever the caller supplied, because that is all there
   * is.
   */
  matched: TRow[]
  /** Rows matching the filters and search, before pagination. */
  total: number
  /** Rows given to the table, before anything was applied. */
  totalUnfiltered: number
  pageCount: number
  /** True when filters or search removed rows that otherwise exist. */
  filtered: boolean
}

/** How a row is identified across sorting, filtering and paging. */
export type GetRowId<TRow> = (row: TRow, index: number) => string

/** Pagination behaviour. `mode` is the only property most callers set. */
export type PaginationOptions = {
  /**
   * - `pages` — numbered pages with previous and next
   * - `simple` — previous and next only
   * - `loadMore` — a button that appends the next page
   * - `infinite` — appends as the user reaches the end
   */
  mode?: "pages" | "simple" | "loadMore" | "infinite"
  /** Rows per page, and the load size in append modes. Defaults to 25. */
  pageSize?: number
  /** Offers a page-size picker when given. */
  pageSizeOptions?: number[]
  /** Numbered mode only: how many page buttons sit either side of the current one. Defaults to 1. */
  siblings?: number
}

/** Row selection behaviour. */
export type SelectionOptions = {
  mode?: "single" | "multiple"
  /** Rows that cannot be selected — a disabled row, a group header. */
  isSelectable?: (row: AnyRow, index: number) => boolean
}
