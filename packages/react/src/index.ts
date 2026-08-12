/**
 * @trapezium/react
 *
 * ```tsx
 * import { Table } from "@trapezium/react"
 * import "@trapezium/react/styles.css"
 *
 * export function People({ users }) {
 *   return <Table data={users} />
 * }
 * ```
 *
 * Columns, types, sorting, search and pagination all come from the data. Add
 * configuration only where the default is not what you want.
 */

export { Table } from "./table.js"
export { useTable, normalisePagination } from "./use-table.js"
export type { TableInstance } from "./use-table.js"

export { Icon } from "./icon.js"
export { Menu, MenuItem, MenuLabel, MenuSeparator } from "./menu.js"
export type { MenuAlign, TriggerProps } from "./menu.js"
export { Pagination, pageNumbers } from "./pagination.js"
export { Toolbar } from "./toolbar.js"
export { FilterControl } from "./filter-control.js"
export { HeaderCell } from "./header-cell.js"
export { cellText, renderCell } from "./cell.js"
export { createClasses, cx } from "./classes.js"
export type { ClassResolver } from "./classes.js"

export type {
  Column,
  ColumnInput,
  ExportOptions,
  LinkComponent,
  SearchOptions,
  SelectionMode,
  TableCellContext,
  TableColumn,
  TableHeaderContext,
  TableProps,
  TableSelection,
  TableSlots,
} from "./types.js"

/*
  The core is re-exported so a consumer installs one package and imports one
  name. `defineType`, the state transitions and the URL codec are all part of
  using the table, not internals of it.
*/
export {
  DEFAULT_FORMAT,
  DEFAULT_STATE,
  DEFAULT_URL_KEYS,
  applyStateToUrl,
  createState,
  createTypeRegistry,
  defineType,
  distinctValues,
  formatWithType,
  inferColumns,
  inferType,
  stateFromSearchParams,
  stateFromUrl,
  stateToQueryString,
  stateToSearchParams,
  toCsv,
  copyText,
  downloadText,
} from "@trapezium/core"

export type {
  Align,
  AnyRow,
  ColumnFilter,
  Density,
  FilterKind,
  FilterOperator,
  FilterOption,
  FilterValue,
  FormatContext,
  FormatOptions,
  GetRowId,
  PaginationOptions,
  PartialTableState,
  Pin,
  SelectOption,
  Sort,
  SortDirection,
  TableState,
  TypeDef,
  TypeRegistry,
  UrlOptions,
} from "@trapezium/core"
