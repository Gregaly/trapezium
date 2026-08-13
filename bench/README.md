# Benchmarks

Numbers, so that "it must be fast" is a measurement rather than an opinion. The results and what they mean are in [`docs/performance.md`](../docs/performance.md).

```sh
pnpm build            # the benchmarks run against the built packages
pnpm bench:prepare    # regenerate dataset.mjs from the TypeScript source
pnpm bench            # the engine, in Node
```

For the browser, serve the repository and open the pages:

```sh
pnpm --filter @trapezium/example-plain-html dev
```

- <http://localhost:4330/bench/browser/index.html> — renders a real table and times a first render, a sort, a filter, a search and a page turn, each to the point where the browser has laid the result out.
- <http://localhost:4330/bench/browser/integrity.html> — drives the real table through its own controls and checks that every row is there, exactly once, on exactly one page, in the order the columns imply, at 500 and 5,000 rows.

## The data

Everything here uses the same dataset as the conformance suite: **26 columns** covering every built-in type plus two custom ones, with roughly one value in eight missing, dates arriving in four different shapes, and names with accents, emoji and stray whitespace. `dataset.mjs` is generated from `packages/core/src/testing/dataset.ts` — edit the TypeScript, not the copy.

It is deliberately heavier than a real table. A result here is a floor, not a ceiling.
