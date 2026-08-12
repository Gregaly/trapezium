# Custom rendering

Two properties, and the difference between them matters:

- **`format`** replaces the cell's *text*. Sorting, filtering, search and export still use the raw value, so a formatted column keeps behaving correctly.
- **`render`** replaces the cell's *markup*. Use it when the result is not text.

```tsx
{ key: "amount", format: ({ value }) => `${value} credits` }
{ key: "user", render: ({ row }) => <Avatar user={row.user} /> }
```

## What a renderer receives

```ts
{
  value,       // the raw value, exactly as it came off the row
  row,         // the whole row
  rowIndex,    // position among the rendered rows
  rowId,       // the row's stable id
  column,      // the resolved column, defaults and all
  text,        // the value already formatted, so you can decorate rather than reimplement
  format,      // locale, timezone, currency, emptyText
}
```

`text` is the useful one. Most custom cells are the default text with something around it:

```tsx
{
  key: "due_date",
  type: "date",
  render: ({ value, text }) => (
    <span className={new Date(value) < new Date() ? "overdue" : undefined}>{text}</span>
  ),
}
```

## Actions

```tsx
{
  key: "actions",
  header: "",
  sortable: false,
  filter: false,
  exportable: false,
  width: 90,
  render: ({ row }) => (
    <button onClick={(event) => { event.stopPropagation(); open(row.id) }}>Open</button>
  ),
}
```

`stopPropagation` matters when the row itself is clickable — otherwise the button and the row both fire.

## Links

Rows link with `rowHref`, which turns the leading cell into an anchor:

```tsx
<Table data={rows} rowHref={(row) => `/invoices/${row.id}`} />
```

Trapezium never imports a router. To use your framework's link component — for client-side navigation and prefetching — hand it over:

```tsx
import Link from "next/link"

<Table data={rows} rowHref={(row) => `/invoices/${row.id}`} linkComponent={Link} />
```

`linkComponent` is used for every link the table generates, including [URL-driven controls](ssr.md).

## Whole rows

```tsx
<Table
  data={rows}
  onRowClick={(row) => select(row)}
  rowClassName={(row) => row.overdue ? "row-overdue" : undefined}
/>
```

## Headers

```tsx
{ key: "amount", renderHeader: ({ column, sort }) => <>{column.header} {sort ? "↓" : null}</> }
```

The sort and filter controls are yours to place when you take this over.

## Around the table

```tsx
<Table
  data={rows}
  caption="Invoices raised this quarter"
  toolbar={<button onClick={create}>New invoice</button>}
  appendRow={<button onClick={create}>Add another</button>}
  footer={<Totals rows={rows} />}
  emptyState={<Nothing message="No invoices yet" onCreate={create} />}
  loading={isLoading}
  error={error?.message}
/>
```

`appendRow` is the "add one more" affordance at the bottom of the table — a slot rather than a feature, so it can be a link, a form, or a total.

## Rendering everything yourself

`useTable` is the whole model with no markup: rows, columns, state and the actions that change it. Use it when you want Trapezium's engine and your own DOM.

```tsx
import { useTable } from "@trapezium/react"

function MyGrid({ data }) {
  const { rows, columns, state, update, total } = useTable({ data, search: true })
  // …your own markup
}
```
