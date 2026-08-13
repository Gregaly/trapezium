# Columns

A column definition has one required property: `key`. Everything else has a default derived from the data or the key, and exists so that the exceptions cost one line rather than a new component.

## Four levels

```tsx
<Table data={users} />                                     // infer everything
<Table data={users} columns={["name", "email"]} />         // choose and order
<Table data={users} columns={[{ key: "name", header: "Full name" }]} />
<Table data={users} columns={[{ key: "name", render: ({ row }) => <Person {...row} /> }]} />
```

Mixing them is fine: `columns={["name", { key: "amount", type: "currency" }]}`.

## key

The row property to read:

```tsx
{ key: "email" }
```

A dotted path into it:

```tsx
{ key: "customer.name" }     // header defaults to "Name"
```

Or any unique id at all, when the value comes from somewhere else:

```tsx
{ key: "total", accessor: (row) => row.quantity * row.unit_price, type: "currency" }
{ key: "actions", header: "", render: ({ row }) => <RowMenu id={row.id} /> }
```

`key` is what state refers to, so it must be stable and unique within the table. It appears in URLs when you serialise state, so keep it readable.

## header

Defaults to the humanised key — `created_at` becomes "Created at", `firstName` becomes "First name", `id` becomes "ID". Set it when the default is wrong, or `""` for a column with no visible header (an actions column).

```tsx
{ key: "wwcc_expiry", header: "Check expires" }
```

Note that `header` is also the label the [card layout](styling.md#narrow-screens) shows beside each value, and the heading in a CSV export.

## type

Decides formatting, sorting, alignment, the filter control and the header icon. Inferred from the data when omitted — see [Types](types.md) for the full list and the inference rules.

```tsx
{ key: "amount", type: "currency" }
{ key: "opened_at", type: "relativeTime" }
{ key: "reference", type: "id" }
```

Per-column formatting options go beside it:

```tsx
{ key: "amount", type: "currency", formatOptions: { currency: "JPY" } }
{ key: "ratio", type: "percent", formatOptions: { decimals: 1 } }
{ key: "status", type: "badge", formatOptions: { options: [
  { value: "paid", label: "Paid", colour: "#3f6b4a" },
  { value: "overdue", label: "Overdue", colour: "#97362b" },
] } }
```

## accessor

Reads the value. Defaults to the key or the dotted path it describes. Use it for computed columns, or when the shape is awkward:

```tsx
{ key: "name", accessor: (row) => `${row.first_name} ${row.last_name}` }
```

The accessor's result is what gets sorted, filtered, searched and exported — so a computed column behaves like a real one.

## Sorting

Sortable by default for every type that can be ordered. Turn it off per column, or give it your own comparator:

```tsx
{ key: "notes", sortable: false }
{ key: "priority", compare: (a, b) => RANK[a] - RANK[b] }
```

Multi-level sorting is supported by the model (`state.sort` is an array) and shift-clicking a header adds a level.

Empty values always sort last, in both directions. A column of dates with a few blanks should not put the blanks first when reversed — you asked for the newest, not the missing.

## Filtering

```tsx
{ key: "status", filter: "set" }        // checkbox list of the values present
{ key: "amount", filter: "range" }      // numeric comparisons
{ key: "name", filter: "text" }         // contains, starts with, is, is not…
{ key: "notes", filter: false }         // no filter on this column
{ key: "plan", filter: { kind: "set", options: PLANS } }
```

`filter` defaults to the control the column's type deserves. See [Filtering and search](filtering.md).

## Width, alignment and wrapping

```tsx
{ key: "notes", width: 320, wrap: true }
{ key: "count", align: "end" }
{ key: "name", minWidth: 200, maxWidth: 400 }
```

Widths are in pixels. Columns are content-sized when you do not set one, within the `--tpz-col-min-width` and `--tpz-col-max-width` tokens. A width a user drags is stored in state and wins over the definition; double-clicking the resize handle forgets it.

`wrap` lets a cell take several lines instead of truncating — worth it for a notes column, ruinous for everything else.

## Moving and removing columns

Three ways to move a column, because people reach for different ones:

- **Drag the header sideways.** The whole header is the handle, and a line shows which side of the neighbour it will land on.
- **Drag a row in the column list.** Better when the column you want is scrolled off the side of the table.
- **"Move left" and "Move right"** in the column panel, which is the keyboard path.

And two ways to remove one:

- **Drag the header out of the table and let go**, which removes it with a small puff of smoke — the macOS dock gesture. The last visible column refuses, because a table of nothing has no obvious way back.
- **"Hide column"** in the panel, or the checkbox in the column list.

Everything ends up in `state.order` and `state.hidden`, so an arrangement can be saved, shared and restored like anything else. Turn the whole thing off with `reorderable={false}` on the table, or per column:

```tsx
{ key: "reference", reorderable: false }
```

Pinned columns are not draggable: pinning already decides where they go.

## Pinning and visibility

```tsx
{ key: "reference", pin: "start" }      // frozen to the left while the rest scrolls
{ key: "actions", pin: "end" }
{ key: "internal_id", hidden: true }    // available in the column menu, not shown
```

Pinned columns keep an opaque background and their own edge shadow. A user can pin and unpin from the column menu, and their choice is kept in state.

## Monospace

Data columns are monospaced by default, because a fixed advance width is what makes figures line up down the page — the same reason Tessera's tables read the way they do. Prose types (`longText`) and columns you render yourself use the interface font. Override either way:

```tsx
{ key: "name", mono: true }
{ key: "reference", mono: false }
```

## Export

```tsx
{ key: "actions", exportable: false }                        // leave it out of the CSV
{ key: "amount", exportValue: ({ value }) => String(value) } // raw, not formatted
```

## Icons and classes

```tsx
{ key: "name", icon: "text" }        // any name from the built-in icon set
{ key: "name", icon: false }         // no icon
{ key: "amount", className: "font-semibold", headerClassName: "uppercase" }
```

Class names are added to the defaults, so you keep the borders, the truncation and the sticky behaviour while changing what you came to change.

## meta

Anything you want to reach from a renderer. Trapezium never reads it.

```tsx
{ key: "amount", meta: { tone: "money" }, render: ({ column, text }) =>
  <span data-tone={column.meta.tone}>{text}</span> }
```

## Generating columns from a schema

Because a column is a plain object, columns from your own configuration are a `map`, not a feature request:

```tsx
const columns = fields.map((field) => ({
  key: field.slug,
  header: field.label,
  type: field.type,                     // snake_case type names are accepted
  filter: field.filterable,
  sortable: field.sortable,
}))

<Table data={records} columns={columns} />
```

This is the intended way to drive Trapezium from a database-defined schema, a CMS, or anything else that describes its own fields.
