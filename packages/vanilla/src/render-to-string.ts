import type { AnyRow } from "@trapezium/core"

import { withDocument } from "./dom.js"
import { ServerDocument } from "./server-dom.js"
import { createTable, type TableOptions } from "./table.js"

/**
 * The table as HTML, for a server.
 *
 * The same renderer that builds the live table builds this — against a small
 * in-memory document instead of the page — so the markup is byte for byte
 * what `createTable` produces for the same options. Put it in the page where
 * the table will go; `createTable` on that element replaces it in place, and
 * nothing moves.
 *
 * ```ts
 * const html = renderToString({ data: rows, state: stateFromUrl(url.search) })
 * ```
 *
 * A server has no DOM nodes, so the slots — `toolbar`, `appendRow`, `footer`,
 * `emptyState` — are written when they are strings and left out when they are
 * nodes; a cell renderer likewise must return a string here. Nothing is
 * measured, so a frozen column is written at the offset it has before anyone
 * scrolls, and the live table measures for itself on mount.
 */
export function renderToString<TRow extends AnyRow>(options: TableOptions<TRow>): string {
  const doc = new ServerDocument()

  return withDocument(doc as unknown as Document, () => {
    const host = doc.createElement("div")
    const table = createTable(host as unknown as HTMLElement, serialisable(options))
    const html = host.innerHTML
    table.destroy()
    return html
  })
}

/** The options with everything a server cannot render taken out. */
function serialisable<TRow extends AnyRow>(options: TableOptions<TRow>): TableOptions<TRow> {
  const copy = { ...options }
  for (const slot of ["toolbar", "appendRow", "footer", "emptyState"] as const) {
    if (copy[slot] !== undefined && typeof copy[slot] !== "string") delete copy[slot]
  }
  return copy
}
