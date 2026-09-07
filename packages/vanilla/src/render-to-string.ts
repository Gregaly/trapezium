import type { AnyRow, CellContext } from "@trapezium/core"

import { withDocument } from "./dom.js"
import { ServerDocument, ServerElement, ServerNode } from "./server-dom.js"
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
 * A server has no DOM. A cell renderer that builds its node with this
 * package's `el` helper works here unchanged; one that reaches for `document`
 * throws, and the cell is written as its text instead. The slots — `toolbar`,
 * `appendRow`, `footer`, `emptyState` — are written when they are strings and
 * left out when they are nodes. Nothing is measured, so a frozen column is
 * written at the offset it has before anyone scrolls, and the live table
 * measures for itself on mount.
 */
export function renderToString<TRow extends AnyRow>(options: TableOptions<TRow>): string {
  return renderToTree(options).outerHTML
}

/**
 * The table as a tree of server elements, for an adapter to turn into its own
 * nodes — the Vue adapter makes VNodes of it, so Vue renders the table on the
 * server itself, slots and components and all.
 *
 * Pass a function when the options need server elements — a slot placeholder
 * built with `el`, say: it runs against the in-memory document.
 */
export function renderToTree<TRow extends AnyRow>(
  options: TableOptions<TRow> | (() => TableOptions<TRow>),
): ServerElement {
  const doc = new ServerDocument()

  return withDocument(doc as unknown as Document, () => {
    const host = doc.createElement("div")
    const resolved = typeof options === "function" ? options() : options
    const table = createTable(host as unknown as HTMLElement, serialisable(resolved))
    const root = host.firstElementChild
    if (!root) throw new Error("Trapezium: the table rendered nothing")
    table.destroy()
    return root
  })
}

/** The options with everything a server cannot render taken out or made safe. */
function serialisable<TRow extends AnyRow>(options: TableOptions<TRow>): TableOptions<TRow> {
  const copy = { ...options }

  for (const slot of ["toolbar", "appendRow", "footer", "emptyState"] as const) {
    const value = copy[slot]
    if (value !== undefined && typeof value !== "string" && !(value instanceof ServerNode)) delete copy[slot]
  }

  copy.columns = options.columns?.map((column) => {
    if (typeof column === "string" || !column.render) return column
    const render = column.render
    return {
      ...column,
      render: (context: CellContext<TRow, Node | string>) => {
        try {
          const result = render(context)
          return typeof result === "string" || result instanceof ServerNode ? result : context.text
        } catch {
          // Most likely `document` — a renderer written for a browser. The
          // cell still has its text.
          return context.text
        }
      },
    }
  })

  return copy
}
