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
| `detail` | `DetailOptions<TRow>` | — | Detail rows: content that opens below a row, spanning the table. Open rows are `state.expanded`. See [rows](rows.md#detail-rows). |
| `cellNavigation` | `boolean` | `true` when a column is `editable`, otherwise `false` | Cells the keyboard moves between: one tab stop, then arrows, Home, End and the Page keys. Makes the table a `role="grid"`. The active cell is `state.focus`. See [editing](editing.md#moving-between-cells). |
| `onCellEdit` | `(edit: CellEdit<TRow>) => void \| Promise<unknown>` | — | Every committed edit of an `editable` column. Update your data with `edit.value`. A promise shows the cell as saving; a rejection marks it as failed and shows the data's value again. In Vue a prop, bound with `@cell-edit`. |
| `editTrigger` | `"click" \| "doubleClick"` | `"doubleClick"` | What opens an editable cell with the mouse. Enter, F2 and typing open it from the keyboard either way. |

`SortOptions` — `{ multiple?: boolean, reset?: boolean \| Sort[] }`. `multiple` (default `true`) lets a shift-click, or "Then sort" in a column's menu, add a level; set it to `false` for a backend that orders by one column. `reset` (default `true`) is the reset control in the toolbar: `true` returns to no sort, an array names the sort the table rests in — the control returns there and hides while the table is already in it — and `false` leaves the control out.

`PaginationOptions` — `{ mode?: "pages" \| "simple" \| "loadMore" \| "infinite", pageSize?: number, pageSizeOptions?: number[], siblings?: number }`

`SelectionOptions` — `{ mode?: "single" \| "multiple", isSelectable?: (row, index) => boolean, onChange?: (ids, rows) => void, selectAll?: "page" \| "matching", dragSelect?: boolean }`. A row `isSelectable` refuses renders a disabled checkbox; the header checkbox and shift-click ranges skip it. `selectAll` (default `"page"`) is what the header checkbox selects; `"matching"` is every row the filters leave, fetched from `server.all` in server mode. `dragSelect` (default `false`) selects the rows a press sweeps across. Shift with an arrow key extends a selection, and Escape clears it, in every table with selection.

`CellEdit` — `{ rowId, row, key, value, previousValue, pinned?: "top" \| "bottom" }`. `value` has been through the column's `parse`, and is in the shape of the value it replaces.

`DetailOptions` — `{ render: (context: DetailContext) => node, canExpand?: (row) => boolean, keepMounted?: boolean, toggleOnRowClick?: boolean }`. `DetailContext` is `{ row, rowId, rowIndex, collapse() }`. `canExpand` (default every row) leaves a row without an expander, and keeps it closed whatever the state says. `keepMounted` (default `false`) keeps a closed detail in the document, hidden, once it has been opened, so it does not load again. `toggleOnRowClick` (default `false`) opens a row's detail from a click anywhere on it, except on a control inside it.

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
| `id` | `string` | `useId()` in React, `"tpz"` elsewhere | Base for the ids the table gives its own elements, such as the detail row an expander points at. Unique per table when a page has several with detail rows. |

### Rendering

| Prop | Type | |
|---|---|---|
| `types` | `Record<string, TypeDef>` | Custom types, merged over the built-ins. |
| `format` | `Partial<FormatContext>` | Locale, timezone, currency, empty text. |
| `rowHref` | `(row) => string` | Makes the leading cell a link. |
| `onRowContextMenu` | `(row, event, info) => void` | A context menu on a row. `info` is `{ rowId, columnKey, column, text, rowText, pinned? }`: the cell under the pointer (`null` over the table's own columns), the text it shows, and the row as the table's copy writes it. Call `event.preventDefault()` to keep the browser's menu closed. `@row-context-menu` in Vue. |
| `onRowClick` | `(row, event) => void` | A click anywhere in the row except on a control inside it — a link, button, input, select, label, menu, or anything marked `data-tpz-interactive`. |
| `rowClassName` | `(row, index, info?) => string \| undefined` | With child rows, `info` is the row's `RowInfo` — `{ depth, parentId, childCount, context }`. |
| `pinnedRows` | `{ top?: TRow[], bottom?: TRow[] }` | Rows held at the top or bottom, outside the data — a "new entry" row, a totals row. Same columns, renderers and editors; kept in view; never filtered, sorted, paged, counted, selected or exported. An edit of one carries `pinned`. See [rows](rows.md#pinned-rows). |
| `rowReorder` | `{ canDrag?: (row) => boolean, onReorder: (move: RowMove) => void \| Promise<unknown> }` | Rows moved by a drag handle or Alt with an arrow key. `RowMove` is `{ rowId, row, afterId, beforeId, parentId? }`. Only while unsorted. See [rows](rows.md#moving-rows). |
| `getParentId` | `(row) => string \| null \| undefined` | One level of child rows, drawn under their parent and folded with `state.collapsed`. Sorted among themselves, a parent shown as context for a matching child, never split across pages — pages and totals count parents. See [rows](rows.md#child-rows). |
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
| `renderHeader` | `(context) => ReactNode` | the header text | Replaces the header's text; the sort, menu, search and resize controls stay around it. Phrasing content only — it sits inside the sort control, which keeps `header` as its name. |
| `renderHeaderControls` | `(context) => ReactNode` | — | Controls of your own in the header — a search box, a filter button — after the sort control and before the menu. They can be links, buttons and inputs; a click or press in them never sorts or moves the column. Hidden with the header row in the card layout. |
| `description` | `string` | — | What the column means: a tooltip on hover or focus, and `aria-describedby` on the header. |
| `sortable` | `boolean` | the type's |
| `compare` | `(a, b) => number` | the type's |
| `searchable` | `boolean` | the type's |
| `filter` | `boolean \| FilterKind \| { kind?, operators?, options?, defaultOperator? }` | the type's | `options` is a list of choices for a set filter, or a function returning one (possibly a promise), fetched on first open and remembered. |
| `headerSearch` | `boolean` | the table's `headerSearch` | Search this column from its header. Opts one column in or out, whatever the table says. The table's `true` does not reach a column with no heading, or with `filter: false`; the table's `filters={false}` switches it off everywhere. |
| `align` | `"start" \| "center" \| "end"` | the type's |
| `width` / `minWidth` / `maxWidth` | `number` | — (`width` is held exactly; `maxWidth` caps cells and header) |
| `grow` | `number` | — (share of the spare width; others keep to their content) |
| `pin` | `"start" \| "end" \| { side, below?, above? }` | — (the object freezes by the table's width, in CSS) |
| `editable` | `boolean \| (row) => boolean` | `false` | The cells edit in place, with an editor chosen by the type. See [editing](editing.md#editing-in-place). |
| `renderEditor` | `(context: EditorContext) => node` | the type's editor | Your own editor. `EditorContext` is `{ value, initialText, row, rowId, column, commit(value), cancel() }`. |
| `parse` | `(value, row) => unknown` | — | Turns what the editor produced into what is stored, before `validate`. |
| `validate` | `(value, row) => string \| boolean \| null \| undefined` | — | A message, or `false`, refuses the value; the editor stays open and says why. |
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
  expanded?: string[]   // rows whose detail is open; [] when absent
  collapsed?: string[]  // parents whose child rows are folded away; [] when absent
  focus?: { rowId: string; key?: string; align?: "start" | "center" | "end" | "nearest" } | null
                        // the active cell or row; setting it scrolls there, highlights it and, with
                        // cellNavigation, focuses it — bringing it onto its page in client mode
}
```

Keys added after 0.3.0 are optional in the type, so a state saved or written out by hand before they existed is still a `TableState`. Every table fills them in.

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

`DEFAULT_STATE` · `createState(partial?)` · `toggleCollapsed(state, parentId)` · `setCollapsed(state, parentIds, collapsed)` · `isCollapsed(state, parentId)` · `focusCell(state, rowId, key?, align?)` · `clearFocus(state)` · `toggleExpanded(state, id)` · `setExpanded(state, ids, open)` · `collapseAll(state)` · `isExpanded(state, id)` · `toggleSort(state, key, additive?)` · `setSort` · `addSort(state, key, direction)` · `removeSort(state, key)` · `clearSort` · `resetSort(state, to?)` · `setFilter` · `addFilter` · `removeFilter` · `removeFilterAt` · `clearFilters` · `setColumnSearch(state, key, text)` · `columnSearchText(state, key)` · `setMatch` · `setSearch` · `setPage` · `setPageSize` · `setDensity` · `toggleSelection` · `setSelected` · `clearSelection` · `hideColumn` · `showColumn` · `toggleColumn` · `setOrder` · `setWidth` · `clearWidth` · `setPin` · `togglePin` · `resetView` · `isFiltering`

All pure `(state, …) => state`. Anything that changes which rows match resets `page` to 1.

`toggleSort` cycles a column ascending, descending, off. With `additive` — a shift-click — the other levels are left alone: a new column joins the end of the sort, and one already in it turns over where it is. `addSort` adds a level in a named direction, or redirects one in place; `removeSort` takes one level out; `resetSort` puts the whole sort back to the one given, or to none.

`setColumnSearch` is what typing into a column's header does: the text becomes a `contains` filter on that column, and an empty string removes it — but only if it was a search, so a column filtered some other way is left alone. `columnSearchText` reads it back.

### Detail rows and row clicks

`moveRowTo(ids, rowId, targetId, "before" \| "after")` · `stepRow(ids, rowId, -1 \| 1)` · `applyRowMove(rows, ids, move)` · `canReorderRows(sort)` · `startRowDrag({ event, row, targetFor, onDrop, longPress? })` · `pinnedRowId(row, index, side, getRowId?)` · `pinnedOffset(index, count, side)` · `rangeSelection(base, ids, anchor, target)` · `startDragSelect(options)` · `createEdgeScroller(row, onScroll)` · `parentIdsWithChildren(rows, getParentId, getRowId?)` · `getRowsWithChildren(options)` · `expandableIds(rows, rowIds, detail)` · `isDetailOpen(state, row, id, detail)` · `isInteractiveTarget(target, within)` · `INTERACTIVE_SELECTOR`

`expandableIds` is the rows among those given that have a detail — what "expand all" opens. `isDetailOpen` is whether a row's detail shows: named in `state.expanded`, and allowed by `canExpand`. `isInteractiveTarget` is the rule every row gesture follows: true when the click landed on a control inside `within` rather than on the row.

### Keyboard and editing

`nextCell(grid, from, key, { ctrlKey?, pageRows?, rtl? })` · `entryCell(grid, focus)` · `isNavigationKey(key)` · `isCellEditable(column, row)` · `hasEditableColumns(columns)` · `editorKind(column, types)` · `editorOptions(column, kind, format)` · `editorStep(column)` · `toEditorText(value, kind, column, format)` · `fromEditorText(text, kind, column, previous, format)` · `validateEdit(column, value, row)` · `editValuesEqual(a, b)` · `typedCharacter(event)` · `placePopup(anchor, size, viewport, options?)`

`nextCell` answers where the active cell goes for an arrow, Home, End, Page Up or Page Down over a `NavigationGrid` of `{ rows: rowIds, columns: keys }`, or `undefined` at an edge — nothing wraps. `entryCell` is the one cell in the tab order. `editorKind` is `"text" | "number" | "select" | "boolean" | "date" | "datetime" | "time" | "tags" | "custom" | "none"`. `toEditorText` and `fromEditorText` turn a value into an editor's starting text and back — cents edited as dollars, timestamps in the table's zone — and `fromEditorText` returns the shape of the value it replaces. `placePopup` puts a popup below an anchor, or above it when there is no room, inside the viewport.

### Sorting and header search

`resolveSorting(sortable)` · `canResetSort(sort, sorting)` · `sortsEqual(a, b)` · `sortLevels(sort, columns)` · `sortPriority(sort, key)` · `resolveHeaderSearch(headerSearch)` · `HEADER_SEARCH_DEBOUNCE`

What the adapters use to read the `sortable` and `headerSearch` options the same way, for anyone binding their own renderer. `sortLevels` is the part of the sort the visible columns can speak for — a level on a hidden or unsortable column, or a column named twice in a link, does not order the rows and is left out — and `sortPriority` is a column's place in those levels, counted from one, and `undefined` when it is the only one.

### Pipeline

`getRows(options)` — with `getParentId`, families instead of rows, and `info` per row; with `reveal`, the page a row is on, reported as `page` · `sortRows` · `searchRows` · `filterRows` · `pageCount` · `resolveRowId` · `matchesFilter` · `isFilterUsable` · `normaliseFilter` · `rangeFilter(key, low, high)` · `isTextOperator` · `TEXT_OPERATORS` · `filterInputType(column, operator)`

`createPipelineCache()` · `warmSearch(rows, columns, types, format, from?, budgetMs?)` · `warmSearchWhenIdle(rows, columns, types, format)` · `WARM_SEARCH_FROM` · `foldText(text)`

Pass one `createPipelineCache()` per table as `getRows({ …, cache })` and each stage — filter, search, sort — is remembered until something it reads changes, so a page turn or a selection runs none of them. Rows are recognised by the identity of the array: replace it to change the data. `warmSearch` builds rows' search text ahead of a search, a slice at a time, and returns how far it got; `warmSearchWhenIdle` does the whole job in idle callbacks and returns a function that stops it (the adapters call it for a table with a search box over `WARM_SEARCH_FROM`, 2,000, rows). `foldText` is the folding every text comparison uses: lower case, no accents, ordinary spaces.

`matchesFilter` answers `true` for an incomplete filter — one that asks nothing excludes nothing. Drop those with `isFilterUsable` before combining conditions yourself, or a half-typed filter will widen an OR to everything.

The text operators — `contains`, `notContains`, `startsWith`, `endsWith` — are answered from the stored value written out and from the text the column's type shows for it, so `matchesFilter(value, { operator: "contains", value: "Aug" }, dateType, format)` is true of a date in August. Pass the same `format` the table was given, or a server and a browser will disagree about what a cell says.

`filterInputType` says what kind of box a filter's value is typed into — `"text"`, `"number"`, `"date"` or `"time"` — for anyone drawing their own filter control: text for the text operators and the ones that take a list, a date picker for a `date` filter, a number box for a `range` filter, and a time picker for a `range` filter on a `time` column.

`rangeFilter` is what a range control's two boxes mean: `between` when both are filled, `gte` or `lte` when one is, and no filter at all — `undefined` — when neither is.

`normaliseFilter` puts a filter's value into the shape its operator implies: a list for `in`, `notIn` and `between`, a single value for the rest, and none at all for `empty` and `notEmpty`. Every state transition applies it, which is what keeps state and its URL identical.

### Columns

`resolveColumns(options)` · `moveColumn(keys, key, direction)` · `reorderColumn(keys, key, toIndex)` · `reorderColumnTo(keys, dragged, target, "before" | "after")` · `pruneState(state, keys)` · `inferColumns(rows, options?)` · `inferType(key, values, { partial? })` · `distinctValues(values, limit?)`

### Types

`defineType(type)` · `createTypeRegistry(custom?)` · `defaultTypeRegistry` · `BUILT_IN_TYPES` · `TYPE_ALIASES` · `formatWithType` · `compareWithType`

### Formatting

`DEFAULT_FORMAT` · `formatNumber` · `formatCurrency` · `formatPercent` · `formatDate` · `formatDateTime` · `formatTime` · `formatRelativeTime` · `minorUnitScale` · `optionLabel` · `toBoolean` · `toDate` · `toNumber` · `toText` · `isDateOnly`

### URL

`stateToSearchParams(state, options?, into?)` · `stateToQueryString` · `stateFromSearchParams` · `stateFromUrl` · `pickUrlState(state, options?)` · `applyStateToUrl(url, state, options?)` · `encodeFilters` · `decodeFilters` · `URL_KEYS` · `DEFAULT_URL_KEYS`

`UrlOptions` — `{ include?: UrlStateKey[], prefix?: string, defaults?: Partial<TableState> }`. `UrlStateKey` is `sort` · `filters` · `match` · `search` · `page` · `pageSize` · `columns` · `pinned` · `density` · `selection` · `widths` · `expanded` · `collapsed` · `focus`; the last five are left out unless named in `include`. `collapsed` is written `fold=`, `focus` `at=rowId:key`. `defaults` are the table's own resting values where they differ from the library's — a page size of fifteen, say — and must be passed to every read and write so the two agree.

`pickUrlState` returns the keys the URL carries, with defaults filled in — what to pass as a controlled `state` when the URL is the source of truth, so selection and widths stay with the table.

### Export

A CSV is read by a spreadsheet, not by a person looking at a page, so money and numbers are written as numbers and dates as ISO — a column of amounts adds up, a column of dates sorts. Labels stay readable: a `select` exports "Professional", not "pro". Override per column with `exportValue`, or per type with `TypeDef.exportValue`.

`toCsv(rows, options)` · `toDelimitedText` · `exportCell` · `cellDisplayText(row, column, { types, format, rowId?, rowIndex? })` — the text a cell shows, `""` when empty · `downloadText(text, filename, mimeType?)` · `copyText(text)`

### Effects

`poof({ x, y, size?, theme? })` — the puff of smoke shown where a column was dragged out. Does nothing where there is no document, and nothing for anyone who has asked for reduced motion.

### Store

`createStore(initial)` · `createTableStore(initial?)` — a subscribable state container for adapters that are not React.

### Icons

`ICONS` · `iconPath(name)` — path data on a 16×16 grid, stroked in `currentColor`.

### Utilities

`isEmpty` · `humanise` · `getPath` · `compareUnknown` · `textIncludes` · `textEquals` · `textStartsWith` · `textEndsWith` · `createTextMatcher(query)` · `createTextTest(mode, query)` · `clamp` · `shallowEqual` · `toSelectOptions` — turns a loose list of choices, where a plain string stands for `{ value }`, into `SelectOption[]`.
