/**
 * A static server for the no-build-step example.
 *
 * The page loads its data with `fetch` and the library from `packages/`, so it
 * needs to be served over HTTP from the repository root rather than opened as a
 * `file://` URL. Written with the Node standard library so the one example that
 * proves you need no tooling does not itself need any.
 */
import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { extname, join, normalize, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..")
const port = Number(process.env["PORT"] ?? 4330)

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
}

createServer(async (request, response) => {
  const path = normalize(decodeURIComponent((request.url ?? "/").split("?")[0] ?? "/"))

  /*
    The root redirects rather than serving the page in place. Serving it at "/"
    is one line shorter and quietly wrong: the page's own `fetch("people.json")`
    would then resolve against the root and 404, which looks like a broken
    library rather than a broken server.
  */
  if (path === "/") {
    response.writeHead(302, { location: "/examples/plain-html/" }).end()
    return
  }

  const file = join(root, path.endsWith("/") ? `${path}index.html` : path)

  // `normalize` has already collapsed `..`, so anything still outside the
  // repository is someone trying it on.
  if (!file.startsWith(root)) {
    response.writeHead(403).end("forbidden")
    return
  }

  try {
    const body = await readFile(file)
    response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" })
    response.end(body)
  } catch {
    response.writeHead(404).end("not found")
  }
}).listen(port, () => {
  console.log(`http://localhost:${String(port)}/`)
})
