# @trapezium/react

A data table for React that looks right before you configure anything.

```tsx
import { Table } from "@trapezium/react"
import "@trapezium/react/styles.css"

export function People({ users }) {
  return <Table data={users} />
}
```

That is a complete usage: columns come from the data, types from the values, and sorting, searching and pagination work.

- Zero-config columns with type inference, and one property to override any of it
- Per-column filters — including a set filter built from the values actually present — plus global search
- Numbered, previous/next, load-more and infinite pagination
- Selection with shift-click ranges, custom renderers, CSV export, column resize, reorder and pinning
- Server-side data with one flag, and state that serialises to the URL
- Server rendering that is correct on the first paint, with optional no-JavaScript controls
- Styled with CSS variables, or take over per slot with your own classes
- No runtime dependencies — no icon library, no popover library, no date library

React 18 and 19. Next.js App Router and Pages Router, Remix, React Router, Vite, Astro.

```tsx
<Table
  data={invoices}
  getRowId={(invoice) => invoice.id}
  search
  selection
  export
  pagination={{ mode: "pages", pageSize: 25 }}
  columns={[
    { key: "reference", header: "Invoice", pin: "start" },
    { key: "customer.name", header: "Customer" },
    { key: "amount", type: "currency", filter: "range" },
    { key: "status", type: "badge" },
    { key: "actions", header: "", render: ({ row }) => <RowMenu id={row.id} /> },
  ]}
/>
```

Full documentation: [github.com/Gregaly/trapezium](https://github.com/Gregaly/trapezium#readme) · MIT
