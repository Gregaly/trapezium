# Getting started

## Install

```sh
npm install @trapezium/react
```

Then import the stylesheet once, anywhere in your app — a layout, an entry file, a global CSS file:

```ts
import "@trapezium/react/styles.css"
```

## Your first table

```tsx
import { Table } from "@trapezium/react"

const users = [
  { id: 1, name: "Ada Lovelace", email: "ada@example.com", joined: "2026-01-15", active: true },
  { id: 2, name: "Tom Kerrigan", email: "tom@example.com", joined: "2026-03-02", active: false },
]

export function Users() {
  return <Table data={users} />
}
```

You get a column per field, headers written the way a person would write them, dates formatted, the checkbox column rendered as a tick, sortable headers, and pagination once there are enough rows.

## Choosing and naming columns

Pass keys to choose and order them:

```tsx
<Table data={users} columns={["name", "email", "joined"]} />
```

Pass objects when you have something to say:

```tsx
<Table
  data={users}
  columns={[
    { key: "name", header: "Full name" },
    { key: "email" },
    { key: "joined", header: "Member since", type: "relativeTime" },
  ]}
/>
```

## Switching things on

Features are off until you ask, so a table you have not configured has no chrome you did not want:

```tsx
<Table
  data={users}
  search                                    // a search box across every column
  selection                                 // checkboxes, with shift-click ranges
  export                                    // CSV download and clipboard copy
  pagination={{ mode: "pages", pageSize: 50 }}
/>
```

Sorting, per-column filters, the column menu and the "Columns" control are **on** by default. Turn them off with `sortable={false}`, `filters={false}`, `columnMenu={false}` and `columnControl={false}`.

## Row identity

Selection, React keys and expansion all need to know which row is which. Trapezium uses `row.id`, then `row.uuid`, then the array index — and the index stops being right the moment the data is sorted. If your rows have their own id under another name, say so:

```tsx
<Table data={invoices} getRowId={(invoice) => invoice.invoice_number} />
```

## Locale, timezone and currency

Formatting defaults are deliberately fixed rather than taken from the runtime, so a server in UTC and a browser in Sydney render the same string. Set them once per table:

```tsx
<Table
  data={invoices}
  format={{ locale: "en-AU", timeZone: "Australia/Sydney", currency: "AUD" }}
/>
```

If your money is stored in cents — and it should be — add `currencyInMinorUnits: true`.

## Other frameworks

The API is the same everywhere; only the syntax changes.

### Vue

```vue
<script setup>
import { TrapeziumTable } from "@trapezium/vue"
import "@trapezium/vue/styles.css"

const users = [/* … */]
</script>

<template>
  <TrapeziumTable :data="users" search selection />
</template>
```

### Svelte

```svelte
<script>
  import { Table } from "@trapezium/svelte"
  import "@trapezium/svelte/styles.css"

  let users = [/* … */]
</script>

<Table data={users} search selection />
```

### Plain JavaScript

```html
<div id="table"></div>
<link rel="stylesheet" href="https://unpkg.com/@trapezium/vanilla/styles.css" />
<script type="module">
  import { createTable } from "https://unpkg.com/@trapezium/vanilla?module"

  const table = createTable(document.querySelector("#table"), {
    data: users,
    search: true,
    selection: "multiple",
  })

  // Later
  table.setData(nextUsers)
  table.destroy()
</script>
```

### Anything else

`@trapezium/core` is the whole engine with no renderer: the column model, the type registry, and pure functions for filtering, sorting, paginating and serialising state. See [the API reference](api.md#core).

## Next

- [Columns](columns.md) — everything a column can do
- [Styling](styling.md) — making it match your app
- [Server-side data](server-data.md) — when the database does the work
