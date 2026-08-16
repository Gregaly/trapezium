/**
 * Copies the single-file API reference into a package.
 *
 * `llms.txt` is written for a coding agent: the whole surface in one file, in
 * the order somebody needs it. Shipping it inside the package means an agent
 * working in an application that depends on Trapezium can read it from
 * `node_modules` instead of inferring the API from type signatures.
 */
import { cp } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const target = process.argv[2]
if (!target) throw new Error("usage: copy-llms.mjs <package>")

await cp(resolve(root, "llms.txt"), resolve(root, "packages", target, "llms.txt"))
