/**
 * The published types for the package entry.
 *
 * Hand-written for one reason: the entry re-exports a `.svelte` component, and
 * generating a declaration for that needs the Svelte language tooling inside
 * the TypeScript program. Copied to `dist/index.d.ts` at build time.
 */
import type { Component } from "svelte"
import type { TableOptions } from "@trapezium/vanilla"
import type { AnyRow, TableState } from "@trapezium/core"

export type TableProps<TRow extends AnyRow = AnyRow> = TableOptions<TRow> & {
  /** Bindable. The table writes its state here whenever anything changes. */
  tableState?: TableState
}

/**
 * The table.
 *
 * ```svelte
 * <Table data={users} search selection="multiple" bind:tableState />
 * ```
 */
export declare const Table: Component<TableProps>

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
