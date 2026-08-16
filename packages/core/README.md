# @trapezium/core

The engine behind [Trapezium](https://github.com/Gregaly/trapezium) tables: the column model, the type registry, and pure functions for filtering, searching, sorting, paginating, selecting and serialising state.

**Zero runtime dependencies. No framework, no DOM.** It runs identically on a server, in a browser and in a test, which is what makes a server-rendered table correct on its first paint.

Most people want a rendered table instead:

- [`@trapezium/react`](https://www.npmjs.com/package/@trapezium/react)
- [`@trapezium/vue`](https://www.npmjs.com/package/@trapezium/vue)
- [`@trapezium/svelte`](https://www.npmjs.com/package/@trapezium/svelte)
- [`@trapezium/vanilla`](https://www.npmjs.com/package/@trapezium/vanilla)

Use this one to bind your own renderer, or to apply the same filter and sort semantics on the server that the table uses on the client.

```ts
import { getRows, resolveColumns, createState, defaultTypeRegistry, DEFAULT_FORMAT } from "@trapezium/core"

const state = createState({ sort: [{ key: "amount", direction: "desc" }], pageSize: 25 })
const { visible } = resolveColumns({ rows, state, types: defaultTypeRegistry })
const { rows: page, total, pageCount } = getRows({ rows, columns: visible, state, types: defaultTypeRegistry, format: DEFAULT_FORMAT })
```

The stylesheet lives here too, and every adapter re-exports it:

```ts
import "@trapezium/core/styles.css"
import "@trapezium/core/themes/shadcn.css"   // optional bridge
```

**Working with a coding agent?** The whole API is one file inside this package: `node_modules/@trapezium/core/llms.txt`.

Full documentation: [github.com/Gregaly/trapezium](https://github.com/Gregaly/trapezium#readme) · MIT
