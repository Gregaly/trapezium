/**
 * Builds the packages and packs them for another project to install.
 *
 * ```sh
 * node scripts/pack-local.mjs ../fec-next/vendor
 * ```
 *
 * The tarballs are exactly what `pnpm publish` would send: the same files, the
 * same exports map, and `workspace:*` already rewritten to a real version. So
 * an application installing them is testing the published package rather than a
 * symlink to a working tree, which is the whole point — a symlink resolves
 * differently, hides an exports-map mistake, and shares a React copy it would
 * not share in production.
 *
 * Every run stamps a new version. That is not tidiness: npm and pnpm both key a
 * `file:` dependency by version, so re-packing 0.1.0 over itself leaves the old
 * copy installed and the next hour is spent wondering why a fix did nothing.
 * A version that has never been seen before cannot be served from a cache.
 */

import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const PACKAGES = ["core", "react", "vue", "svelte", "vanilla"]

const destination = resolve(process.argv[2] ?? join(ROOT, "local-packs"))
const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14)
const version = `0.1.0-local.${stamp}`

const run = (command, args, cwd = ROOT) => execFileSync(command, args, { cwd, stdio: "inherit" })

console.log(`\nBuilding, then packing ${version} into ${destination}\n`)
run("pnpm", ["build"])
mkdirSync(destination, { recursive: true })

/** The original manifests, put back whatever happens below. */
const manifests = PACKAGES.map((name) => {
  const path = join(ROOT, "packages", name, "package.json")
  return { name, path, original: readFileSync(path, "utf8") }
})

try {
  // Every version is set before anything is packed, so that the dependency each
  // adapter declares on the core resolves to the version being packed now.
  for (const manifest of manifests) {
    const parsed = JSON.parse(manifest.original)
    parsed.version = version
    writeFileSync(manifest.path, `${JSON.stringify(parsed, null, 2)}\n`)
  }

  for (const manifest of manifests) {
    run("pnpm", ["pack", "--pack-destination", destination], dirname(manifest.path))
  }
} finally {
  for (const manifest of manifests) writeFileSync(manifest.path, manifest.original)
}

console.log(`
Done. In the other project:

  npm install ./vendor/trapezium-react-${version}.tgz ./vendor/trapezium-core-${version}.tgz

Both, even though you only import one: the adapter depends on @trapezium/core at
this exact version, and it is not on npm yet.
`)
