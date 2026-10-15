# Custom rendering

Two properties, and the difference between them matters:

- **`format`** replaces the cell's *text*. Sorting, filtering, search and export still use the raw value, so a formatted column keeps behaving correctly.
- **`render`** replaces the cell's *markup*. Use it when the result is not text.

```tsx
{ key: "amount", format: ({ value }) => `${value} credits` }
{ key: "user", render: ({ row }) => <Avatar user={row.user} /> }
```

## What a renderer receives

```ts
{
  value,       // the raw value, exactly as it came off the row
  row,         // the whole row
  rowIndex,    // position among the rendered rows
  rowId,       // the row's stable id
  column,      // the resolved column, defaults and all
  text,        // the value already formatted, so you can decorate rather than reimplement
  format,      // locale, timezone, currency, emptyText
}
```

`text` is the useful one. Most custom cells are the default text with something around it:

```tsx
{
  key: "due_date",
  type: "date",
  render: ({ value, text }) => (
    <span className={new Date(value) < new Date() ? "overdue" : undefined}>{text}</span>
  ),
}
```

## What a renderer should do

A row of one line is exactly `--tpz-row-height` — 28, 32 and 40px at compact, normal and relaxed — whether `rowHeight` is `"fixed"` or `"auto"`, and whatever is in the cells. Every built-in type keeps to that. Your renderer keeps to it by following four rules:

- **Inherit the font size.** No fixed text sizes; size icons in `em`. The cell is 11px at compact and normal and 12px at relaxed, and a renderer that says `font-size: 12px` is a size bigger than the text beside it.
- **Never scroll.** No `overflow: auto` or `overflow: scroll` inside a cell. A scrollbar inside a row is a trap for the wheel and a second scroll position nobody asked for.
- **Nothing above the first line.** No padding or margin before it, so it lines up with the first line of every other column.
- **One line unless the row is meant to grow.** Anything taller than a line of text — a button, a pill, an avatar — is at most `var(--tpz-text-cell-leading)` (16px) tall and hangs from the top of the line with `vertical-align: top`. A box exactly as tall as the line but sat on its baseline still pokes a pixel or two out of it, and under `rowHeight="auto"` the row grows by that much.

```css
.row-action {
  box-sizing: border-box;
  height: var(--tpz-text-cell-leading);
  border: 1px solid var(--tpz-border);
  border-radius: 6px;
  padding: 0 0.5rem;
  font: inherit;
  line-height: 1;
  vertical-align: top;
}
```

`.tpz-btn` and `.tpz-badge` already do this when they are inside a cell, so a renderer that uses them needs no CSS of its own. Outside a cell they keep their interface sizes.

| Variable | Compact | Normal | Relaxed | What it is |
|---|---|---|---|---|
| `--tpz-text-cell` | 11px | 11px | 12px | The cell's font size. Inherited already — use it only to size something relative to the text. |
| `--tpz-text-cell-leading` | 16px | 16px | 16px | One line. Anything inline should fit in it. |
| `--tpz-row-height` | 28px | 32px | 40px | The whole row, the cell's 1px bottom border included. A number for `rowHeight` sets it. |
| `--tpz-cell-padding-y` | 5px | 6px | 6px | Top and bottom padding of a cell — only under `rowHeight="auto"` or a number, and in a `wrap: true` column. A fixed row has none and centres its content instead. |
| `--tpz-cell-content-height` | 27px / 17px | 31px / 19px | 39px / 27px | The height inside the cell, fixed / auto: the row height less the border, and less both paddings where the cell is padded. Set on `.tpz-td`, so it exists only inside a cell. |

To fill a cell, use `height: var(--tpz-cell-content-height)`. `height: var(--tpz-row-height)` asks for a pixel more than the cell has — the cell's bottom border is inside the row height — and the row grows by it.

## Actions

```tsx
{
  key: "actions",
  header: "",
  sortable: false,
  filter: false,
  exportable: false,
  width: 90,
  render: ({ row }) => (
    <button className="tpz-btn" onClick={(event) => { event.stopPropagation(); open(row.id) }}>Open</button>
  ),
}
```

`stopPropagation` matters when the row itself is clickable — otherwise the button and the row both fire.

## Links

Rows link with `rowHref`, which turns the leading cell into an anchor:

```tsx
<Table data={rows} rowHref={(row) => `/invoices/${row.id}`} />
```

Trapezium never imports a router. To use your framework's link component — for client-side navigation and prefetching — hand it over:

```tsx
import Link from "next/link"

<Table data={rows} rowHref={(row) => `/invoices/${row.id}`} linkComponent={Link} />
```

`linkComponent` is used for every link the table generates, including [URL-driven controls](ssr.md).

## Whole rows

```tsx
<Table
  data={rows}
  onRowClick={(row) => select(row)}
  rowClassName={(row) => row.overdue ? "row-overdue" : undefined}
/>
```

## Headers

```tsx
{ key: "amount", renderHeader: ({ column }) => <>{column.header} <small className="unit">AUD</small></> }
```

`renderHeader` replaces the header's text and nothing else. The type icon (or the search magnifier), the sort control with its arrow and level, the column's menu and the resize handle all stay around it and keep working, and it is given the column's current `sort` so it can follow it. It is drawn inside the sort control, so return phrasing content — text, icons, a badge — and not a link or a button. The control is still named by `header`, so a screen reader hears "Amount" whatever the renderer draws. Every adapter renders it on the server too; in Vue it may return a VNode.

### Controls in a header

```tsx
{
  key: "family",
  renderHeaderControls: () => (
    <>
      <input aria-label="Search families" value={search} onChange={(event) => setSearch(event.target.value)} />
      <BadgePicker />
    </>
  ),
}
```

`renderHeaderControls` puts controls of your own in the header — a search box for the column, a filter button, a toggle — where `renderHeader` can only put text. They are drawn after the sort control and before the column's menu, outside the sort control, so they can be links, buttons and inputs. When a column has them, they take the header's spare width and the text keeps to its own.

A click, a key or a press in them is theirs alone: it never sorts the column, and never picks the column up to move it — pressing in a text box turns the header's dragging off until the press ends, so what was typed can be selected. Nothing the table does with a click reads one in them as its own.

The renderer is called again as the state changes, given the column's current `sort`. React and Vue keep what they rendered in place, so an input keeps its focus and its text while what it types changes the table (in Vue it may return a VNode, patched in place). In plain JavaScript and Svelte, return the same node each time to keep a control; a different node replaces it, and `""` or nothing leaves the slot empty. Every adapter renders the controls on the server too.

The header row is hidden in the card layout, and the controls with it — a control a phone must reach belongs in the toolbar.

### A description

```tsx
{ key: "days_overdue", description: "Days since the invoice was due, counting today" }
```

A plain-text description needs no renderer. It is shown as a tooltip beside the header while the header is hovered or has the keyboard, and linked to the header and its sort control with `aria-describedby`, so a screen reader reads it as well. A faint dotted underline on the header says there is something to read. Escape hides the tooltip. Give the table an `id` when two tables on a page describe columns with the same key.

## Around the table

```tsx
<Table
  data={rows}
  caption="Invoices raised this quarter"
  toolbar={<button onClick={create}>New invoice</button>}
  appendRow={<button onClick={create}>Add another</button>}
  footer={<Totals rows={rows} />}
  emptyState={<Nothing message="No invoices yet" onCreate={create} />}
  loading={isLoading}
  error={error?.message}
/>
```

`appendRow` is the "add one more" affordance at the bottom of the table — a slot rather than a feature, so it can be a link, a form, or a total.

The same four places exist in every adapter. In Vue they are slots:

```vue
<TrapeziumTable :data="rows">
  <template #toolbar><button @click="create">New invoice</button></template>
  <template #appendRow><button @click="create">Add another</button></template>
  <template #footer>{{ rows.length }} invoices</template>
  <template #empty><p>No invoices yet</p></template>
</TrapeziumTable>
```

In Svelte and plain JavaScript they are the same option names as React — `toolbar`, `appendRow`, `footer`, `emptyState` — taking a DOM node or a string:

```js
const button = document.createElement("button")
button.textContent = "New invoice"

createTable("#invoices", { data: rows, toolbar: button, footer: `${rows.length} invoices` })
```

## Rendering everything yourself

`useTable` is the whole model with no markup: rows, columns, state and the actions that change it. Use it when you want Trapezium's engine and your own DOM.

```tsx
import { useTable } from "@trapezium/react"

function MyGrid({ data }) {
  const { rows, columns, state, update, total } = useTable({ data, search: true })
  // …your own markup
}
```

## In Vue and Svelte

The model is the same; only what a renderer returns differs.

**Vue** — return a VNode and it is mounted as a real component, with props, events and your app's context:

```ts
import { h } from "vue"

{ key: "actions", header: "", render: ({ row }) => h(RowMenu, { id: row.id, onOpen: open }) }
```

A string or a DOM node works too.

**Svelte** — return a DOM node or a string. To render a component, mount it yourself:

```ts
import { mount } from "svelte"

{
  key: "actions",
  header: "",
  render: ({ row }) => {
    const host = document.createElement("span")
    mount(RowMenu, { target: host, props: { id: row.id } })
    return host
  },
}
```

**Vanilla** — a DOM node or a string:

```js
{
  key: "actions",
  header: "",
  render: ({ row }) => {
    const button = document.createElement("button")
    button.className = "tpz-btn"
    button.textContent = "Open"
    button.addEventListener("click", () => open(row.id))
    return button
  },
}
```
