/**
 * @trapezium/svelte
 *
 * ```svelte
 * <script>
 *   import { Table } from "@trapezium/svelte"
 *   import "@trapezium/svelte/styles.css"
 * </script>
 *
 * <Table data={users} search selection="multiple" />
 * ```
 */

export { default as Table } from "./Table.svelte"
export { trapezium } from "./action.js"

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
  stateFromSearchParams,
  stateFromUrl,
  stateToQueryString,
  stateToSearchParams,
  toCsv,
  copyText,
  downloadText,
} from "@trapezium/core"

export type { TableInstance, TableOptions, VanillaColumn as SvelteColumn } from "@trapezium/vanilla"
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
  SelectOption,
  Sort,
  TableState,
  TypeDef,
} from "@trapezium/core"
