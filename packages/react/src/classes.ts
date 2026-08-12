import type { TableSlots } from "./types.js"

/**
 * Class names, and how a caller takes them over.
 *
 * Two rules, and they are the whole styling contract:
 *
 * - a class passed for a slot is *added* to the default, so overriding one
 *   thing does not cost you the rest;
 * - `unstyled` drops the defaults entirely, for anyone who wants their own
 *   design system to be the only thing on the element.
 */
export type ClassResolver = (slot: keyof TableSlots, extra?: string) => string

const DEFAULTS: Record<keyof TableSlots, string> = {
  root: "tpz",
  frame: "tpz-frame",
  toolbar: "tpz-toolbar",
  search: "tpz-search",
  scroll: "tpz-scroll",
  table: "tpz-table",
  thead: "tpz-thead",
  tbody: "tpz-tbody",
  headerRow: "tpz-tr",
  headerCell: "tpz-th",
  row: "tpz-tr",
  cell: "tpz-td",
  selectCell: "tpz-td tpz-select-cell",
  pagination: "tpz-pagination",
  empty: "tpz-state",
  loading: "tpz-state",
  footer: "tpz-footer",
}

export function createClasses(
  overrides: Partial<TableSlots> | undefined,
  unstyled: boolean | undefined,
): ClassResolver {
  return (slot, extra) =>
    cx(unstyled ? undefined : DEFAULTS[slot], overrides?.[slot], extra)
}

/** Joins class names, skipping the empty ones. Nothing more clever than that. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ")
}
