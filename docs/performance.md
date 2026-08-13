# Performance

Measured, not asserted. Everything below comes from `bench/`, which you can run yourself.

```sh
pnpm build
pnpm bench            # the engine, in Node
pnpm bench:browser    # a real table in a real browser
```

## The engine

Milliseconds, median of seven runs, on an Apple M-series laptop. The dataset is deliberately heavy: **26 columns** covering every built-in type plus two custom ones, with roughly one value in eight missing.

| rows | sort (text) | sort (date) | sort (custom type) | filter ×1 | filter ×3 | search | everything at once |
|---|---|---|---|---|---|---|---|
| 100 | 0.13 | 0.11 | 0.09 | 0.09 | 0.13 | 0.37 | 0.18 |
| 1,000 | 0.95 | 0.70 | 0.49 | 0.46 | 1.04 | 2.8 | 0.93 |
| 10,000 | 9.2 | 7.1 | 7.2 | 3.7 | 7.9 | 30 | 11 |
| 100,000 | 103 | 105 | 108 | 38 | 80 | 344 | 122 |
| 250,000 | 273 | 320 | 297 | 96 | 203 | 801 | 330 |

"Everything at once" is a filter, a search, a sort and a page, which is what a table actually does between one keystroke and the next.

Roughly: **1 µs per row to sort, 0.4 µs to filter, 3 µs to search**, across twenty-six columns. A table with the eight or ten columns most applications have is proportionally faster.

## In a browser

Time from the interaction to the browser having laid out the result, with 26 columns and 50 rows on a page:

| | 1,000 rows | 10,000 rows | 50,000 rows |
|---|---|---|---|
| first render | 29 ms | 24 ms | 29 ms |
| sort a column | 31 ms | 40–48 ms | 115–118 ms |
| apply a filter | 25 ms | 48 ms | 127 ms |
| search, first time | 40 ms | 130 ms | 547 ms |
| search, again | 9 ms | 54 ms | 235 ms |
| turn the page | 25 ms | 47 ms | 102 ms |
| DOM nodes | 8,822 | 8,781 | 8,838 |

Two things to notice. **The DOM does not grow with the data** — only the page is rendered, so the browser's own costs are flat no matter how many rows are behind it. And **searching twice is much cheaper than searching once**, because the text each cell displays is remembered against the row the first time it is needed.

## What this means for your table

- **Up to about 10,000 rows, keep the data in the browser.** Every interaction lands well inside the 100 ms that feels instant, and search — the most expensive thing a table does — is comfortable.
- **Beyond that, use [server mode](server-data.md).** Not because the engine falls over, but because sending a hundred thousand rows to a browser is the wrong thing to do regardless of what happens next.
- **Columns cost as much as rows.** Search and filtering are linear in both. Twenty-six columns is an unusual table; if yours has that many, consider whether every one of them needs to be searchable — `{ key: "internal_ref", searchable: false }` takes it out of the loop entirely.
- **Debounce the search box** if your data is large. It defaults to 150 ms; `search={{ debounce: 300 }}` is sensible past ten thousand rows.

## What makes it fast

Nothing exotic — mostly not doing avoidable work:

- **Sort keys are worked out once per row**, not inside the comparator. A comparison sort asks about pairs `n log n` times; the naive version normalised 151,234 values to order 10,000 rows. Ordering by date got 4.5× faster, and by a custom type 8×.
- **The text a cell displays is remembered against the row object.** `Intl` formatting is about a microsecond a cell, and search has to compare against what is on the screen. Cached, the second search costs a third of the first. Keyed by the row, so replacing your data invalidates it and dropping your data collects it.
- **Nothing that does not depend on the row is computed per row.** Filter contexts, type lookups and the folded search query are all prepared once.
- **Accent folding takes a fast path for text that has no accents**, which is nearly all of it — and for ASCII, folding *is* lower-casing, so the cheap answer is the same answer.
- **Filters short-circuit.** "Match all" stops at the first refusal, "match any" at the first acceptance.

## Bundle size

| | minified | gzipped |
|---|---|---|
| `@trapezium/core` | 60 kB | 15 kB |
| `@trapezium/react` (excluding the core) | 64 kB | 14 kB |
| `@trapezium/vanilla` (core included) | 48 kB | 17 kB |
| the stylesheet | 28 kB | 6 kB |

No runtime dependencies, so that is the whole of it.
