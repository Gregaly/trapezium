import { performance } from "node:perf_hooks"
import {
  createState, createTypeRegistry, DEFAULT_FORMAT, resolveColumns, searchRows, sortRows,
} from "../../packages/core/dist/index.js"
import { columns, customTypes, makeRows } from "../dataset.mjs"

const types = createTypeRegistry(customTypes)
const format = { ...DEFAULT_FORMAT, now: new Date("2026-08-13T12:00:00.000Z") }
const rows = makeRows(10_000, 3)
const state = createState()
const all = resolveColumns({ columns, rows, state, types }).visible

const time = (label, work) => {
  work()
  const started = performance.now()
  work()
  console.log(`${label.padEnd(38)} ${(performance.now() - started).toFixed(1)} ms`)
}

/* Which columns cost what, during a search that matches nothing. */
console.log("\nsearch over 10,000 rows, one column at a time\n")
for (const column of all) {
  time(`${column.key} (${column.type})`, () => searchRows(rows, [column], "zzzzzzzz", types, format))
}

console.log("\nsorting, one column at a time\n")
for (const key of ["name", "count", "seenAt", "version", "plan", "amountCents"]) {
  time(key, () => sortRows(rows, all, createState({ sort: [{ key, direction: "asc" }] }), types, format))
}

/* How many times a sort asks a type to normalise a value. */
let calls = 0
const counting = createTypeRegistry({
  ...customTypes,
  counted: { name: "counted", normalise: (value) => { calls += 1; return String(value) } },
})
const countedColumns = resolveColumns({
  columns: [{ key: "name", type: "counted" }], rows, state, types: counting,
}).visible
sortRows(rows, countedColumns, createState({ sort: [{ key: "name", direction: "asc" }] }), counting, format)
console.log(`\nnormalise calls for one sort of 10,000 rows: ${calls.toLocaleString()}`)
console.log(`(one per row would be 10,000; one per comparison is ~2 × n log n)\n`)
