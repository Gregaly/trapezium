# Recipes

## A column of two fields

```tsx
{ key: "name", accessor: (row) => `${row.first_name} ${row.last_name}` }
```

Sorting and searching follow the accessor, so this behaves like a real column.

## A computed column

```tsx
{ key: "total", accessor: (row) => row.quantity * row.unit_price, type: "currency" }
```

## Money stored in cents

```tsx
<Table data={rows} format={{ currency: "AUD", currencyInMinorUnits: true }} />
```

Or per column: `{ key: "amount_cents", type: "currency", formatOptions: { currencyInMinorUnits: true } }`.
A key ending in `_cents` or `_minor` is inferred as currency automatically.

## Highlighting a row

```tsx
<Table data={rows} rowClassName={(row) => (row.overdue ? "row-overdue" : undefined)} />
```

```css
.row-overdue .tpz-td { background: color-mix(in oklab, var(--tpz-danger) 8%, transparent); }
```

## A status column with colours

```tsx
{
  key: "status",
  type: "badge",
  formatOptions: { options: [
    { value: "active", label: "Active", colour: "#3f6b4a" },
    { value: "paused", label: "Paused", colour: "#9a6b1f" },
    { value: "closed", label: "Closed", colour: "#97362b" },
  ] },
}
```

## A bulk action bar

```tsx
const [selected, setSelected] = useState<string[]>([])

<Table
  data={rows}
  selection
  onSelectionChange={setSelected}
  toolbar={
    selected.length > 0 && (
      <button className="tpz-btn" data-variant="primary" onClick={() => archive(selected)}>
        Archive {selected.length}
      </button>
    )
  }
/>
```

## An "add another" row at the bottom

```tsx
<Table data={rows} appendRow={<a href="/invoices/new" className="tpz-append">+ Add invoice</a>} />
```

## Persisting a user's arrangement

```tsx
const [state, setState] = useState(() => JSON.parse(localStorage.getItem("invoices") ?? "{}"))

<Table
  data={rows}
  state={state}
  onStateChange={(next) => {
    setState(next)
    localStorage.setItem("invoices", JSON.stringify(next))
  }}
/>
```

## Refreshing without losing the view

Keep the state in your own component and pass it as `state`. Replacing `data` never resets sorting, filters, page or selection.

## Exporting only the selected rows

```tsx
import { toCsv, downloadText } from "@trapezium/react"

const { rows, columns, types, format } = useTable({ data })
downloadText(toCsv(rows.filter(isSelected), { columns, types, format }), "selection.csv")
```

## Driving a table from a database schema

```tsx
const columns = fields.map((field) => ({
  key: field.slug,
  header: field.label,
  type: field.type,             // snake_case names are accepted
  filter: field.is_filterable,
  sortable: field.is_sortable,
}))
```

## Two tables on one page, both in the URL

```tsx
<Table … buildHref={(next) => `?${stateToQueryString(next, { prefix: "a_" })}`} />
<Table … buildHref={(next) => `?${stateToQueryString(next, { prefix: "b_" })}`} />
```

## Hiding columns for some users

Decide on the server and pass fewer columns. The table renders what it is given; it has no idea what a permission is, and should not.

```tsx
const columns = [...base, ...(canSeeBilling ? billingColumns : [])]
```
