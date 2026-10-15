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

/**
 * A column frozen only while the table is narrower — or wider — than a width:
 * the identifying column pinned on a phone, say, without moving anything on a
 * desktop. Decided by a container query on the table, so a server and a
 * browser draw the same thing, and nothing is measured to decide it.
 */
export type ResponsivePin = {
  side: Pin
  /** Frozen while the table is narrower than this many pixels. */
  below?: number
  /** Frozen while the table is at least this many pixels wide. */
  above?: number
}

export type SortDirection = "asc" | "desc"

/** One level of sorting. Several may apply, in order. */
export type Sort = {
  key: string
  direction: SortDirection
}

/**
 * How a table sorts.
 *
 * Both properties default to on, so `sortable` and `sortable={{}}` mean the
 * same thing. The object exists for the two exceptions: a backend that can
 * only order by one column, and a table that rests in an order of its own.
 */
export type SortOptions = {
  /**
   * Whether more than one column can be sorted at once.
   *
   * A shift-click on a header — or "Then sort" in its menu — adds a level
   * instead of replacing the sort, and each sorted header shows its place in
   * the order. Defaults to `true`. Set it to `false` when whatever does the
   * sorting can only order by one column.
   */
  multiple?: boolean

  /**
   * The reset control in the toolbar, shown while the sort is not the one the
   * table rests in.
   *
   * `true`, the default, returns to no sort at all — the order the data
   * arrived in. An array names the resting sort instead: the control returns
   * to it, and stays hidden while the table is already there. `false` leaves
   * the control out.
   *
   * Naming a resting sort does not sort the table by it — it only says where
   * the reset goes. Start the table there as well, with `defaultState.sort` or
   * the state you control, or the reset is offered before anyone has sorted.
   *
   * It lives in the toolbar, so a table with every toolbar control switched
   * off has no reset; "Clear sort" in the column menu is still there.
   */
  reset?: boolean | readonly Sort[]
}

/** Every way a caller can ask for sorting: a switch, or the options. */
export type SortInput = boolean | SortOptions

/** Sorting as the adapters read it, with every default decided. */
export type ResolvedSorting = {
  multiple: boolean
  /** Where the reset control returns to, or `undefined` when there is no control. */
  reset: readonly Sort[] | undefined
}

/**
 * Searching a column from its header.
 *
 * `true` on a table switches it on for every column that can be filtered and
 * has a heading; a column's own `headerSearch` overrides that either way.
 * Switching the table's `filters` off switches this off with them.
 */
export type HeaderSearchOptions = {
  /** Milliseconds to wait after a keystroke before the search applies. Defaults to 150. */
  debounce?: number
}

/** Every way a caller can ask for header search: a switch, or the options. */
export type HeaderSearchInput = boolean | HeaderSearchOptions

/** Header search as the adapters read it, with every default decided. */
export type ResolvedHeaderSearch = {
  /** Whether columns that do not say for themselves are searchable from the header. */
  enabled: boolean
  debounce: number
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
 * Where a set filter's choices come from when the table cannot work them out.
 *
 * Called the first time the panel is opened and remembered afterwards, so a
 * server-side table can answer "what values does this column have?" without
 * every column's domain being fetched up front. Returning a promise is the
 * normal case.
 */
export type FilterOptionsProvider = () =>
  | readonly (SelectOption | string)[]
  | Promise<readonly (SelectOption | string)[]>

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
      /**
       * Choices for a `set` filter.
       *
       * A list, or a function that fetches one. Without either, they are
       * derived from the data — which is everything in client mode and one
       * page in server mode.
       *
       * Plain strings are accepted wherever a choice is, for the common case
       * where the value is also the label.
       */
      options?: readonly (SelectOption | string)[] | FilterOptionsProvider
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

/** What a custom editor is given. */
export type EditorContext<TRow = AnyRow, TNode = unknown> = {
  /** The value the cell holds now. */
  value: unknown
  /**
   * The character typed to open the editor, when typing opened it — the
   * editor should start with this in place of the value, as a spreadsheet
   * does. Otherwise `""`.
   */
  initialText: string
  row: TRow
  rowId: string
  column: ResolvedColumn<TRow, TNode>
  /** Ends the edit with a new value, which then goes through `parse` and `validate`. */
  commit(value: unknown): void
  /** Ends the edit with nothing changed. */
  cancel(): void
}

/**
 * One committed edit, as `onCellEdit` receives it.
 *
 * The table has not changed anything: update your data with `value` and the
 * cell shows it. Return a promise to have the cell show that it is saving;
 * if the promise rejects, the cell goes back to what the data says and is
 * marked as having failed.
 */
export type CellEdit<TRow = AnyRow> = {
  rowId: string
  row: TRow
  /** The column's key. */
  key: string
  /** The new value, after `parse`, in the shape of the value it replaces. */
  value: unknown
  previousValue: unknown
  /** Set when the row is one of `pinnedRows`, so a "new entry" row can be told apart. */
  pinned?: "top" | "bottom"
}

/**
 * Where a context menu was opened: the row, and the cell under the pointer —
 * what an `onRowContextMenu` handler needs to build "Copy cell", "Open",
 * "Delete" without searching the DOM for them.
 */
export type RowContextMenuInfo<TRow = AnyRow, TNode = unknown> = {
  rowId: string
  /** The column under the pointer, or `null` over the table's own columns (checkbox, expander, handle). */
  columnKey: string | null
  column: ResolvedColumn<TRow, TNode> | undefined
  /** The text that cell shows — `cellDisplayText` — or `null` when no column is under the pointer. */
  text: string | null
  /**
   * The whole row as the table's own "Copy to clipboard" writes it: every
   * column on screen that exports, tab-separated, no header — so a "Copy row"
   * item pastes into a spreadsheet exactly as the table's copy does.
   */
  rowText: string
  /** Set when the row is one of `pinnedRows`. */
  pinned?: "top" | "bottom"
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

  /**
   * Replaces the header's text with your own markup — an icon beside the
   * name, a unit, a badge. The column's sort control, menu, search and resize
   * handle stay where they are around it, and keep working.
   *
   * What it returns sits inside the sort control, so keep it to phrasing
   * content: text, icons, badges — not a link or a button, which cannot sit
   * inside another control. The control is still named by `header`, so a
   * screen reader hears the column's name whatever the renderer draws.
   */
  renderHeader?: (context: HeaderContext<TRow, TNode>) => TNode

  /**
   * Controls of your own in the header, beside its text — a search box for the
   * column, a filter button, a toggle. Drawn after the sort control and before
   * the column's menu, outside the sort control, so they may be links, buttons
   * and inputs. When a column has them they take the header's spare width and
   * the text keeps to its own.
   *
   * A click, a key or a press in them is theirs alone: it never sorts the
   * column, never picks the column up to move it, and never reaches a row.
   * They are rendered on the server like the rest of the header. The header
   * row is hidden in the card layout, and these with it — a control a phone
   * must reach belongs in the toolbar.
   *
   * Called again as the table's state changes, with the column's current
   * sort. React and Vue keep what they rendered in place. In plain JavaScript
   * and Svelte, return the same node each time to keep a control's focus and
   * what was typed in it; a different node replaces it.
   */
  renderHeaderControls?: (context: HeaderContext<TRow, TNode>) => TNode

  /**
   * What the column means, for anyone who is not sure — "Days since the
   * invoice was due", "Excludes tax". Shown as a tooltip while the header is
   * hovered or has the keyboard, linked to the header with `aria-describedby`
   * so a screen reader reads it too, and underlined faintly so a person can
   * see there is something to read. Plain text.
   */
  description?: string

  /** Defaults to true for every type that can be ordered. */
  sortable?: boolean

  /** Comparator for ascending order. Defaults to the type's. */
  compare?: (a: unknown, b: unknown) => number

  /** Whether global search looks at this column. Defaults to true for text-bearing types. */
  searchable?: boolean

  /** `true` uses the type's control; a string forces one; an object configures it. */
  filter?: FilterOption

  /**
   * Search this column from its header, without opening its menu.
   *
   * A magnifier appears in the header on hover; choosing it turns the header
   * into a text box, and what is typed there filters the column as
   * "contains" — against the text the cells show as well as the values
   * underneath, so "Aug" finds a date and "1,2" finds $1,240.00. It is the
   * same filter the column's menu edits, so it appears as a chip, travels in
   * the URL and reaches `onStateChange` like any other.
   *
   * Defaults to the table's `headerSearch`, which is off — and which, when
   * on, covers every column that has a filter and a heading. Set it on a
   * column to opt that one in or out. The table's `filters={false}` switches
   * it off everywhere, whatever a column says: a search is a filter.
   */
  headerSearch?: boolean

  /** Defaults to the type's alignment — numbers end, booleans centre, everything else start. */
  align?: Align

  /**
   * The column's width in pixels, held exactly: content that does not fit ends
   * in an ellipsis rather than widening the column, and spare width goes to
   * other columns. A width the user drags to replaces it. Columns are sized to
   * their content when omitted.
   */
  width?: number
  /** The narrowest a content-sized column may be, in pixels. Defaults to `--tpz-col-min-width` (8rem). */
  minWidth?: number
  /** The widest a content-sized column may grow, in pixels; longer content ends in an ellipsis. */
  maxWidth?: number
  /**
   * Take a share of the width the table has to spare — the room left when the
   * columns are narrower than the table. With any column growing, the others
   * keep to their content (or their `width`) and the spare room is split
   * between the growing columns in proportion to their numbers: `grow: 2`
   * takes twice what `grow: 1` does. Without it, spare room is shared by every
   * column sized to its content.
   */
  grow?: number

  /**
   * Freeze this column against an edge while the rest scrolls — always, with
   * `"start"` or `"end"`, or only below or above a width of the table, with
   * `{ side, below }` or `{ side, above }`. A column frozen always is moved to
   * that edge; one frozen by width stays where it is in the order.
   */
  pin?: Pin | ResponsivePin

  /** Start hidden. The user can still reveal it from the column menu. */
  hidden?: boolean

  /** Defaults to true when the table allows resizing at all. */
  resizable?: boolean

  /** Defaults to true when the table allows reordering at all. */
  reorderable?: boolean

  /**
   * Let the cell wrap onto several lines instead of truncating.
   *
   * A number caps it at that many lines and puts the ellipsis at the end of
   * the last one. `false` keeps this column on a single line even when the
   * table is wrapping — `rowHeight="auto"` or a number — which is how a column
   * of identifiers stays scannable next to one of prose.
   */
  wrap?: boolean | number

  /** Monospaced cell text. Defaults to the type's preference. */
  mono?: boolean

  /** Header icon name, or `false` for none. Defaults to the type's icon. */
  icon?: string | false

  /** Text for CSV export and clipboard copy. Defaults to the cell's formatted text. */
  exportValue?: (context: CellContext<TRow, TNode>) => string

  /** Excluded from CSV export and clipboard copy. Useful for an actions column. */
  exportable?: boolean

  /**
   * The cells can be edited in place: `true` for every row, or a function
   * that says which. Double-click a cell (or click, with `editTrigger:
   * "click"`), press Enter or F2 on it, or start typing, and it becomes an
   * editor suited to its type — a text box, a number box with the column's
   * precision, a filterable list of `formatOptions.options`, a date or time
   * picker. Enter, Tab and leaving the cell commit; Escape cancels.
   *
   * The table never changes the data: a committed edit is handed to the
   * table's `onCellEdit`, and the cell shows what the data says once the
   * caller has updated it. Defaults to `false`.
   */
  editable?: boolean | ((row: TRow) => boolean)

  /**
   * Replaces the built-in editor with your own — a date-range picker, a
   * popover, a search against your API. Call `commit(value)` with the new
   * value or `cancel()` to put the cell back. The value goes through `parse`
   * and `validate` like any other.
   */
  renderEditor?: (context: EditorContext<TRow, TNode>) => TNode

  /**
   * Turns what the editor produced into the value to store — `"12"` into
   * `12`, a name into an id. Runs before `validate`. The built-in editors
   * already produce a value of the column's type, so this is for the
   * exceptions.
   */
  parse?: (value: unknown, row: TRow) => unknown

  /**
   * Whether an edited value may be committed. Return a message — or `false`
   * for a generic one — to refuse it: the editor stays open, marked invalid,
   * with the message beside it. `true`, `undefined` or nothing means fine.
   */
  validate?: (value: unknown, row: TRow) => string | boolean | null | undefined

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
  "type" | "accessor" | "header" | "headerSearch" | "pin"
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
  /** Whether the column can be searched from its header. */
  headerSearch: boolean
  /**
   * The choices a set filter should offer, if the column named any.
   *
   * Kept apart from `formatOptions.options`, which is about rendering a value:
   * a column can label its cells from one list and offer a different, larger
   * one to filter by — which is exactly what a server-side table needs.
   */
  filterOptions?: SelectOption[] | FilterOptionsProvider
  icon: string | false
  /** Position among the visible columns, after ordering and pinning. */
  index: number
  /** Resolved width in pixels, from state or the definition. Absent means content-sized. */
  width?: number
  /** Frozen always, from the state or the definition. */
  pin?: Pin
  /** Frozen only below or above a width of the table; absent when `pin` is set or the column is not pinned so. */
  pinWhen?: ResponsivePin
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
  /**
   * Row ids whose detail row is open — see the table's `detail` option.
   *
   * Optional so that a state written before detail rows existed — a saved
   * view, a test fixture, a type somebody spelled out by hand — is still a
   * state. Every table fills it in as `[]`, and a missing key means nothing
   * is open.
   */
  expanded?: string[]
  /**
   * The active cell, or row: where the keyboard is, and what to bring into
   * view. Setting it from outside — a banner's "show me" link — scrolls the
   * table to that row, highlights it and, with `cellNavigation` on, moves the
   * focus there. `null` or absent means nothing is active.
   *
   * Optional for the same reason as `expanded`.
   */
  focus?: CellFocus | null
  /**
   * Parents whose child rows are folded away — see the table's
   * `getParentId`. Children are shown unless their parent is named here.
   * Folding is presentation only: folded children still match, count towards
   * nothing, and are exported under their parent.
   *
   * Optional for the same reason as `expanded`.
   */
  collapsed?: string[]
}

/**
 * A cell, or a whole row, the table should treat as active.
 *
 * Without `key` it is the row: highlighted and scrolled to, with the keyboard
 * landing on its first cell. `align` is where in the scroll area the row is
 * brought to; it defaults to `"nearest"`, which moves the table as little as
 * it can.
 */
export type CellFocus = {
  rowId: string
  /** A column key, or one of the table's own columns: `"__select"`, `"__expand"`. */
  key?: string
  align?: "start" | "center" | "end" | "nearest"
}

/**
 * How tall a row is.
 *
 * - `"fixed"` — one line a cell, truncated with an ellipsis. The default, and
 *   the right answer for a table of values you scan down.
 * - `"auto"` — cells wrap and the row grows to fit its tallest one, whatever
 *   that is: prose, a stack of tags, an image, a whole component from a cell
 *   renderer. `--tpz-row-height` becomes the minimum rather than the height,
 *   so rows of short values keep the density's rhythm.
 * - a number — every row that many pixels, with the cells wrapping to use them
 *   and anything that will not fit ending in an ellipsis. Asking for taller
 *   rows and being given one truncated line adrift in the middle of them would
 *   be a strange reading of it, and so would a height that could not shrink a
 *   row.
 *
 * Auto height costs nothing to arrange because the table is a real `<table>`
 * in normal flow: the browser sizes the row, so there is no measuring pass, no
 * `ResizeObserver`, no second layout and nothing to get wrong on the server.
 * A grid of absolutely-positioned divs has to measure every row to do this,
 * which is why it is slow and jumpy everywhere else.
 */
export type RowHeight = "fixed" | "auto" | number

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
  /**
   * Where each of `rows` sits in a table with child rows, in the same order.
   * Absent when the table has none.
   */
  info?: RowInfo[]
  /**
   * The page these rows are, one-based: `state.page` held inside the page
   * count, or the page a revealed row is on. When it differs from
   * `state.page` the adapter writes it back, so the state says what is shown.
   */
  page: number
  /** True when filters or search removed rows that otherwise exist. */
  filtered: boolean
}

/**
 * A rendered row's place in a table with child rows — what an adapter needs
 * to indent a child, give a parent its toggle, and quieten a parent shown
 * only for the sake of a child.
 */
export type RowInfo = {
  /** `0` for a parent or a row on its own, `1` for a child. */
  depth: 0 | 1
  /** A child's parent's id. */
  parentId?: string
  /** For a parent, how many of its children match — shown, or folded away. `0` otherwise. */
  childCount: number
  /** A parent shown only because one of its children matched the filters or the search. */
  context: boolean
}

/**
 * Where a server-side table gets the answers it cannot work out for itself.
 *
 * With the data on a server the table holds one page, so two things it does
 * well in the browser become impossible alone: a set filter cannot know what
 * values a column has, and an export cannot include rows it has never seen.
 *
 * Both need one thing — a way to ask. Given here once, every set-filter column
 * and the export use it without being configured individually, so there is
 * nothing to forget on the twelfth column.
 *
 * The library still fetches nothing itself: these are your functions, hitting
 * your endpoint, with your authentication. It only knows when to call them.
 */
export type ServerSource<TRow = AnyRow> = {
  /**
   * The values a column can hold, for its set filter.
   *
   * Called with the column's key the first time somebody opens that column's
   * panel, and remembered afterwards. Return labelled choices, or plain
   * strings if the value is the label.
   */
  distinct?: (
    columnKey: string,
    state: TableState,
  ) => readonly (SelectOption | string)[] | Promise<readonly (SelectOption | string)[]>

  /**
   * Every row matching the current filters and search, for an export.
   *
   * The same query that fetches a page, with the paging left off. The table
   * writes the file from what comes back.
   */
  all?: (state: TableState) => readonly TRow[] | Promise<readonly TRow[]>
}

/** What a detail renderer is given. */
export type DetailContext<TRow = AnyRow> = {
  row: TRow
  /** The row's stable id, as resolved by `getRowId`. */
  rowId: string
  /** Index within the rows currently rendered, not within the whole dataset. */
  rowIndex: number
  /** Closes this detail row — for a "done" button inside it. */
  collapse(): void
}

/**
 * Detail rows: content that opens below a row and spans the whole width.
 *
 * A row's detail is open when its id is in `state.expanded`, so which rows are
 * open is controllable, survives a re-render, can be saved with a view and —
 * with `include: ["expanded"]` — travels in the URL. The server renders open
 * rows open.
 *
 * The detail row is not a row of the table in any other sense: it is never
 * counted, paged, sorted, selected or exported, and it takes the height of
 * whatever is put in it, in normal flow, with nothing measured.
 *
 * Written as methods so that a narrower row type is accepted by an adapter
 * whose component is not generic, as `SelectionOptions` explains.
 */
export type DetailOptions<TRow = AnyRow, TNode = unknown> = {
  /** What opens below the row. Anything the adapter can render. */
  render(context: DetailContext<TRow>): TNode
  /**
   * Rows that have no detail. Their expander is left out, and they cannot be
   * opened from the state either. Defaults to every row.
   */
  canExpand?(row: TRow): boolean
  /**
   * Keeps a closed detail in the document, hidden, rather than taking it out.
   *
   * For a detail that loads its own data: opening it a second time shows what
   * it already has instead of fetching again. Defaults to `false`, which
   * unmounts it, so a table of a thousand rows that have each been opened once
   * is not holding a thousand details nobody can see.
   */
  keepMounted?: boolean
  /**
   * A click anywhere on the row opens and closes its detail, as well as the
   * expander. Clicks on links, buttons, inputs, labels and menus inside the
   * row are left to them. Defaults to `false`, so a row that is also a link
   * or has `onRowClick` keeps doing what it did.
   */
  toggleOnRowClick?: boolean
}

/**
 * Rows held at the top or bottom of the table, outside the data — an editable
 * "new entry" row, a totals row.
 *
 * Drawn through the same columns, renderers and editors as the data, and kept
 * in view while the body scrolls. Never filtered, searched, sorted, paged,
 * counted, selected or exported. Give them ids of their own (`id`, or the
 * table's `getRowId`) when they are edited, so an edit can say which one; a
 * row without one is `"top-0"`, `"bottom-0"` and so on.
 */
export type PinnedRows<TRow = AnyRow> = {
  top?: readonly TRow[]
  bottom?: readonly TRow[]
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

/**
 * Row selection behaviour.
 *
 * `true` on a table means `{ mode: "multiple" }`; a bare `"single"` or
 * `"multiple"` sets the mode alone. The object form is for the rest.
 *
 * The callbacks are written as methods rather than function properties so
 * that a narrower row type is accepted: an adapter whose component is not
 * generic, like Vue's, types rows as `AnyRow`, and a caller's
 * `(invoice: Invoice) => …` must still be allowed in.
 */
export type SelectionOptions<TRow = AnyRow> = {
  /** One row at a time, as radio buttons, or any number, as checkboxes. Defaults to `multiple`. */
  mode?: "single" | "multiple"
  /**
   * Rows that cannot be selected — an archived record, a locked row, a total.
   *
   * Their checkbox is rendered disabled, the header checkbox and a shift-click
   * range skip them, and they are never handed to `onChange`. Everything else
   * about the row is unchanged: it still sorts, filters and exports.
   */
  isSelectable?(row: TRow, index: number): boolean
  /** Fires with the ids and the rows behind them, whenever the selection changes. */
  onChange?(ids: string[], rows: TRow[]): void
  /**
   * What the header checkbox selects: `"page"`, the rows on screen — the
   * default — or `"matching"`, every row the filters and search leave, on
   * every page. In server mode `"matching"` asks `server.all` for the rows,
   * since the table holds only one page of them.
   */
  selectAll?: "page" | "matching"
  /**
   * Select rows by pressing on one and dragging across the others. A press
   * that does not move is still a click; one on a control in the row — a link,
   * a button, the drag handle — is left to it. Shift extends the selection from
   * the last row chosen instead of replacing it. Defaults to `false`, because
   * a drag across a table is also how people select its text to copy.
   */
  dragSelect?: boolean
}

/**
 * Every way a caller can ask for selection: a switch, a mode, or the options.
 */
export type SelectionInput<TRow = AnyRow> = boolean | "single" | "multiple" | SelectionOptions<TRow>

/** Selection as the adapters read it, with the mode always decided. */
export type ResolvedSelection<TRow = AnyRow> = SelectionOptions<TRow> & { mode: "single" | "multiple" }
