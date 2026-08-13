import { performance } from "node:perf_hooks"
import { distinctValues } from "../../packages/core/dist/index.js"
import { makeRows } from "../dataset.mjs"

const measure = (work, runs = 7) => {
  work(); work()
  const timings = []
  for (let i = 0; i < runs; i += 1) {
    const started = performance.now()
    work()
    timings.push(performance.now() - started)
  }
  return timings.sort((a, b) => a - b)[Math.floor(runs / 2)]
}

console.log("\nBuilding a set filter's choices — milliseconds (median of 7)\n")
console.log("     rows   few distinct   many distinct   all distinct")
console.log("─────────  ─────────────  ──────────────  ─────────────")

for (const size of [1_000, 10_000, 100_000, 250_000]) {
  const rows = makeRows(size, 3)
  const plans = rows.map((row) => row.plan)          // 4 distinct
  const owners = rows.map((row, i) => `Owner ${i % 300}`) // 300 distinct
  const ids = rows.map((row) => row.id)              // all distinct

  const line = [
    size.toLocaleString().padStart(9),
    measure(() => distinctValues(plans)).toFixed(2).padStart(13),
    measure(() => distinctValues(owners)).toFixed(2).padStart(14),
    measure(() => distinctValues(ids)).toFixed(2).padStart(13),
  ]
  console.log(line.join("  "))
}

console.log("\nFor comparison, with the old 200-value cap the work was identical:")
console.log("the cap only threw away the result at the end, after every value")
console.log("had already been counted.\n")
