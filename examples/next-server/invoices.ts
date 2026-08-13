import type { TableState } from "@trapezium/core"
import { matchesFilter, isFilterUsable, BUILT_IN_TYPES } from "@trapezium/core"

/**
 * Stands in for a database.
 *
 * The point of this example is the *seam*: a page reads table state out of the
 * URL, asks for one page of rows, and the table renders exactly what it is
 * given. Whether the other side of that seam is Postgres or an array in memory
 * changes nothing above it — so it is an array, and the file stays readable.
 */

export type Invoice = {
  id: string
  reference: string
  customer: string
  email: string
  amount: number
  status: string
  issued_at: string
  due_date: string
  paid: boolean
}

export const STATUS_OPTIONS = [
  { value: "paid", label: "Paid", colour: "#3f6b4a" },
  { value: "sent", label: "Sent", colour: "#6a2e46" },
  { value: "overdue", label: "Overdue", colour: "#97362b" },
  { value: "draft", label: "Draft", colour: "#9a8f80" },
]

const NAMES = [
  "Ada Lovelace", "Tom Kerrigan", "Zoe Marchetti", "Bea Whitlock", "Idris Nasser",
  "June Okafor", "Marcus Bell", "Priya Raman", "Sven Halvorsen", "Wren Ashby",
  "Clara Boyd", "Hugo Fontaine", "Nadia Petrov", "Omar Haddad", "Ruth Kelleher",
]

/** Deterministic, so a server render and a reload agree. */
function pseudoRandom(seed: number): () => number {
  let value = seed
  return () => {
    value = (value * 1_664_525 + 1_013_904_223) % 4_294_967_296
    return value / 4_294_967_296
  }
}

const INVOICES: Invoice[] = (() => {
  const random = pseudoRandom(11)
  const start = Date.UTC(2026, 0, 1)

  return Array.from({ length: 480 }, (_, index) => {
    const customer = NAMES[Math.floor(random() * NAMES.length)] ?? "Ada Lovelace"
    const issued = new Date(start + Math.floor(random() * 220) * 86_400_000)
    const status = STATUS_OPTIONS[Math.floor(random() * STATUS_OPTIONS.length)]?.value ?? "draft"

    return {
      id: `inv_${String(index + 1).padStart(4, "0")}`,
      reference: `INV-${String(2026000 + index)}`,
      customer,
      email: `${customer.split(" ")[0]?.toLowerCase() ?? "x"}@example.com`,
      amount: Math.round((random() * 4800 + 120) * 100) / 100,
      status,
      issued_at: issued.toISOString(),
      due_date: new Date(issued.getTime() + 14 * 86_400_000).toISOString().slice(0, 10),
      paid: status === "paid",
    }
  })
})()

/**
 * One page of rows for the state the user asked for.
 *
 * In a real application this is a SQL query. The filter semantics come from the
 * core rather than being reimplemented here, which is the point:
 * `matchesFilter` is the same function the client-side table would have used,
 * so "is between", "is any of" and a date meaning a whole day behave the same
 * on both sides of the network.
 */
export async function getInvoices(
  state: TableState,
  options: { accumulate?: boolean } = {},
): Promise<{ rows: Invoice[]; total: number }> {
  // A little latency, so the loading state is visible in the example.
  await new Promise((resolve) => setTimeout(resolve, 120))

  const search = state.search.trim().toLowerCase()

  /*
    Half-typed filters are dropped, exactly as the client drops them. Keeping
    one means it matches everything, which under "any" widens the result to the
    whole table rather than being ignored.
  */
  const conditions = state.filters.filter(isFilterUsable)

  const matched = INVOICES.filter((invoice) => {
    const passes = conditions.map((filter) => {
      const value = invoice[filter.key as keyof Invoice]
      const type = BUILT_IN_TYPES[typeOf(filter.key)] ?? BUILT_IN_TYPES["text"]!
      return matchesFilter(value, filter, type, { locale: "en", timeZone: "UTC", currency: "AUD", currencyInMinorUnits: false, emptyText: "—" })
    })

    const filtered = state.match === "any" ? passes.some(Boolean) : passes.every(Boolean)
    if (!filtered) return false

    if (!search) return true
    return [invoice.reference, invoice.customer, invoice.email, invoice.status].some((field) =>
      field.toLowerCase().includes(search),
    )
  })

  const sorted = [...matched].sort((a, b) => {
    for (const level of state.sort) {
      const key = level.key as keyof Invoice
      const left = a[key]
      const right = b[key]
      const comparison =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right))

      if (comparison !== 0) return level.direction === "asc" ? comparison : -comparison
    }
    return 0
  })

  /*
    "Load more" and infinite scrolling show every page loaded so far, so the
    query returns all of them rather than just the last. Doing it here, instead
    of accumulating in the browser, is what keeps a shared link honest: the URL
    still describes exactly what the recipient will see.
  */
  const from = options.accumulate ? 0 : (state.page - 1) * state.pageSize

  return { rows: sorted.slice(from, state.page * state.pageSize), total: sorted.length }
}

function typeOf(key: string): string {
  if (key === "amount") return "number"
  if (key === "issued_at") return "datetime"
  if (key === "due_date") return "date"
  if (key === "paid") return "boolean"
  return "text"
}
