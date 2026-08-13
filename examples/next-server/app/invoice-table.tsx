"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import Link from "next/link"
import { Table, applyStateToUrl, type Column, type TableState } from "@trapezium/react"

import { STATUS_OPTIONS, type Invoice } from "../invoices"

/**
 * The client half.
 *
 * It holds no data and no copy of the state: the server owns both. All it does
 * is turn a change into a URL, which is what makes the back button, a shared
 * link and a page reload all land on exactly the same view.
 *
 * `useTransition` keeps the current rows on screen, dimmed, while the next page
 * is fetched — rather than blanking the table on every click.
 */

export type PaginationMode = "pages" | "simple" | "loadMore" | "infinite"

export type View = {
  mode: PaginationMode
  setFilters: boolean
  cards: boolean
}

export function InvoiceTable({
  rows,
  total,
  state,
  view,
}: {
  rows: Invoice[]
  total: number
  state: TableState
  view: View
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  /*
    The demo's switches are part of the URL too, so every link this component
    builds has to carry them. `applyStateToUrl` merges the table's state into a
    URL that already has parameters rather than replacing the query string,
    which is exactly what a page with its own state needs.
  */
  const base = `/?${new URLSearchParams({
    mode: view.mode,
    ...(view.setFilters ? { setf: "1" } : {}),
    ...(view.cards ? { cards: "1" } : {}),
  }).toString()}`

  const href = (next: TableState) => applyStateToUrl(base, next)

  const go = (url: string) => startTransition(() => router.push(url, { scroll: false }))

  /** Changing a switch starts the view again from page one. */
  const setView = (change: Partial<View>) => {
    const merged = { ...view, ...change }
    const params = new URLSearchParams({
      mode: merged.mode,
      ...(merged.setFilters ? { setf: "1" } : {}),
      ...(merged.cards ? { cards: "1" } : {}),
    })
    go(applyStateToUrl(`/?${params.toString()}`, { ...state, page: 1 }))
  }

  const columns: Column<Invoice>[] = [
    { key: "reference", header: "Invoice", type: "id", pin: "start" },
    { key: "customer", filter: view.setFilters ? "set" : true },
    { key: "email" },
    { key: "amount", type: "currency", filter: view.setFilters ? "set" : "range" },
    {
      key: "status",
      type: "badge",
      // The choices come from the server, not from the page of rows on screen:
      // a set filter built from one page would only ever offer what that page
      // happened to contain.
      formatOptions: { options: STATUS_OPTIONS },
      filter: { kind: "set", options: STATUS_OPTIONS },
    },
    { key: "issued_at", header: "Issued", type: "datetime" },
    { key: "due_date", header: "Due", type: "date" },
    { key: "paid", type: "boolean" },
  ]

  return (
    <>
      <div className="controls">
        <div className="segmented">
          <span className="segmented-label">Pagination</span>
          <div className="segmented-options" role="group" aria-label="Pagination">
            {(
              [
                ["pages", "Pages"],
                ["simple", "Prev / next"],
                ["loadMore", "Load more"],
                ["infinite", "Infinite"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                data-active={view.mode === mode}
                aria-pressed={view.mode === mode}
                onClick={() => setView({ mode })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="switch">
          <input
            type="checkbox"
            checked={view.setFilters}
            onChange={(event) => setView({ setFilters: event.target.checked })}
          />
          <span className="switch-track" aria-hidden="true" />
          <span>Set filters</span>
        </label>

        <label className="switch">
          <input
            type="checkbox"
            checked={view.cards}
            onChange={(event) => setView({ cards: event.target.checked })}
          />
          <span className="switch-track" aria-hidden="true" />
          <span>Card layout</span>
        </label>
      </div>

      <Table
        data={rows}
        total={total}
        server
        loading={pending}
        state={state}
        onStateChange={(next) => go(href(next))}
        // Every control is also a real link, so the table sorts, filters and
        // pages before the client bundle has loaded — and keyboard and
        // middle-click behave the way they do everywhere else on the web.
        buildHref={href}
        linkComponent={Link}
        getRowId={(invoice) => invoice.id}
        columns={columns}
        search={{ placeholder: "Search invoices", debounce: 300 }}
        selection
        export
        pagination={{ mode: view.mode, pageSize: 25, pageSizeOptions: [10, 25, 50, 100] }}
        responsive={view.cards ? "cards" : "scroll"}
        format={{ currency: "AUD", locale: "en-AU", timeZone: "Australia/Sydney" }}
        maxHeight={560}
        aria-label="Invoices"
      />
    </>
  )
}
