/**
 * Points the generated benchmark dataset at the built package.
 *
 * The dataset is written in TypeScript beside the tests, because that is where
 * it belongs; the benchmarks import the built output, because that is what
 * ships. This is the one line of glue between the two.
 */
import { readFile, writeFile } from "node:fs/promises"

const path = new URL("../bench/dataset.mjs", import.meta.url)
const source = await readFile(path, "utf8")

await writeFile(
  path,
  `/* Generated from packages/core/src/testing/dataset.ts — do not edit. */\n${source.replaceAll(
    'from "../index.js"',
    'from "../packages/core/dist/index.js"',
  )}`,
)
