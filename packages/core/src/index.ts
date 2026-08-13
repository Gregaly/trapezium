/**
 * @trapezium/core
 *
 * The engine behind every Trapezium table: the column model, the type registry,
 * and pure functions for filtering, searching, sorting, paginating, selecting
 * and serialising state.
 *
 * Nothing here touches a framework or a DOM, so it runs identically on a
 * server, in a browser, in a test, and inside whichever adapter is rendering.
 * Use it directly to bind your own renderer; use `@trapezium/react`,
 * `@trapezium/vue`, `@trapezium/svelte` or `@trapezium/vanilla` to get one.
 */

export type {
  Align,
  AnyRow,
  CellContext,
  ColumnDef,
  ColumnFilter,
  ColumnKey,
  Density,
  FilterKind,
  FilterOperator,
  FilterOption,
  FilterValue,
  FormatContext,
  FormatOptions,
  GetRowId,
  HeaderContext,
  PaginationOptions,
  PartialTableState,
  Pin,
  ResolvedColumn,
  SelectOption,
  SelectionOptions,
  Sort,
  SortDirection,
  TableRows,
  TableState,
} from "./types.js"

export {
  DEFAULT_FORMAT,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  formatTime,
  isDateOnly,
  minorUnitScale,
  optionLabel,
  resolveFormat,
  toDate,
  toNumber,
  toText,
} from "./format.js"

export {
  BUILT_IN_TYPES,
  TYPE_ALIASES,
  compareWithType,
  createTypeRegistry,
  defaultTypeRegistry,
  defineType,
  formatWithType,
} from "./registry.js"
export type { Comparable, TypeDef, TypeRegistry } from "./registry.js"

export { distinctValues, inferColumns, inferType } from "./infer.js"
export type { InferColumnsOptions } from "./infer.js"

export {
  moveColumn,
  pruneState,
  reorderColumn,
  reorderColumnTo,
  resolveColumns,
} from "./columns.js"
export type { ColumnInput, ResolveColumnsOptions, ResolvedColumns } from "./columns.js"

export {
  LIST_OPERATORS,
  OPERATOR_LABELS,
  RANGE_OPERATORS,
  VALUELESS_OPERATORS,
  filterRows,
  isFilterUsable,
  isListOperator,
  matchesFilter,
  needsValue,
  normaliseFilter,
  withFilter,
  withoutFilter,
} from "./filter.js"

export {
  getRows,
  pageCount,
  resolveRowId,
  rowsLackIds,
  searchRows,
  sortRows,
} from "./pipeline.js"
export type { PipelineOptions } from "./pipeline.js"

export {
  DEFAULT_STATE,
  addFilter,
  clearFilters,
  clearSelection,
  clearSort,
  clearWidth,
  createState,
  hideColumn,
  isFiltering,
  removeFilter,
  removeFilterAt,
  resetView,
  setDensity,
  setFilter,
  setMatch,
  setOrder,
  setPage,
  setPageSize,
  setPin,
  setSearch,
  setSelected,
  setSort,
  setWidth,
  showColumn,
  toggleColumn,
  togglePin,
  toggleSelection,
  toggleSort,
} from "./state.js"

export { createStore, createTableStore } from "./store.js"
export type { Store, TableStore } from "./store.js"

export {
  DEFAULT_URL_KEYS,
  URL_KEYS,
  applyStateToUrl,
  decodeFilters,
  encodeFilters,
  stateFromSearchParams,
  stateFromUrl,
  stateToQueryString,
  stateToSearchParams,
} from "./url.js"
export type { UrlOptions, UrlStateKey } from "./url.js"

export { copyText, downloadText, exportCell, toCsv, toDelimitedText } from "./csv.js"
export { poof } from "./effects.js"
export type { PoofOptions } from "./effects.js"
export type { ExportOptions } from "./csv.js"

export { ICONS, iconPath } from "./icons.js"
export type { IconName } from "./icons.js"

export {
  clamp,
  compareUnknown,
  createTextMatcher,
  getPath,
  humanise,
  isEmpty,
  shallowEqual,
  textEndsWith,
  textEquals,
  textIncludes,
  textStartsWith,
} from "./util.js"
