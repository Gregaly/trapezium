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

## Controlling it

Selection is part of table state, so you can set it, clear it or persist it like anything else:

```tsx
const [state, setState] = useState({ selection: ["inv_0001"] })

<Table data={rows} selection state={state} onStateChange={setState} />
```

It is left out of the URL by default — a selection can be thousands of ids long and means nothing to whoever receives the link. Opt in with `stateToSearchParams(state, { include: [...DEFAULT_URL_KEYS, "selection"] })`.
