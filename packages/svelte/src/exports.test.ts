/**
 * @vitest-environment node
 *
 * The published types and the runtime agree.
 *
 * The package entry re-exports a `.svelte` component, so its declaration file
 * is written by hand rather than generated — which means a name can be added
 * to one and forgotten in the other. That happened once: `pickUrlState` was
 * declared and not exported, and the first SvelteKit page to import it broke.
 */
import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import * as runtime from "./index.js"

describe("the hand-written declarations", () => {
  it("declare exactly the values the entry exports", () => {
    const declarations = readFileSync(new URL("./public-types.d.ts", import.meta.url), "utf8")

    // Every name inside a value `export { … }` block, ignoring `export type`.
    const declared = new Set<string>()
    for (const block of declarations.matchAll(/^export (?!type)(?:declare const (\w+)|\{([^}]*)\})/gm)) {
      if (block[1]) declared.add(block[1])
      for (const name of (block[2] ?? "").split(",")) {
        const trimmed = name.trim().replace(/^.* as /, "")
        if (trimmed) declared.add(trimmed)
      }
    }

    expect([...declared].sort()).toEqual(Object.keys(runtime).sort())
  })
})
