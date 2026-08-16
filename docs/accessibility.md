# Accessibility

Accessibility is not a feature here; a feature that is not accessible does not ship. What follows is what you get, and the two things that are still yours.

## What you get

**Real table semantics.** A `<table>` with `<thead>`, `<th scope="col">` and `<td>`. That is what screen readers announce as a table, what browser find-in-page searches, what "copy as table" pastes into a spreadsheet, and what prints. A grid of divs is easier to style and worse at all four.

**Sorting is announced.** Every header carries `aria-sort` — `ascending`, `descending` or `none` — so a screen reader says how the table is ordered, and says it changed.

**Everything is reachable by keyboard.** Headers sort with Enter or Space. Column panels open with Enter or Down, move with the arrow keys, Home and End, close with Escape, and return focus to the control that opened them. Column resizing is on a real button that responds to the left and right arrows, and to Shift for larger steps.

**Icon-only controls have names.** Sort direction, resize handles, pagination arrows, remove-filter buttons, the export menu — all labelled.

**Selection is labelled per row**, and the header checkbox says whether it will select or clear.

**Panels are groups, not ARIA menus.** A column's panel holds a filter form as well as actions, and an ARIA menu may only contain menu items — so it is a labelled group of buttons, which announces correctly and makes no promise the content cannot keep.

**Live regions where they matter.** The row count and the pagination position are announced when they change, so a filter that removes rows is not silent.

**Focus is visible**, using the `--tpz-ring` token, and never removed.

**Contrast passes AA** in both themes, including the muted header text and the disabled states.

**Motion respects `prefers-reduced-motion`.**

**Infinite scroll keeps a button.** A list that can only be advanced by scrolling with a mouse excludes keyboard and switch users, so infinite mode has a real "load more" behind the observer.

## The two things that are yours

**Name the table.** A table needs to say what it is. Use one:

```tsx
<Table data={rows} aria-label="Invoices raised this quarter" />
<Table data={rows} caption="Invoices raised this quarter" />
```

**Anything you render.** A custom cell is your markup — an icon-only button in an actions column needs its own label, and a colour-coded status needs a word as well as a colour.

```tsx
{
  key: "actions",
  render: ({ row }) => (
    <button aria-label={`Open invoice ${row.reference}`} onClick={() => open(row.id)}>
      <Icon name="chevronRight" />
    </button>
  ),
}
```

## Testing it

Every release runs an automated `axe-core` pass over the table with everything switched on, over the empty, loading and error states, and over an open column panel — plus explicit keyboard-path tests for sorting, opening a panel, moving through it, escaping out of it and getting focus back.

That pass then runs again in a real browser, against every example — React, Vue, Svelte and plain JavaScript — with a column menu open as well as closed, in Chromium, Firefox and WebKit. It is the run that can see contrast, because it is the only one with a stylesheet that really loaded and a layout to measure.

One caveat worth knowing rather than hiding: Safari does not move focus to buttons and links with Tab unless the reader has switched on **Full Keyboard Access** in macOS or iOS. That is Safari's setting rather than anything in the markup, and it applies to every site — but if your users are on Safari and rely on the keyboard, it is worth knowing that they may have to turn it on.

Automated checks catch a fraction of what matters. If something reads badly in a real screen reader, that is a bug worth reporting.
