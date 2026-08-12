# Filtering and search

Both, independently, because they answer different questions. Search is "find me this"; a filter is "show me only these".

## Global search

```tsx
<Table data={rows} search />
<Table data={rows} search={{ placeholder: "Search invoices", debounce: 250 }} />
```

Search matches every column that is searchable, against **the formatted text as well as the raw value** — so searching "Aug" finds a date and "Yes" finds a checkbox. The words on the screen are the words people type.

It is case- and accent-insensitive: "jose" finds "José".

Exclude a column with `{ key: "internal_ref", searchable: false }`.

## Per-column filters

Every column gets the control its type deserves. Open it from the chevron in the header.

```tsx
{ key: "status", filter: "set" }      // checkbox list of the values present
{ key: "amount", filter: "range" }    // is more than, is at least, is between…
{ key: "due", filter: "date" }        // date comparisons
{ key: "paid", filter: "boolean" }    // yes / no / any
{ key: "name", filter: "text" }       // contains, starts with, is, is not…
{ key: "notes", filter: false }       // none
```

### Set filters

The checkbox list of values actually present in the data — the thing spreadsheet users reach for first and most libraries leave out. The choices are derived from the rows, ordered by how often each appears, so nothing needs configuring:

```tsx
{ key: "owner", filter: "set" }
```

Give it explicit choices when the stored value is a key and the label lives elsewhere:

```tsx
{ key: "status", type: "badge", formatOptions: { options: STATUSES }, filter: "set" }
```

Ticking several values produces an `in` filter. Ticking one produces `eq`. A `tags` column matches when *any* of a row's tags is ticked.

### Operators

Which operators a column offers comes from its type, so a checkbox is never asked whether it is greater than something.

| | |
|---|---|
| `eq` `ne` | is, is not |
| `contains` `notContains` | contains, does not contain |
| `startsWith` `endsWith` | starts with, ends with |
| `gt` `gte` `lt` `lte` | is more than, is at least, is less than, is at most |
| `between` | is between (inclusive) |
| `in` `notIn` | is any of, is none of |
| `empty` `notEmpty` | is empty, is not empty |

Narrow the list for one column:

```tsx
{ key: "reference", filter: { kind: "text", operators: ["eq", "contains"] } }
```

## Filters in code

Filters live in table state, so setting them from outside the table is setting state:

```tsx
const [state, setState] = useState({ filters: [{ key: "status", operator: "eq", value: "overdue" }] })

<Table data={rows} state={state} onStateChange={setState} />
```

The shape is `{ key, operator, value? }`. Values are compared through the column's type, so `"100"` from a URL filters a number column numerically and `"2026-08-13"` filters a timestamp column by that whole day.

Several filters combine with **and** by default. When there is more than one, the toolbar offers a match-all / match-any switch, which is `state.match`.

## Removing them

Applied filters appear as chips above the table, written as a sentence — "Status is Overdue" — with a remove button each, and a "Clear" beside them. Nothing about a filtered table is invisible: a filtered column's header icon is tinted too, so nobody wonders where their rows went.

## Filtering on the server

When your database does the work, Trapezium does not filter anything — it tells you what was asked for:

```tsx
<Table
  data={page}
  total={total}
  server
  onStateChange={(state) => refetch(state.filters, state.search, state.sort, state.page)}
/>
```

The filter model is exactly the same, so you can translate `{ key, operator, value }` into SQL once and support every column. See [Server-side data](server-data.md).

## Semantics worth knowing

- An empty cell satisfies no comparison. `is less than 10` does not match a blank, because a blank is not zero.
- `0` and `false` are **not** empty. That mistake is what makes a table show "—" for a real zero.
- `contains` on a `tags` column looks inside the array.
- A `select` column matches on both the stored value and the label, so a filter built from what the user can see works as well as one built from an id.
