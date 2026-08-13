"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import Link from "next/link"
import { Table, stateToQueryString, type Column, type TableState } from "@trapezium/react"

import { STATUS_OPTIONS, type Invoice } from "../invoices"

/**
 * The client half.
 *
 * It holds no data and no copy of the state: the server owns both. All it does
 * is turn a state change into a URL, which is what makes the back button, a
 * shared link and a page reload all land on exactly the same view.
 *
 * `useTransition` keeps the current rows on screen, dimmed, while the next page
 * is fetched — rather than blanking the table on every click.
 */
export function InvoiceTable({
  rows,
  total,
  state,
}: {
  rows: Invoice[]
  total: number
  state: TableState
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  /*
    What the switches change. They are client state rather than URL state
    because they are a property of this demo, not of the view being shared —
    the point is to try the props, not to send someone a link to them.
  */
  const [mode, setMode] = useState<"pages" | "simple" | "loadMore" | "infinite">("pages")
  const [setFilters, setSetFilters] = useState(false)
  const [cards, setCards] = useState(false)

  const columns: Column<Invoice>[] = [
    { key: "reference", header: "Invoice", type: "id", pin: "start" },
    { key: "customer", filter: setFilters ? "set" : true },
    { key: "email" },
    { key: "amount", type: "currency", filter: setFilters ? "set" : "range" },
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
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                data-active={mode === value}
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="switch">
          <input
            type="checkbox"
            checked={setFilters}
            onChange={(event) => setSetFilters(event.target.checked)}
          />
          <span className="switch-track" aria-hidden="true" />
          <span>Set filters</span>
        </label>

        <label className="switch">
          <input type="checkbox" checked={cards} onChange={(event) => setCards(event.target.checked)} />
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
        onStateChange={(next) => {
        startTransition(() => router.push(`/?${toQuery(next)}`, { scroll: false }))
      }}
        // Every control is also a real link, so the table sorts, filters and pages
        // before the client bundle has loaded — and keyboard and middle-click
        // behave the way they do everywhere else on the web.
        buildHref={(next) => `/?${toQuery(next)}`}
        linkComponent={Link}
        getRowId={(invoice) => invoice.id}
        columns={columns}
        search={{ placeholder: "Search invoices", debounce: 300 }}
      selection
      export
        pagination={{ mode, pageSize: 25, pageSizeOptions: [10, 25, 50, 100] }}
        responsive={cards ? "cards" : "scroll"}
        format={{ currency: "AUD", locale: "en-AU", timeZone: "Australia/Sydney" }}
        maxHeight={560}
        aria-label="Invoices"
      />
    </>
  )
}

function toQuery(state: TableState): string {
  // Imported from the table package so there is one encoding, shared by the
  // client that writes it and the server that reads it.
  return stateToQueryString(state)
}
