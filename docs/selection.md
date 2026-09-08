# Selection

```tsx
<Table data={rows} selection onSelectionChange={(ids, rows) => setSelected(rows)} />
```

That gives you a checkbox column, a header checkbox that selects the page, shift-click for ranges, and a count in the toolbar.

## Modes

```tsx
selection                     // multiple — the default
selection="single"            // radio buttons, one at a time
selection={{ mode: "multiple", isSelectable: (row) => !row.archived }}
```

The same three forms work in every adapter — `:selection="{ isSelectable }"` in Vue, `selection={{ isSelectable }}` in Svelte, `selection: { isSelectable }` in plain JavaScript.

## Rows that cannot be selected

`isSelectable` is called with each row and its index. A row it refuses keeps its checkbox, disabled, so the person can see there is one and that it is not for them. Everything else about the row is unchanged: it still sorts, filters, searches and exports.

```tsx
selection={{ isSelectable: (invoice) => !invoice.paid }}
```

The header checkbox selects only the rows that can be selected, and reads as complete when all of those are. A shift-click range steps over the ones in between that cannot be. Neither ever hands a refused row to `onSelectionChange`.

A selection set from outside — a controlled `state`, a saved view — is taken as given, refused rows included. The table renders what it is told; the caller owns what it tells it.

## Ranges

Click one checkbox, hold shift and click another, and everything between them is selected — or cleared, if the second row was already selected. The range runs over the rows on screen, in the order they are shown.

## Row identity

Selection is a list of row ids. Those come from `getRowId`, which defaults to `row.id`, then `row.uuid`, then the array index. The index is wrong the moment the data sorts, so supply it whenever your rows have their own id:

```tsx
<Table data={invoices} selection getRowId={(invoice) => invoice.invoice_number} />
```

## What "select all" means

The header checkbox selects **the rows you can see** — the current page — not everything behind the pagination. That is what people expect, and the alternative silently selects thousands of rows nobody has looked at.

It shows an indeterminate state when some of the page is selected, and selecting a page leaves selections on other pages alone.

## Reading the selection

`onSelectionChange` fires with the ids and the rows behind them, for any change — including one made from outside the table, like a controlled state update or a cleared view:

```tsx
const [selected, setSelected] = useState<string[]>([])

<Table
  data={rows}
  selection
  onSelectionChange={(ids) => setSelected(ids)}
  toolbar={selected.length > 0 && <button onClick={() => archive(selected)}>Archive</button>}
/>
```

Only rows currently rendered can be handed back as objects; ids for rows on other pages stay in `state.selection` regardless.

## Exporting a selection

With `export` on as well, a selection is what gets exported: "Download CSV" and "Copy to clipboard" both contain the selected rows whenever there are any, and everything the filters match otherwise. In server mode, a selection that reaches past the page on screen is completed through `export.fetchRows` or `server.all`; the clipboard, which has to be written inside the click, copies the selected rows that are on hand.

## Controlling it

Selection is part of table state, so you can set it, clear it or persist it like anything else:

```tsx
const [state, setState] = useState({ selection: ["inv_0001"] })

<Table data={rows} selection state={state} onStateChange={setState} />
```

It is left out of the URL by default — a selection can be thousands of ids long and means nothing to whoever receives the link. Opt in with `stateToSearchParams(state, { include: [...DEFAULT_URL_KEYS, "selection"] })`.
