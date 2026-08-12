/**
 * Copies the core stylesheet into an adapter package.
 *
 * Every adapter renders the same markup with the same class names, so they all
 * ship the same CSS — but a consumer should be able to write
 * `import "@trapezium/react/styles.css"` without knowing the core exists.
 */
import { cp, mkdir } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const target = process.argv[2]
if (!target) throw new Error("usage: copy-styles.mjs <package>")

const from = resolve(root, "packages/core")
const to = resolve(root, "packages", target)

await mkdir(resolve(to, "themes"), { recursive: true })
await cp(resolve(from, "styles.css"), resolve(to, "styles.css"))
await cp(resolve(from, "themes"), resolve(to, "themes"), { recursive: true })
