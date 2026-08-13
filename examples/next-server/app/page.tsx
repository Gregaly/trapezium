import { stateFromUrl } from "@trapezium/core"

import type { PaginationMode } from "./invoice-table"

import { getInvoices } from "../invoices"
import { InvoiceTable } from "./invoice-table"

/**
 * A table whose sorting, filtering and paging happen in the database.
 *
 * Everything the user chose lives in the query string, so this page reads it,
 * asks for exactly one page of rows, and renders the finished table on the
 * server. The first paint is correct — nothing is fetched, sorted or corrected
 * after it appears — and the URL can be shared, bookmarked and gone back to.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = await searchParams
  const state = stateFromUrl(query)

  /*
    The demo's own switches live in the same query string as the table's state.
    They have to reach the server — how many rows to return depends on the
    pagination mode — and putting them here means a shared link reproduces the
    whole page, switches and all.
  */
  const view = {
    mode: asMode(query["mode"]),
    setFilters: query["setf"] === "1",
    cards: query["cards"] === "1",
  }

  const accumulate = view.mode === "loadMore" || view.mode === "infinite"
  const { rows, total } = await getInvoices(state, { accumulate })

  return (
    <main>
      <header>
        <h1>Invoices</h1>
        <p>
          Server-rendered, {total.toLocaleString()} rows behind it, and every control writes to the
          URL. Sort a column and look at the address bar — then reload, or press back.
        </p>
      </header>

      <InvoiceTable rows={rows} total={total} state={state} view={view} />
    </main>
  )
}

/** Anything unexpected in the URL means the default, never an error page. */
function asMode(value: string | string[] | undefined): PaginationMode {
  const modes: PaginationMode[] = ["pages", "simple", "loadMore", "infinite"]
  const mode = Array.isArray(value) ? value[0] : value
  return modes.find((entry) => entry === mode) ?? "pages"
}
