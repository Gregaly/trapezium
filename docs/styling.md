# Styling

The default look is dense, bordered and monospaced, with a muted header strip, sticky header, frozen leading columns and a hover tint that reads as a row. It is meant to look finished before you touch it.

Three ways to change it, in increasing order of commitment.

## 1. Override the tokens

Every value is a CSS custom property on `.tpz`. Set them anywhere that wins the cascade:

```css
.tpz {
  --tpz-surface: white;
  --tpz-border: #e5e7eb;
  --tpz-primary: #4f46e5;
  --tpz-radius: 8px;
  --tpz-row-height: 2.25rem;
  --tpz-font-mono: "JetBrains Mono", monospace;
}
```

<details>
<summary>Every token</summary>

**Colour** — `--tpz-bg` `--tpz-fg` `--tpz-surface` `--tpz-surface-fg` `--tpz-muted` `--tpz-muted-fg` `--tpz-accent` `--tpz-accent-fg` `--tpz-primary` `--tpz-primary-fg` `--tpz-border` `--tpz-input` `--tpz-ring` `--tpz-success` `--tpz-warning` `--tpz-danger`

**Shape** — `--tpz-radius` `--tpz-radius-sm` `--tpz-radius-md` `--tpz-row-height` `--tpz-header-height` `--tpz-cell-padding-x` `--tpz-cell-padding-y` `--tpz-col-min-width` `--tpz-col-max-width` `--tpz-lead-min-width` `--tpz-lead-max-width` `--tpz-select-width`

**Type** — `--tpz-font-sans` `--tpz-font-mono` `--tpz-text-header` `--tpz-text-cell` `--tpz-text-cell-leading` `--tpz-text-ui`

**Other** — `--tpz-transition` `--tpz-hover` `--tpz-selected` `--tpz-focus` `--tpz-max-height`

</details>

## 2. Bridge to your design system

If your app already has tokens, map them once:

```ts
import "@trapezium/react/styles.css"
import "@trapezium/react/themes/shadcn.css"   // for shadcn/ui apps
```

**shadcn apps come in two flavours, and picking the wrong one loses every colour.** Open your `globals.css` and look at a token:

| What `--background` holds | Import |
|---|---|
| `oklch(0.98 0 0)` or `hsl(210 20% 98%)` — a whole colour | `themes/shadcn.css` |
| `210 20% 98%` — bare channels, wrapped as `hsl(var(--background))` where they are used | `themes/shadcn-hsl.css` |

The channel form is what Tailwind 3 era shadcn generates and it is still the common one. Handing those three numbers to a colour property is not an error CSS reports — the declaration is simply dropped and the table falls back, so it is worth checking rather than guessing.

Either file is twenty lines of `--tpz-surface: var(--card)`. Copy one and point it at your own variables for any other system.

## 3. Take over with your own classes

Every part of the table is a slot, and a class you pass is **added** to the default — so you override what you care about and inherit the rest:

```tsx
<Table
  data={rows}
  classNames={{
    frame: "rounded-2xl border-zinc-200 shadow-sm",
    headerCell: "bg-zinc-50 text-zinc-500",
    row: "hover:bg-indigo-50/40",
    cell: "font-sans text-sm",
  }}
/>
```

Slots: `root` `frame` `toolbar` `search` `scroll` `table` `thead` `tbody` `headerRow` `headerCell` `row` `cell` `selectCell` `pagination` `empty` `footer`.

`className`, `classNames` and `unstyled` are the same in every adapter: props in React and Vue, options in Svelte and plain JavaScript.

`unstyled` drops the defaults entirely, leaving only what you pass — for when your design system should be the only thing on the element:

```tsx
<Table data={rows} unstyled classNames={{ table: "w-full text-sm", cell: "px-3 py-2 border-b" }} />
```

Per-column classes are on the column: `className` and `headerClassName`.

## Dark mode

Colours are `light-dark()` pairs, resolved by the page's own `color-scheme`. If your app already declares one — most do — the table follows it with no configuration.

If your app switches themes with a class and never sets `color-scheme`, Trapezium recognises `.dark`, `[data-theme="dark"]` and `[data-mode="dark"]` on any ancestor.

Force it per table:

```tsx
<Table data={rows} theme="dark" />
```

## Density

```tsx
<Table data={rows} density="compact" />       // 1.75rem rows
<Table data={rows} densityControl />          // let the user choose
```

## Row height

Rows are one line tall and truncate with an ellipsis, which is what makes a
table of values scannable. When the content is not values — prose, a stack of
tags, an avatar and two lines of detail from a cell renderer — let the rows size
themselves:

```tsx
<Table data={rows} rowHeight="auto" />        // as tall as the tallest cell
<Table data={rows} rowHeight={64} />          // all rows 64px, text wrapping into it
<Table data={rows} />                         // "fixed": one line, ellipsis
```

Under `"auto"` the row grows to fit its tallest cell — **including whatever a
cell renderer returned**, because the thing measuring it is the browser. There
is no measuring pass, no `ResizeObserver`, no second layout, and nothing to get
wrong on the server: the table is a real `<table>` in normal flow, so a row is
already as tall as its content. This is the part every virtualised grid has to
reinvent, badly, because absolutely-positioned rows have to be rendered,
measured and then placed.

`--tpz-row-height` becomes the *minimum* rather than the height, so density goes
on meaning what it meant and a row of short values keeps the rhythm.

Per column:

```tsx
columns={[
  { key: "reference", wrap: false },   // stays on one line while the rest wrap
  { key: "notes" },                    // wraps, because the table says so
  { key: "summary", wrap: 3 },         // wraps, then stops after three lines
]}
```

`wrap` works without `rowHeight="auto"` too — one prose column in an otherwise
fixed table is the common case, and it is what `wrap: true` has always meant.

A number wraps in exactly the same way as `"auto"` — the only difference is
where the height comes from. `"auto"` lets each row follow its own content; a
number gives them all the same height. Asking for 72px rows and being handed one
truncated line adrift in the middle of them is nobody's idea of the setting, so
`fixed` is the only mode that truncates.

A number is a ceiling as well as a floor: every row is that height, and text
that will not fit ends in an ellipsis on the last line the row had room for —
the same finish a single line gets under `fixed`, just on however many lines
there are. A row height you cannot shrink would not be a row height, so cells in
this mode carry an element that bounds them; `height` alone cannot, because on a
table cell it is only ever a minimum.

The number of lines is worked out in CSS from the height you asked for, so
nothing is measured and the server and the first paint agree. To fix a column at
a particular number of lines regardless of the row, say so:

```tsx
<Table
  data={rows}
  rowHeight={72}
  columns={[{ key: "summary", wrap: 3 }]}   // three lines, then an ellipsis
/>
```

The line count leans on `round()`, `atan2()` and the `lh` unit, which every
current engine has: Chrome 125, Firefox 120 and Safari 16.4 or later. An older
browser still gets rows of the right height with the overflow clipped; it only
loses the ellipsis on the last line.

Wrapped rows hang from the top, so the first line of every column lines up with
the first line of the others. `fixed` and exact rows stay vertically centred,
the way every other row in the library is.

`rowHeight` is about rows: the header keeps its own height and does not follow
it, or a table of 64px rows would carry a 64px header. Density moves both, which
is the point of density. To size the header on its own, set its token:

```css
.tpz { --tpz-header-height: 44px; }
```

### With append pagination

`loadMore` and `infinite` render only the rows they just added, so a long list of
rows of differing heights stays cheap — the rows already on screen keep their
elements and their place, and the scroll position is not disturbed. That is what
makes auto height usable on an infinite list at all.

The rows already on screen are recognised by identity, so append what you
fetched to the array you have rather than mapping a fresh copy of everything —
a row that is a new object is a row that has changed, and it is rebuilt.
Toggling `loading` around the fetch is fine, in every adapter.

One thing to know, because it is the one way the rows above can still move: a
column with no `width` is sized from its content, so if the first page is not
representative of the rest, the arrival of a much wider page can re-lay-out the
columns. Nothing is rebuilt, but text in a narrowed column may re-wrap and change
height. It settles after that and stays settled.

Give the columns that hold prose an explicit width and the question never arises
— worth doing in [server mode](server-data.md) especially, where the first page
really is all the table has seen:

```tsx
{ key: "summary", width: 420 }
```

## Sticky header and height

```tsx
<Table data={rows} maxHeight={480} />          // header sticks while the body scrolls
<Table data={rows} stickyHeader={false} />
```

## Narrow screens

```tsx
<Table data={rows} responsive="cards" />
```

Below 40rem the table becomes stacked cards, with each cell labelled by its header. It is a **container query**, so it depends on the room the table has rather than the size of the window — a table in a narrow sidebar stacks on a large screen, which is what you actually want.

It is also pure CSS. There is no second render, no measuring, and nothing to disagree about between a server and a browser.

Column widths and pinning belong to the table, not the cards. A width a column was given, or dragged to, and a `pin` on it are both ignored while the rows are stacked: every field runs the full width of its card, and comes back to its column when there is room for a table again.

## Drag feedback

While a column is being dragged, the header it came from dims (`[data-dragging]`), the header it is over shows a line on the edge it will land on (`[data-drop="before" | "after"]`), and the table gets a dashed outline (`[data-dragging-out]`) to say that letting go outside will remove it. All three are tokens away from being restyled:

```css
.tpz-th[data-drop]::after { background: hotpink; }
.tpz[data-dragging-out="true"] .tpz-scroll { outline-color: hotpink; }
```

The puff of smoke on removal is `.tpz-poof`, and it does not render at all under `prefers-reduced-motion`.

## Motion and print

Transitions respect `prefers-reduced-motion`. Printing drops the toolbar, the pagination and the selection column, unfreezes the header and lets cells wrap, so a printed table is the data rather than a screenshot of an interface.

## Which browsers

Chrome 123+, Edge 123+, Safari 17.5+, Firefox 120+ get everything, because that
is where `light-dark()` landed.

Older browsers still get a correctly themed table: the palette is repeated in an
`@supports not (color: light-dark(…))` block, so a browser that cannot resolve
the function reads a plain light or dark list instead of dropping the colours
altogether. What they lose is the OS following a theme change without a reload.

Below Safari 16 and Chrome 105 the card layout stops adapting — container
queries are what drive it — and the table falls back to scrolling sideways,
which is the same thing `responsive="scroll"` does deliberately.
