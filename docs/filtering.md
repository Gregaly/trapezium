# Filtering and search

Both, independently, because they answer different questions. Search is "find me this"; a filter is "show me only these".

## Global search

```tsx
<Table data={rows} search />
<Table data={rows} search={{ placeholder: "Search invoices", debounce: 250 }} />
```

Search matches every column that is searchable, against **the formatted text as well as the raw value** — so searching "Aug" finds a date and "Yes" finds a checkbox. The words on the screen are the words people type.

It is case- and accent-insensitive: "jose" finds "José". Nor does the kind of space matter — French writes an amount as "1 240,50 €" with two spaces no keyboard has a key for, and typing ordinary ones finds it.

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

The four text operators — `contains`, `notContains`, `startsWith`, `endsWith` — ask what a cell *says*, whatever its type. They are answered from the stored value written out and from the text the column shows for it: `contains "Aug"` finds a date, `contains "1,2"` finds $1,240.00, and `contains "Professional"` finds a plan stored as `pro`. The rest compare values, through the column's type.

## Searching one column from its header

The quickest filter is the one that needs no menu. Switch it on and each header gets a magnifier — in the place of its type icon, and only while the header is hovered or focused — that turns the header itself into a text box:

```tsx
<Table data={rows} headerSearch />
```

Type, and the column narrows to the rows whose cells say it. Enter applies at once and closes the box. Escape empties it, and closes it if it was already empty. Clicking away closes it and keeps what was typed. A column that is being searched keeps its magnifier lit, and the search shows as a chip — "Customer contains ada" — like any other filter.

Nothing moves when the magnifier appears, and nothing moves when the box opens: the magnifier borrows the icon's slot, and the box is laid over the header rather than swapped in for it, so every column stays exactly as wide as it was.

It is off until asked for, at either level:

```tsx
// Every column that can be filtered.
<Table data={rows} headerSearch />

// The same, waiting 300ms after a keystroke rather than 150.
<Table data={rows} headerSearch={{ debounce: 300 }} />

// One column only.
<Table data={rows} columns={[{ key: "name", headerSearch: true }, "email", "team"]} />

// Every column but one.
<Table data={rows} headerSearch columns={["name", "email", { key: "notes", headerSearch: false }]} />
```

**It is the column's filter, not a second kind of thing.** What is typed becomes `{ key, operator: "contains", value }` in `state.filters` — the entry the column's menu edits too — so it travels in the URL, reaches `onStateChange`, narrows an export, composes with every other filter and with the toolbar's search, and replaces whatever filter that column had. A column searched this way offers "contains" in its menu whatever its type, so the menu can always show the filter the header made. From code:

```ts
import { columnSearchText, setColumnSearch } from "@trapezium/core"

const searched = setColumnSearch(state, "customer", "ada")   // "" takes the search away again
columnSearchText(searched, "customer")                        // "ada"
```

**It matches what the cells show, for every type** — the rule global search follows, one column wide:

| Type | Typing this | finds |
|---|---|---|
| `text`, `longText`, `email`, `url`, `phone`, `id`, `code` | any part of it | the value |
| `number`, `currency`, `percent` | `1,2` · `$1,240` · `1240.5` · `12.5%` | the figure as it is written on screen, or the number underneath |
| `date`, `datetime`, `relativeTime` | `Aug` · `13, 2026` · `9:30` · `days ago` · `2026-08` | the date as shown, or the stored one |
| `time` | `2:05 PM` · `14:05` | either way of writing it |
| `boolean` | `yes` · `no` | the word the checkbox is read as |
| `select`, `badge` | `Professional` · `pro` | the label, or the key stored for it |
| `tags` | any one tag | a row that has it, by label or by key |
| `address`, `file` | a street, a postcode, a file name | the text the cell shows — never the shape of the object behind it |
| a custom type | whatever its `format` writes | the same, through your formatter |

`image` and `json` show no text, so they get no magnifier unless the column asks for one with `headerSearch: true` — and then an image is found by its address.

Two things it does not do. A column's own `format` function is not consulted — the match is against the stored value and the text the column's *type* writes. And a `render` function is markup, which nothing can search: the value underneath is what is matched.

**With the data on a server**, the table sends the filter and your query answers it, like every other filter. `contains` on a text column is an `ilike`. On a date or an amount it means "the text the cell shows contains this", which a database does not know — so either answer it where the formatting is, with the same function the table uses, or switch the search on only for the columns your query can treat as text:

```ts
import { BUILT_IN_TYPES, DEFAULT_FORMAT, matchesFilter } from "@trapezium/core"

// The same formatting the table was given, so "20 Jan" means the same thing on both sides.
const format = { ...DEFAULT_FORMAT, locale: "en-AU", timeZone: "Australia/Sydney", currency: "AUD" }

const wanted = rows.filter((row) => matchesFilter(row.issued_at, filter, BUILT_IN_TYPES.datetime, format))
```

The box is opened by a click, so — like the column menus — it needs the table's script. A search already in the URL is rendered by the server like any other filter, magnifier lit and rows narrowed.

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
- `contains` on a `tags` column looks inside the array, at each tag's label as well as its stored value.
- The text operators match what a cell shows as well as what it stores, for every type. An object is never matched by its shape: "contains object" finds nothing in a column of addresses.
- A `select` column matches on both the stored value and the label, so a filter built from what the user can see works as well as one built from an id.
