/**
 * @trapezium/vue
 *
 * ```vue
 * <script setup>
 * import { TrapeziumTable } from "@trapezium/vue"
 * import "@trapezium/vue/styles.css"
 * </script>
 *
 * <template>
 *   <TrapeziumTable :data="users" search selection />
 * </template>
 * ```
 */

export { Table, Table as TrapeziumTable } from "./table.js"
export { renderToString } from "@trapezium/vanilla"
export type { VueColumn } from "./table.js"

export {
  DEFAULT_FORMAT,
  DEFAULT_STATE,
  addSort,
  applyStateToUrl,
  clearSort,
  columnSearchText,
  createState,
  createTypeRegistry,
  defineType,
  distinctValues,
  inferColumns,
  inferType,
  pickUrlState,
  removeSort,
  resetSort,
  setColumnSearch,
  stateFromSearchParams,
  stateFromUrl,
  stateToQueryString,
  stateToSearchParams,
  toCsv,
  toggleSort,
  copyText,
  downloadText,
} from "@trapezium/core"

export type {
  Align,
  AnyRow,
  CellContext,
  ColumnDef,
  ColumnFilter,
  Density,
  FilterKind,
  FilterOperator,
  FormatContext,
  HeaderSearchOptions,
  PaginationOptions,
  PartialTableState,
  RowHeight,
  SelectOption,
  SelectionInput,
  SelectionOptions,
  Sort,
  SortOptions,
  TableSlots,
  TableState,
  TypeDef,
  UrlOptions,
} from "@trapezium/core"
