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

**Shape** — `--tpz-radius` `--tpz-radius-sm` `--tpz-radius-md` `--tpz-row-height` `--tpz-cell-padding-x` `--tpz-col-min-width` `--tpz-col-max-width` `--tpz-lead-min-width` `--tpz-lead-max-width` `--tpz-select-width`

**Type** — `--tpz-font-sans` `--tpz-font-mono` `--tpz-text-header` `--tpz-text-cell` `--tpz-text-cell-leading` `--tpz-text-ui`

**Other** — `--tpz-transition` `--tpz-hover` `--tpz-selected` `--tpz-focus` `--tpz-max-height`

</details>

## 2. Bridge to your design system

If your app already has tokens, map them once:

```ts
import "@trapezium/react/styles.css"
import "@trapezium/react/themes/shadcn.css"   // for shadcn/ui apps
```

That file is twenty lines of `--tpz-surface: var(--card)`. Copy it and point at your own variables for any other system.

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

Slots: `root` `frame` `toolbar` `search` `scroll` `table` `thead` `tbody` `headerRow` `headerCell` `row` `cell` `selectCell` `pagination` `empty` `loading` `footer`.

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

## Drag feedback

While a column is being dragged, the header it came from dims (`[data-dragging]`), the header it is over shows a line on the edge it will land on (`[data-drop="before" | "after"]`), and the table gets a dashed outline (`[data-dragging-out]`) to say that letting go outside will remove it. All three are tokens away from being restyled:

```css
.tpz-th[data-drop]::after { background: hotpink; }
.tpz[data-dragging-out="true"] .tpz-scroll { outline-color: hotpink; }
```

The puff of smoke on removal is `.tpz-poof`, and it does not render at all under `prefers-reduced-motion`.

## Motion and print

Transitions respect `prefers-reduced-motion`. Printing drops the toolbar, the pagination and the selection column, unfreezes the header and lets cells wrap, so a printed table is the data rather than a screenshot of an interface.
