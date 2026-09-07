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
export type { VueColumn } from "./table.js"

export {
  DEFAULT_FORMAT,
  DEFAULT_STATE,
  applyStateToUrl,
  createState,
  createTypeRegistry,
  defineType,
  distinctValues,
  inferColumns,
  inferType,
  pickUrlState,
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
  CellContext,
  ColumnDef,
  ColumnFilter,
  Density,
  FilterKind,
  FilterOperator,
  FormatContext,
  PaginationOptions,
  PartialTableState,
  RowHeight,
  SelectOption,
  SelectionInput,
  SelectionOptions,
  Sort,
  TableSlots,
  TableState,
  TypeDef,
} from "@trapezium/core"
