import { stateFromUrl } from "@trapezium/core"

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
  const state = stateFromUrl(await searchParams)
  const { rows, total } = await getInvoices(state)

  return (
    <main>
      <header>
        <h1>Invoices</h1>
        <p>
          Server-rendered, {total.toLocaleString()} rows behind it, and every control writes to the
          URL. Sort a column and look at the address bar — then reload, or press back.
        </p>
      </header>

      <InvoiceTable rows={rows} total={total} state={state} />
    </main>
  )
}
