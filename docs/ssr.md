# Server rendering and URL state

## It just works

`<Table>` renders completely on a server: the rows are filtered, sorted and paged in the markup itself, not corrected by an effect after the page paints. There is no layout shift, no flash of unsorted rows, and no data-dependent hydration mismatch.

Three details make that true, and they are worth knowing if you extend the library:

- Formatting defaults are fixed rather than read from the runtime, so a server in UTC and a browser in Sydney produce the same string.
- Nothing is measured or random during render. Element ids come from React's `useId`; frozen-column offsets are measured after hydration and applied then.
- The card layout is a CSS container query, not a measured breakpoint.

In the Next.js App Router the table is a client component (it has to be — it has state), which still renders on the server. Nothing special is required.

## Putting the state in the URL

This is what makes a view shareable, the back button work, and a server-rendered table correct on its first paint.

```tsx
import { stateFromUrl, stateToQueryString } from "@trapezium/react"
```

### Reading it on the server

```tsx
// app/invoices/page.tsx
import { stateFromUrl } from "@trapezium/core"

export default async function Page({ searchParams }) {
  const state = stateFromUrl(await searchParams)
  const { rows, total } = await getInvoices(state)

  return <InvoiceTable rows={rows} total={total} state={state} />
}
```

### Writing it from the client

```tsx
"use client"
import { useRouter, usePathname } from "next/navigation"
import { Table, stateToQueryString } from "@trapezium/react"

export function InvoiceTable({ rows, total, state }) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <Table
      data={rows}
      total={total}
      server
      state={state}
      onStateChange={(next) => router.push(`${pathname}?${stateToQueryString(next)}`)}
      columns={columns}
    />
  )
}
```

The query string it produces is short and readable, because only what differs from the defaults is written:

```
?sort=amount:desc&f=status:in:overdue,sent&q=ada&page=3
```

### Two tables on one page

```tsx
stateToQueryString(state, { prefix: "b_" })
stateFromUrl(searchParams, { prefix: "b_" })
```

### Choosing what travels

Selection and column widths are left out by default — a selection means nothing to whoever receives the link, and a dragged width is a local preference. Opt in, or opt out:

```tsx
stateToQueryString(state, { include: ["sort", "filters", "search", "page"] })
```

## A table with no JavaScript

Give the table `buildHref` and every control renders as a link instead of a button. Sorting, filtering, paging and hiding columns then work by navigation — on a server-rendered page, with the client bundle never loaded.

```tsx
<Table
  data={rows}
  total={total}
  server
  state={state}
  buildHref={(next) => `/invoices?${stateToQueryString(next)}`}
  linkComponent={Link}
  columns={columns}
/>
```

The menus still need JavaScript to open, so this is progressive enhancement rather than a no-JS-only mode: the header sorts, the pagination pages, and everything else improves once the bundle arrives.

## Saved views

Because the whole arrangement is one serialisable object, "save this view" is `JSON.stringify(state)` and "load it" is passing it back as `state` or `defaultState`. There is no separate feature to learn.

```tsx
await saveView({ name: "Overdue, biggest first", config: state })
<Table data={rows} defaultState={view.config} />
```
