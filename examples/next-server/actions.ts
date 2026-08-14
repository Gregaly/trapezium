"use server"

import type { TableState } from "@trapezium/core"

import { getInvoices, INVOICE_COLUMNS, distinctInvoiceValues, type Invoice } from "./invoices"

/**
 * The two questions a server-side table cannot answer for itself.
 *
 * It holds one page, so it does not know which values a column has across the
 * whole table, nor which rows an export should contain. Both are one query on
 * this side of the seam, and passing them to `server={{ distinct, all }}` is
 * all the table needs — no per-column wiring, and nothing to forget when a
 * column is added later.
 */

/** Every value in a column, for a set filter. */
export async function distinctValues(columnKey: string): Promise<string[]> {
  // Never trust a key off the wire, even one the table sent: it is a column
  // name, and column names end up in queries.
  if (!INVOICE_COLUMNS.includes(columnKey)) return []
  return distinctInvoiceValues(columnKey)
}

/** Every row matching the current filters and search, for an export. */
export async function allMatching(state: TableState): Promise<Invoice[]> {
  const { rows } = await getInvoices({ ...state, page: 1, pageSize: Number.MAX_SAFE_INTEGER })
  return rows
}
