# Server-side data

Two modes, one flag apart. Neither is the advanced one.

```tsx
<Table data={users} />                                        // the table does the work
<Table data={page} total={total} server onStateChange={go} /> // your database does
```

In server mode the pipeline is skipped entirely: the rows you pass are the rows that render, `total` drives the pagination, and `onStateChange` fires with the complete next state whenever the user changes anything. Everything else — selection, column arrangement, rendering, styling — is identical.

## The shape of it

```tsx
const [state, setState] = useState({ pageSize: 50 })
const { data, isLoading } = useQuery({
  queryKey: ["invoices", state],
  queryFn: () => fetchInvoices(state),
})

<Table
  data={data?.rows ?? []}
  total={data?.total ?? 0}
  server
  loading={isLoading}
  state={state}
  onStateChange={setState}
  search
  pagination={{ pageSize: 50 }}
  columns={columns}
/>
```

## Translating state into a query

The state you receive is plain data, so turning it into SQL is a function you write once:

```ts
import { isFilterUsable } from "@trapezium/core"

function toQuery(state) {
  return {
    limit: state.pageSize,
    offset: (state.page - 1) * state.pageSize,
    orderBy: state.sort.map((sort) => `${sort.key} ${sort.direction}`),
    search: state.search,
    // Half-typed filters are dropped, exactly as the client drops them. Keeping
    // one means it matches everything, which under `match: "any"` widens the
    // result to the whole table instead of being ignored.
    where: state.filters.filter(isFilterUsable).map(toCondition),
    match: state.match,          // "all" or "any"
  }
}

function toCondition(filter) {
  switch (filter.operator) {
    case "eq":        return { column: filter.key, op: "=",    value: filter.value }
    case "ne":        return { column: filter.key, op: "<>",   value: filter.value }
    case "contains":  return { column: filter.key, op: "ilike", value: `%${filter.value}%` }
    case "gt":        return { column: filter.key, op: ">",    value: filter.value }
    case "gte":       return { column: filter.key, op: ">=",   value: filter.value }
    case "lt":        return { column: filter.key, op: "<",    value: filter.value }
    case "lte":       return { column: filter.key, op: "<=",   value: filter.value }
    case "between":   return { column: filter.key, op: "between", value: filter.value }
    case "in":        return { column: filter.key, op: "in",   value: filter.value }
    case "notIn":     return { column: filter.key, op: "not in", value: filter.value }
    case "empty":     return { column: filter.key, op: "is null" }
    case "notEmpty":  return { column: filter.key, op: "is not null" }
    case "startsWith":return { column: filter.key, op: "ilike", value: `${filter.value}%` }
    case "endsWith":  return { column: filter.key, op: "ilike", value: `%${filter.value}` }
    default:          return undefined
  }
}
```

**Never interpolate a filter key or value into SQL.** `key` comes from your own column definitions, so check it against them before it reaches a query, and bind every value as a parameter. A filter arriving from a URL is untrusted input.

## Set filters in server mode

A set filter derives its choices from the rows it can see, and in server mode that is one page — so without help it offers whatever happened to be on screen, and a value on a later page cannot be chosen at all. Trapezium warns about this in development rather than letting it reach a user.

Two ways to fix it, and both make the filter as complete as it is in the browser.

**Give it the list**, when you already have it:

```tsx
{ key: "status", filter: { kind: "set", options: STATUSES } }
```

**Or give it a way to fetch one**, when the values live in the database and you would rather not query for every column up front:

```tsx
{
  key: "owner",
  filter: {
    kind: "set",
    options: () => api.invoices.distinct("owner"),   // may return a promise
  },
}
```

It is called the first time somebody opens that column's panel, shows "Loading values…" while it works, and is remembered afterwards — so opening the panel again asks nobody anything. Change the function and it fetches afresh.

Once the choices are there, everything else already works: ticking one writes a normal filter into the state, `onStateChange` fires, your query runs, and rows that were never on screen come back.

In client mode none of this applies: the table has every row, so the list is complete whichever page is showing.

## Load more and infinite scroll

In server mode the table renders exactly what it is handed, so append pagination only works if **`data` holds every page loaded so far**. If each page replaces the last, the table appears to reload the same rows forever — Trapezium says so in the console rather than leaving you to work it out.

Two ways to do it, and the second is usually better.

**Append in the client**, when the rows arrive through a fetch you control:

```tsx
onStateChange={(next) => {
  setState(next)
  fetchPage(next).then((page) =>
    setRows((rows) => (next.page > 1 ? [...rows, ...page.rows] : page.rows)),
  )
}}
```

Reset to the new page whenever anything but the page changed — a filter, a sort, a search — or the old rows stay underneath the new ones.

**Or return every loaded page from the query**, which is one line and keeps the URL honest:

```ts
const from = accumulate ? 0 : (state.page - 1) * state.pageSize
const rows = await db.invoices.findMany({ skip: from, take: state.page * state.pageSize - from })
```

Nothing is kept in the browser, a shared link reproduces exactly what the sender saw, and the back button works. It costs a slightly larger query as the user goes deeper, which for the first few pages of a list is nothing. This is what `examples/next-server` does.

## Counting

`total` is what the pagination shows. Exact counts get expensive on large tables — if yours does, count with an estimate and label it in your own UI; Trapezium will page correctly against whatever number you give it.

## Exporting

An export contains **every row matching the current filters and search**, in the current sort order, with the columns as arranged — not the page on screen. In client mode the table has all of that and writes the file itself.

In server mode it does not: it holds one page, and exporting it would hand somebody twenty-five of four hundred rows without saying so. Trapezium warns in development, and gives you the half of the job only you can do:

```tsx
<Table
  server
  export={{ fetchRows: (state) => api.invoices.all(state) }}
/>
```

**You run the query; the table writes the file** — with the same columns in the same order, the same rules about what belongs in a spreadsheet, and the same escaping. `state` is exactly what the user is looking at, so the same function that fetches a page fetches all of it with the paging left off.

If the file should come from somewhere else entirely — an endpoint that already knows how to make it, or a format this library does not write — take the whole thing:

```tsx
export={{ onExport: (state) => { window.location.href = `/api/invoices.csv?${stateToQueryString(state)}` } }}
```

With either of those in place there is nothing left to warn about, and the warning stops.

## Keeping search cheap

`onStateChange` fires on every state change, including each debounced keystroke of the search box. Raise the debounce if a query is expensive:

```tsx
<Table search={{ debounce: 400 }} … />
```
