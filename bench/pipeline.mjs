/**
 * What the engine costs.
 *
 * Measures the pipeline — filter, search, sort, paginate — over datasets from a
 * page to a quarter of a million rows, and reports the median of many runs
 * rather than a single lucky one.
 *
 * Run it with `node bench/pipeline.mjs`. It imports the built package, so build
 * first: what is measured is what would ship.
 */

import { performance } from "node:perf_hooks"

import {
  createState,
  createTypeRegistry,
  DEFAULT_FORMAT,
  filterRows,
  getRows,
  resolveColumns,
  searchRows,
  sortRows,
} from "../packages/core/dist/index.js"

import { columns, customTypes, makeRows } from "./dataset.mjs"

const types = createTypeRegistry(customTypes)
const format = { ...DEFAULT_FORMAT, now: new Date("2026-08-13T12:00:00.000Z") }

const SIZES = [100, 1_000, 10_000, 100_000, 250_000]

/** Median of `runs` timings, in milliseconds, after a warm-up. */
function measure(work, runs = 7) {
  work()
  work()

  const timings = []
  for (let index = 0; index < runs; index += 1) {
    const started = performance.now()
    work()
    timings.push(performance.now() - started)
  }

  return timings.sort((a, b) => a - b)[Math.floor(timings.length / 2)]
}

function pad(value, width) {
  return String(value).padStart(width)
}

const results = []

for (const size of SIZES) {
  const rows = makeRows(size, 3)
  const state = createState()
  const resolved = resolveColumns({ columns, rows, state, types }).visible

  const resolveColumnsMs = measure(() => resolveColumns({ columns, rows, state, types }))

  const sortText = measure(() =>
    sortRows(rows, resolved, createState({ sort: [{ key: "name", direction: "asc" }] }), types, format),
  )

  const sortNumber = measure(() =>
    sortRows(rows, resolved, createState({ sort: [{ key: "count", direction: "desc" }] }), types, format),
  )

  const sortDate = measure(() =>
    sortRows(rows, resolved, createState({ sort: [{ key: "seenAt", direction: "asc" }] }), types, format),
  )

  const sortCustom = measure(() =>
    sortRows(rows, resolved, createState({ sort: [{ key: "version", direction: "asc" }] }), types, format),
  )

  const filterOne = measure(() =>
    filterRows(rows, resolved, [{ key: "plan", operator: "eq", value: "pro" }], "all", types.get, format),
  )

  const filterThree = measure(() =>
    filterRows(
      rows,
      resolved,
      [
        { key: "plan", operator: "in", value: ["pro", "team"] },
        { key: "count", operator: "gte", value: "100" },
        { key: "seenAt", operator: "gte", value: "2026-03-01" },
      ],
      "all",
      types.get,
      format,
    ),
  )

  // The worst case for search: a term nothing matches, so every cell in every
  // searchable column has to be examined and formatted.
  const searchMiss = measure(() => searchRows(rows, resolved, "zzzzzzzz", types, format))
  const searchHit = measure(() => searchRows(rows, resolved, "ada", types, format))

  const whole = measure(() =>
    getRows({
      rows,
      columns: resolved,
      state: createState({
        filters: [{ key: "plan", operator: "in", value: ["pro", "team"] }],
        search: "e",
        sort: [{ key: "amountCents", direction: "desc" }],
        page: 4,
        pageSize: 25,
      }),
      types,
      format,
    }),
  )

  results.push({
    size,
    resolveColumnsMs,
    sortText,
    sortNumber,
    sortDate,
    sortCustom,
    filterOne,
    filterThree,
    searchMiss,
    searchHit,
    whole,
  })
}

const header = [
  "rows",
  "columns",
  "sort text",
  "sort num",
  "sort date",
  "sort custom",
  "filter ×1",
  "filter ×3",
  "search miss",
  "search hit",
  "full pipeline",
]

const widths = [9, 9, 10, 9, 10, 12, 10, 10, 12, 11, 14]

console.log("\nTrapezium — pipeline, milliseconds (median of 7)\n")
console.log(header.map((label, index) => pad(label, widths[index])).join("  "))
console.log(widths.map((width) => "─".repeat(width)).join("  "))

for (const result of results) {
  const cells = [
    result.size.toLocaleString(),
    result.resolveColumnsMs.toFixed(2),
    result.sortText.toFixed(2),
    result.sortNumber.toFixed(2),
    result.sortDate.toFixed(2),
    result.sortCustom.toFixed(2),
    result.filterOne.toFixed(2),
    result.filterThree.toFixed(2),
    result.searchMiss.toFixed(2),
    result.searchHit.toFixed(2),
    result.whole.toFixed(2),
  ]
  console.log(cells.map((cell, index) => pad(cell, widths[index])).join("  "))
}

console.log("\nPer row, microseconds, at the largest size\n")
const largest = results[results.length - 1]
for (const [label, value] of Object.entries(largest)) {
  if (label === "size") continue
  console.log(`  ${label.padEnd(18)} ${((value / largest.size) * 1000).toFixed(3)} µs`)
}
console.log()
