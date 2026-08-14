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

**Pagination does not narrow the choices.** The list comes from every row the table was given, not from the page on screen — so a value that only appears on page twenty-nine is offered on page one, and ticking it brings those rows straight to the front. Applying a filter does not eat the other options either; they stay, or the filter could never be widened again.

**Nor does the length of the list hide anything.** Two hundred choices are drawn at a time, most common first, but the search box above them searches *all* of them. A value that appears once in a hundred thousand rows is one keystroke away rather than unreachable.

### Set filters with server-side data

This is the one case where the choices really are incomplete, and it is worth understanding: in [server mode](server-data.md) the table holds one page, so a set filter built from the data can only offer what that page contained. Trapezium says so in the console rather than letting you find out from a user.

The short answer is to tell the table once where the values come from, and every set-filter column uses it:

```tsx
<Table server={{ distinct: (column) => api.invoices.distinct(column) }} … />
```

It is called with a column's key the first time somebody opens that column's panel, and remembered afterwards. Return labelled choices, or plain strings where the value is the label.

Per column, when the list is already to hand:

```tsx
{
  key: "status",
  type: "badge",
  formatOptions: { options: STATUSES },
  filter: { kind: "set", options: STATUSES },
}
```

Or hand it a function, when you would rather not query for every column's values up front:

```tsx
{ key: "owner", filter: { kind: "set", options: () => api.invoices.distinct("owner") } }
```

It is called the first time that column's panel is opened, shows "Loading values…" while it works, and is remembered afterwards. A column's own list wins over `server={{ distinct }}`, so the two mix.

For a column whose values are open-ended — a customer name, a reference — a set filter is the wrong control server-side however you supply it. Use `filter: "text"` and let the database do the matching.

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
