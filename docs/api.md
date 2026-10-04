# API reference

Everything the packages export. Types are shown in TypeScript; the same names apply in every adapter.

## `<Table>`

```tsx
import { Table } from "@trapezium/react"
```

### Data

| Prop | Type | Default | |
|---|---|---|---|
| `data` | `readonly TRow[]` | required | The rows. In server mode, the current page. |
| `columns` | `(ColumnDef \| string)[]` | inferred | Definitions or bare keys. |
| `getRowId` | `(row, index) => string` | `row.id ?? row.uuid ?? index` | Row identity. |
| `server` | `boolean \| ServerSource<TRow>` | `false` | The rows are already filtered, sorted and paged. An object says where the answers the table cannot work out for itself come from — `{ distinct, all }`. |
| `total` | `number` | `data.length` | Total matching rows, for server mode. |
| `loading` | `boolean` | `false` | Shows skeletons, or dims existing rows. |
| `error` | `ReactNode` | — | Shows the error state instead of rows. |

### State

| Prop | Type | Default | |
|---|---|---|---|
| `state` | `Partial<TableState>` | — | Controlled state. Controls exactly the keys it contains; the rest stay with the table. |
| `defaultState` | `Partial<TableState>` | — | Starting state, uncontrolled. Read once. Every adapter. |
| `onStateChange` | `(state: TableState) => void` | — | Fires with the complete next state. |

### Features

| Prop | Type | Default | |
|---|---|---|---|
| `search` | `boolean \| { placeholder?, debounce? }` | `false` | Global search. |
| `filters` | `boolean` | `true` | Per-column filters. Off, it takes header search with it: a search is a filter. |
| `headerSearch` | `boolean \| { debounce? }` | `false` | A magnifier in each header that turns it into a text box and filters that column as "contains", against the text its cells show. `true` covers every column that can be filtered; a column's own `headerSearch` overrides it. `debounce` is the wait after a keystroke, 150ms by default. See [filtering](filtering.md#searching-one-column-from-its-header). |
| `sortable` | `boolean \| SortOptions` | `true` | Column sorting. A shift-click adds a level, and a reset appears in the toolbar while a sort is applied. See [sorting](columns.md#sorting). |
| `resizable` | `boolean` | `true` | Drag column edges. |
| `reorderable` | `boolean` | `true` | Drag headers to move a column, or out of the table to remove it. |
| `columnMenu` | `boolean` | `true` | The chevron menu in each header. |
| `columnControl` | `boolean` | `true` | The "Columns" button. |
| `pagination` | `boolean \| PaginationOptions` | `{ mode: "pages", pageSize: 25 }` | See below. |
| `selection` | `boolean \| "single" \| "multiple" \| SelectionOptions` | `false` | `true` means multiple. |
| `onSelectionChange` | `(ids: string[], rows: TRow[]) => void` | — | |
| `export` | `boolean \| { filename?, clipboard?, scope?, fetchRows?, onExport? }` | `false` | CSV and clipboard. Contains the selected rows when there are any, and otherwise every matching row, not the page. `scope: "page"` narrows it; `fetchRows` supplies rows the table does not have and lets it write the file; `onExport` takes the whole thing over. |

`SortOptions` — `{ multiple?: boolean, reset?: boolean \| Sort[] }`. `multiple` (default `true`) lets a shift-click, or "Then sort" in a column's menu, add a level; set it to `false` for a backend that orders by one column. `reset` (default `true`) is the reset control in the toolbar: `true` returns to no sort, an array names the sort the table rests in — the control returns there and hides while the table is already in it — and `false` leaves the control out.

`PaginationOptions` — `{ mode?: "pages" \| "simple" \| "loadMore" \| "infinite", pageSize?: number, pageSizeOptions?: number[], siblings?: number }`

`SelectionOptions` — `{ mode?: "single" \| "multiple", isSelectable?: (row, index) => boolean, onChange?: (ids, rows) => void }`. A row `isSelectable` refuses renders a disabled checkbox; the header checkbox and shift-click ranges skip it.

### Presentation

| Prop | Type | Default | |
|---|---|---|---|
| `density` | `"compact" \| "normal" \| "relaxed"` | `"normal"` | |
| `densityControl` | `boolean` | `false` | Offer the density switch in the toolbar. |
| `rowHeight` | `"fixed" \| "auto" \| number` | `"fixed"` | `"auto"` sizes each row to its tallest cell; a number gives them all the same height. Both wrap; only `"fixed"` truncates. See [row height](styling.md#row-height). |
| `responsive` | `"scroll" \| "cards"` | `"scroll"` | |
| `stickyHeader` | `boolean` | `true` | |
| `maxHeight` | `number \| string` | — | Caps the scroll area. |
| `theme` | `"light" \| "dark"` | follows the page | |
| `className` | `string` | — | On the root. |
| `classNames` | `Partial<TableSlots>` | — | Added per slot. |
| `unstyled` | `boolean` | `false` | Drop the default classes. |
| `caption` | `ReactNode` | — | Visible caption. |
| `aria-label` | `string` | — | Name the table for a screen reader. |

### Rendering

| Prop | Type | |
|---|---|---|
| `types` | `Record<string, TypeDef>` | Custom types, merged over the built-ins. |
| `format` | `Partial<FormatContext>` | Locale, timezone, currency, empty text. |
| `rowHref` | `(row) => string` | Makes the leading cell a link. |
| `onRowClick` | `(row, event) => void` | |
| `rowClassName` | `(row, index) => string \| undefined` | |
| `emptyState` | `ReactNode` | Replaces the default. A `#empty` slot in Vue; a node or string elsewhere. |
| `emptyMessage` | `string` | Text for the default. |
| `toolbar` | `ReactNode` | Extra toolbar controls. A slot in Vue; a node or string elsewhere. |
| `appendRow` | `ReactNode` | A row below the last one. A slot in Vue; a node or string elsewhere. |
| `footer` | `ReactNode` | Below the table, inside the frame. A slot in Vue; a node or string elsewhere. |
| `buildHref` | `(state) => string` | Renders controls as links. Every adapter. |
| `linkComponent` | `(props) => ReactNode` | Your router's `Link`. React only. |
| `onNavigate` | `(href, event) => void` | A plain click on one of the table's links, with its URL, the browser's navigation prevented — for a router with a `navigate` function. Also a shift-click on a sortable header, with the URL of the view that adds that column to the sort, since no link points at it. Every adapter; `@navigate` in Vue. |

## `ColumnDef`

| Property | Type | Default | |
|---|---|---|---|
| `key` | `string` | required |
| `header` | `string` | humanised key |
| `type` | `string` | inferred |
| `accessor` | `(row) => unknown` | `row[key]`, or the dotted path |
| `format` | `(context) => string` | the type's formatter |
| `formatOptions` | `FormatOptions` | — |
| `render` | `(context) => ReactNode` | the default renderer |
| `renderHeader` | `(context) => ReactNode` | the default header |
| `sortable` | `boolean` | the type's |
| `compare` | `(a, b) => number` | the type's |
| `searchable` | `boolean` | the type's |
| `filter` | `boolean \| FilterKind \| { kind?, operators?, options?, defaultOperator? }` | the type's | `options` is a list of choices for a set filter, or a function returning one (possibly a promise), fetched on first open and remembered. |
| `headerSearch` | `boolean` | the table's `headerSearch` | Search this column from its header. Opts one column in or out, whatever the table says. The table's `true` does not reach a column with no heading, or with `filter: false`; the table's `filters={false}` switches it off everywhere. |
| `align` | `"start" \| "center" \| "end"` | the type's |
| `width` / `minWidth` / `maxWidth` | `number` | — |
| `pin` | `"start" \| "end"` | — |
| `hidden` | `boolean` | `false` |
| `resizable` / `reorderable` | `boolean` | `true` |
| `wrap` | `boolean \| number` | `false` | `true` wraps; a number caps it at that many lines; `false` keeps one line under any wrapping `rowHeight`. |
| `mono` | `boolean` | the type's |
| `icon` | `string \| false` | the type's |
| `exportable` | `boolean` | `true` |
| `exportValue` | `(context) => string` | the cell's text |
| `className` / `headerClassName` | `string` | — |
| `meta` | `Record<string, unknown>` | — |

`FilterKind` — `"text" \| "set" \| "range" \| "date" \| "boolean" \| "none"`

## `CellContext`

Passed to `format`, `render` and `exportValue`.

```ts
{ value, row, rowIndex, rowId, column, text, format }
```

## `ServerSource`

Passed as `server` instead of `true`, when the rows come from a server. Both members are optional; each removes one development warning.

```ts
{
  /** Values for a set filter. Called per column, on first open, and remembered. */
  distinct?: (columnKey: string, state: TableState) =>
    readonly (SelectOption | string)[] | Promise<readonly (SelectOption | string)[]>

  /** Every row matching the current filters and search, for an export. */
  all?: (state: TableState) => readonly TRow[] | Promise<readonly TRow[]>
}
```

## `TableState`

```ts
{
  sort: { key: string; direction: "asc" | "desc" }[]
  filters: { key: string; operator: FilterOperator; value?: FilterValue }[]
  match: "all" | "any"
  search: string
  page: number          // one-based
  pageSize: number
  selection: string[]
  order: string[]
  hidden: string[]
  widths: Record<string, number>
  pinned: Record<string, "start" | "end">
  density: "compact" | "normal" | "relaxed"
}
```

`FilterOperator` — `eq` `ne` `contains` `notContains` `startsWith` `endsWith` `gt` `gte` `lt` `lte` `between` `in` `notIn` `empty` `notEmpty`

## `renderToString(options)`

```ts
import { renderToString } from "@trapezium/vanilla"   // also from @trapezium/vue and @trapezium/svelte
```

The table as HTML, for a server. Takes the same options as `createTable` and returns the markup `createTable` would produce for them, byte for byte; `createTable` on an element that already holds it replaces it in place, and adopts anything done to it first — a box ticked, a search typed. A string slot is written and a node slot is left out; a cell renderer built with `el` renders, one that needs `document` is written as the cell's text. The Vue and Svelte components call this themselves, so a Nuxt or SvelteKit page needs nothing more.

`renderToTree(options)` returns the same table as a tree of server elements, for an adapter that turns it into its own nodes — the Vue adapter makes VNodes of it, which is how Vue slots and component cells render on the server.

## `useTable(props)`

The model with no markup. Takes the same props as `<Table>` and returns:

```ts
{
  rows,          // the page on screen
  matchedRows,   // every row the filters and search leave, before pagination
  rowIds, total, pageCount, filtered,
  columns, hiddenColumns, allColumns,
  state, update, patch,
  types, format, pagination, selection, server,
  headerSearchDebounce,   // how long a header search waits after a keystroke
}
```

## Core

Everything below is exported from `@trapezium/core`, and re-exported from every adapter.

### State

`DEFAULT_STATE` · `createState(partial?)` · `toggleSort(state, key, additive?)` · `setSort` · `addSort(state, key, direction)` · `removeSort(state, key)` · `clearSort` · `resetSort(state, to?)` · `setFilter` · `addFilter` · `removeFilter` · `removeFilterAt` · `clearFilters` · `setColumnSearch(state, key, text)` · `columnSearchText(state, key)` · `setMatch` · `setSearch` · `setPage` · `setPageSize` · `setDensity` · `toggleSelection` · `setSelected` · `clearSelection` · `hideColumn` · `showColumn` · `toggleColumn` · `setOrder` · `setWidth` · `clearWidth` · `setPin` · `togglePin` · `resetView` · `isFiltering`

All pure `(state, …) => state`. Anything that changes which rows match resets `page` to 1.

`toggleSort` cycles a column ascending, descending, off. With `additive` — a shift-click — the other levels are left alone: a new column joins the end of the sort, and one already in it turns over where it is. `addSort` adds a level in a named direction, or redirects one in place; `removeSort` takes one level out; `resetSort` puts the whole sort back to the one given, or to none.

`setColumnSearch` is what typing into a column's header does: the text becomes a `contains` filter on that column, and an empty string removes it — but only if it was a search, so a column filtered some other way is left alone. `columnSearchText` reads it back.

### Sorting and header search

`resolveSorting(sortable)` · `canResetSort(sort, sorting)` · `sortsEqual(a, b)` · `sortLevels(sort, columns)` · `sortPriority(sort, key)` · `resolveHeaderSearch(headerSearch)` · `HEADER_SEARCH_DEBOUNCE`

What the adapters use to read the `sortable` and `headerSearch` options the same way, for anyone binding their own renderer. `sortLevels` is the part of the sort the visible columns can speak for — a level on a hidden or unsortable column, or a column named twice in a link, does not order the rows and is left out — and `sortPriority` is a column's place in those levels, counted from one, and `undefined` when it is the only one.

### Pipeline

`getRows(options)` · `sortRows` · `searchRows` · `filterRows` · `pageCount` · `resolveRowId` · `matchesFilter` · `isFilterUsable` · `normaliseFilter` · `rangeFilter(key, low, high)` · `isTextOperator` · `TEXT_OPERATORS` · `filterInputType(column, operator)`

`matchesFilter` answers `true` for an incomplete filter — one that asks nothing excludes nothing. Drop those with `isFilterUsable` before combining conditions yourself, or a half-typed filter will widen an OR to everything.

The text operators — `contains`, `notContains`, `startsWith`, `endsWith` — are answered from the stored value written out and from the text the column's type shows for it, so `matchesFilter(value, { operator: "contains", value: "Aug" }, dateType, format)` is true of a date in August. Pass the same `format` the table was given, or a server and a browser will disagree about what a cell says.

`filterInputType` says what kind of box a filter's value is typed into — `"text"`, `"number"`, `"date"` or `"time"` — for anyone drawing their own filter control: text for the text operators and the ones that take a list, a date picker for a `date` filter, a number box for a `range` filter, and a time picker for a `range` filter on a `time` column.

`rangeFilter` is what a range control's two boxes mean: `between` when both are filled, `gte` or `lte` when one is, and no filter at all — `undefined` — when neither is.

`normaliseFilter` puts a filter's value into the shape its operator implies: a list for `in`, `notIn` and `between`, a single value for the rest, and none at all for `empty` and `notEmpty`. Every state transition applies it, which is what keeps state and its URL identical.

### Columns

`resolveColumns(options)` · `moveColumn(keys, key, direction)` · `reorderColumn(keys, key, toIndex)` · `reorderColumnTo(keys, dragged, target, "before" | "after")` · `pruneState(state, keys)` · `inferColumns(rows, options?)` · `inferType(key, values)` · `distinctValues(values, limit?)`

### Types

`defineType(type)` · `createTypeRegistry(custom?)` · `defaultTypeRegistry` · `BUILT_IN_TYPES` · `TYPE_ALIASES` · `formatWithType` · `compareWithType`

### Formatting

`DEFAULT_FORMAT` · `formatNumber` · `formatCurrency` · `formatPercent` · `formatDate` · `formatDateTime` · `formatTime` · `formatRelativeTime` · `minorUnitScale` · `optionLabel` · `toBoolean` · `toDate` · `toNumber` · `toText` · `isDateOnly`

### URL

`stateToSearchParams(state, options?, into?)` · `stateToQueryString` · `stateFromSearchParams` · `stateFromUrl` · `pickUrlState(state, options?)` · `applyStateToUrl(url, state, options?)` · `encodeFilters` · `decodeFilters` · `URL_KEYS` · `DEFAULT_URL_KEYS`

`UrlOptions` — `{ include?: UrlStateKey[], prefix?: string, defaults?: Partial<TableState> }`. `defaults` are the table's own resting values where they differ from the library's — a page size of fifteen, say — and must be passed to every read and write so the two agree.

`pickUrlState` returns the keys the URL carries, with defaults filled in — what to pass as a controlled `state` when the URL is the source of truth, so selection and widths stay with the table.

### Export

A CSV is read by a spreadsheet, not by a person looking at a page, so money and numbers are written as numbers and dates as ISO — a column of amounts adds up, a column of dates sorts. Labels stay readable: a `select` exports "Professional", not "pro". Override per column with `exportValue`, or per type with `TypeDef.exportValue`.

`toCsv(rows, options)` · `toDelimitedText` · `exportCell` · `downloadText(text, filename, mimeType?)` · `copyText(text)`

### Effects

`poof({ x, y, size?, theme? })` — the puff of smoke shown where a column was dragged out. Does nothing where there is no document, and nothing for anyone who has asked for reduced motion.

### Store

`createStore(initial)` · `createTableStore(initial?)` — a subscribable state container for adapters that are not React.

### Icons

`ICONS` · `iconPath(name)` — path data on a 16×16 grid, stroked in `currentColor`.

### Utilities

`isEmpty` · `humanise` · `getPath` · `compareUnknown` · `textIncludes` · `textEquals` · `textStartsWith` · `textEndsWith` · `createTextMatcher(query)` · `createTextTest(mode, query)` · `clamp` · `shallowEqual` · `toSelectOptions` — turns a loose list of choices, where a plain string stands for `{ value }`, into `SelectOption[]`.
