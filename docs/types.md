# Types

A type knows five things about a value: how to render it as text, how to order it, how to compare it against a filter, which control that filter should be, and which icon labels its column. Everything else follows from those.

## The built-in types

| Type | Renders as | Sorts by | Default filter |
|---|---|---|---|
| `text` | the value | text, case- and accent-insensitively | text |
| `longText` | the value, wrappable | text | text |
| `number` | grouped digits, right aligned | numerically | range |
| `currency` | `$1,240.50`, right aligned | numerically | range |
| `percent` | `12.5%`, right aligned | numerically | range |
| `boolean` | a tick or a dash, centred | false before true | yes / no |
| `date` | `Aug 13, 2026` | chronologically | date |
| `datetime` | `Aug 13, 2026, 8:30 AM` | chronologically | date |
| `time` | `2:05 PM` | by time of day | range |
| `relativeTime` | `3 days ago` | chronologically | date |
| `select` | a chip | by label | set |
| `badge` | a chip, with a colour dot | by label | set |
| `tags` | several chips | by count, then alphabetically | set |
| `email` | a `mailto:` link | text | text |
| `url` | a link, without the protocol | text | text |
| `phone` | a `tel:` link | text | text |
| `image` | a small round image | not sortable | presence |
| `id` | monospaced text | text | text |
| `code` | monospaced text | text | text |
| `address` | the parts, comma separated | text | text |
| `file` | the file name | text | presence |
| `json` | `{…}`, with the value in the tooltip | not sortable | presence |

Snake_case names are accepted too, because configuration coming out of a database is usually written that way: `long_text`, `multi_select` (→ `tags`), `timestamptz` (→ `datetime`), `int8` (→ `number`), `money` (→ `currency`), `uuid` (→ `id`), `jsonb` (→ `json`).

## Inference

With no `type`, Trapezium samples up to fifty rows and decides.

**The key is consulted first**, but only for names that mean exactly one thing, and only when the values agree:

| Key looks like | Type |
|---|---|
| `id`, `uuid`, `customer_id`, `customerId` | `id` |
| anything containing `email` | `email` |
| `avatar`, `photo`, `picture`, `image`, `logo`, `thumbnail` | `image` |
| `url`, `link`, `website`, `*_url` | `url` |
| `phone`, `mobile`, `tel`, `fax` | `phone` |
| `status`, `state` | `badge` |
| `notes`, `description`, `summary`, `comment`, `body`, `bio` | `longText` |
| `*_percent`, `*_pct` | `percent` |
| `*_cents`, `*_minor` | `currency` |

A hint that the data contradicts is dropped — a column called `image` holding numbers is a coincidence of naming.

**Then the values decide:** all booleans → `boolean`; all numbers → `number`; all `Date`s → `datetime`; arrays → `tags`; objects → `address` if the keys look like one, otherwise `json`. Strings are examined for ISO dates, ISO timestamps, clock times, email addresses, URLs and UUIDs. A string column whose longest value is over 120 characters becomes `longText`.

**One piece of magic**, because it is what makes an inferred table look designed: a short string column with at least twenty rows and no more than six distinct values is a category, and renders as a `badge`.

Anything else, and anything mixed, is `text`.

Money is deliberately *not* guessed from names like `amount`, `price` or `total`. Being wrong there means a column of quantities suddenly formatted as dollars, which is worse than plain numbers. State it: `{ key: "amount", type: "currency" }`.

## Writing your own type

A type is an object. `defineType` is an identity function that gives it a contextual type so your editor helps.

```tsx
import { Table, defineType } from "@trapezium/react"

const rating = defineType({
  name: "rating",
  align: "end",
  format: (value) => "★".repeat(Number(value) || 0),
  normalise: (value) => Number(value) || 0,   // used for sorting and filtering
  filter: "range",
  operators: ["eq", "gte", "lte", "empty", "notEmpty"],
  icon: "select",
})

<Table data={films} types={{ rating }} columns={[{ key: "stars", type: "rating" }]} />
```

`normalise` is the important one. It reduces a value to something orderable — a number for money and dates, a lower-cased string for text — and both sorting and filtering go through it. Write it once and a column of your type sorts, filters, searches and exports correctly.

### Replacing a built-in

A custom type with a built-in's name replaces it, everywhere, for that table:

```tsx
const date = defineType({
  ...BUILT_IN_TYPES.date,
  format: (value, context) => myOwnDateFormat(value, context.timeZone),
})

<Table data={rows} types={{ date }} />
```

That is how you change what every date column in your product looks like without touching a single column definition.

### Rendering, not just formatting

A type produces *text*. Rendering markup is a column's job, or the built-in renderer's. If you want a custom type with custom markup on every column that uses it, pair it with a `defaults` render — or use `render` on the columns that need it:

```tsx
{ key: "stars", type: "rating", render: ({ value }) => <Stars count={Number(value)} /> }
```

## What a type puts in a file

A CSV is opened by a spreadsheet, so what belongs in one is not always what belongs on a page:

| Type | On screen | In the file |
|---|---|---|
| `number`, `percent` | `1,234,567.5` | `1234567.5` |
| `currency` | `$4,790.50` | `4790.5` |
| `date` | `Aug 13, 2026` | `2026-08-13` |
| `datetime`, `relativeTime` | `Aug 13, 2026, 10:30 PM` / `3 days ago` | `2026-08-13T22:30:00.000Z` |
| `select`, `badge`, `tags`, `boolean` | the label | the same label |

Amounts add up, dates sort, and the words a person needs are still words. A custom type says its own piece with `exportValue`:

```ts
defineType({
  name: "duration",
  format: (value) => `${value} minutes`,
  exportValue: (value) => String(Number(value) * 60),   // seconds, for the spreadsheet
})
```

A column's own `exportValue` overrides everything.

## Formatting context

Every formatter receives the table's format context, merged with the column's own `formatOptions`:

```ts
{
  locale: "en",                  // BCP 47
  timeZone: "UTC",               // IANA, for datetime
  currency: "USD",               // ISO 4217
  currencyInMinorUnits: false,   // true if your money is in cents
  emptyText: "—",
  decimals: undefined,           // per column
  options: undefined,            // per column, for select / badge / tags
  dateOptions: undefined,        // per column, merged into Intl.DateTimeFormat
}
```

Both `locale` and `timeZone` default to fixed values rather than the runtime's, deliberately: a server in UTC and a browser in Sydney formatting the same timestamp differently is a hydration mismatch, and a silent one. Set them to whatever your users should see.

## Dates in particular

- A bare `"2026-08-13"` is a calendar day and is always rendered in UTC, whatever `timeZone` says. Applying a zone to a date with no time moves birthdays across midnight for half the world.
- A full timestamp is rendered in `timeZone`.
- `toDate` accepts `Date` objects, ISO strings, epoch milliseconds and epoch seconds, because that is what APIs actually return.
- A date filter written as a day matches *the whole day*. "Created is 13 Aug" matching only midnight is technically defensible and completely useless.
