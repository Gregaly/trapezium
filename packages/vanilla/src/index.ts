/**
 * @trapezium/vanilla
 *
 * ```js
 * import { createTable } from "@trapezium/vanilla"
 * import "@trapezium/vanilla/styles.css"
 *
 * const table = createTable("#people", { data: users, search: true, selection: "multiple" })
 * ```
 *
 * The same model and the same markup as every other adapter, built with plain
 * DOM. Also the build that runs from a script tag with no bundler at all.
 */

export { createTable, pageWindow } from "./table.js"
export { renderToString, renderToTree } from "./render-to-string.js"
export { ServerDocument, ServerElement, ServerNode, ServerText } from "./server-dom.js"
export type { TableInstance, TableOptions, VanillaColumn } from "./table.js"
export { el, icon, fill, ICONS } from "./dom.js"
export { openMenuAt, closeMenu, menuItem, menuLink, menuLabel, menuSeparator } from "./menu.js"
export type { MenuOptions } from "./menu.js"

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
  ColumnDef,
  ColumnFilter,
  Density,
  FilterKind,
  FilterOperator,
  FormatContext,
  HeaderSearchOptions,
  PaginationOptions,
  PartialTableState,
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
